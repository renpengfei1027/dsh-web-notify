// dsh-harness-notifier — client half（浏览器侧）
//
// dsh web 客户端插件，按 ModuleLoader 协议装载：
//   window.__ModuleLoader__.load({ id, factory: (require) => module.exports })
// 其中 require 走客户端模块表的 implicit baseline（本插件只 require react）。
//
// M1 检测面：订阅官方转发的宿主事件（零补丁，当前版本
// API_REMOTE_FORWARDED_EVENTS 已全部包含）：
//   - approval/request        （waterfall，观察者必须 return next()）
//   - user-questions/request  （waterfall，同上；提问与计划评审同走此事件）
//   - api-session/status      （emit，双参 spread：sessionId, running）
//   - api-session/error       （emit：sessionId, message）
//   - api-session/activity    （emit：sessionId, updatedAt → 用户已介入，清除待处理）
//   - settings/document-updated（emit：ns 变更时热刷新配置）
//   - connection/reset        （客户端本地事件，连接恢复）
//
// 通道：提示音（WebAudio）/ 标签页标题徽标 + PWA badge / OS 通知 /
//       通知中心 dock + toast（shell.overlay）/ 插件页配置（plugins.bundle.config）。
// 行为：免打扰时段只静音（徽标与 dock 静默更新），冷却去重，配置热生效。
"use strict";

window.__ModuleLoader__.load({
	id: "dsh-harness-notifier",
	factory: (require) => {
		var module = { exports: {} };
		var React = require("react");

		var PLUGIN_ID = "dsh-harness-notifier";
		var NS = "notifications";
		var OVERLAY_ID = "harness-notifier";
		var BASE_TITLE = String((typeof document !== "undefined" && document.title) || "DSH");

		/** 与宿主 lib/index.js 的 Config 默认值保持一致。 */
		var DEFAULTS = {
			sound: true,
			volume: 0.15,
			badge: true,
			toast: true,
			notify: true,
			escalateOnHidden: true,
			dock: true,
			completion: true,
			completionSound: true,
			completionNotify: true,
			connection: true,
			agentError: true,
			cooldownMs: 5000,
			diagnostics: false,
			alertKinds: ["approval", "plan-review", "question"],
			quiet: { enabled: false, start: "23:00", end: "08:00" }
		};

		// ------------------------------------------------------------------
		// 状态
		// ------------------------------------------------------------------
		var ctxRef = null; // apply(ctx) 时注入
		var cfg = mergeConfig(DEFAULTS, null);
		/** sid -> Map(key -> {key, lane, title, body, count, ts}) */
		var pendings = new Map();
		/** [{key, kind, title, body, sid, ts}] */
		var toasts = [];
		var cooldowns = new Map(); // key -> ts
		var storeListeners = new Set();
		var diag = {
			errors: [],
			counters: { pending: 0, idle: 0, error: 0, reconnect: 0 },
			lastEventAt: 0,
			/** 系统通知链路自证：尝试/成功/跳过原因/错误，以及最近一次页面可见性变化。 */
			os: { attempt: 0, sent: 0, skipPermission: 0, skipDisabled: 0, error: 0, lastSkip: "" },
			lastVisibility: (typeof document !== "undefined" && document.visibilityState) || "unknown"
		};

		function mergeConfig(base, served) {
			var out = Object.assign({}, base);
			if (!served || typeof served !== "object") return out;
			for (var k in base) {
				if (!(k in served) || served[k] === void 0 || served[k] === null) continue;
				if (k === "quiet" && typeof served.quiet === "object") {
					out.quiet = Object.assign({}, base.quiet, served.quiet);
				} else {
					out[k] = served[k];
				}
			}
			return out;
		}

		function subscribeStore(fn) {
			storeListeners.add(fn);
			return () => storeListeners.delete(fn);
		}
		function notifyStore() {
			storeListeners.forEach((fn) => {
				try { fn(); } catch { /* 组件卸载竞态 */ }
			});
		}
		function note(kind) {
			diag.counters[kind] = (diag.counters[kind] || 0) + 1;
			diag.lastEventAt = Date.now();
			publishDiag();
		}
		function recordError(where, error) {
			diag.errors.push({ at: Date.now(), where, message: String((error && error.message) || error) });
			if (diag.errors.length > 20) diag.errors.splice(0, diag.errors.length - 20);
			publishDiag();
		}
		function publishDiag() {
			if (!cfg.diagnostics) return;
			try {
				window.__NOTIFIER_DIAG__ = {
					cfg,
					pending: allPending().map((p) => ({ sid: p.sid, lane: p.lane, count: p.count })),
					toasts: toasts.length,
					counters: diag.counters,
					lastEventAt: diag.lastEventAt,
					recentErrors: diag.errors.slice(-5)
				};
			} catch { /* 诊断只求尽力 */ }
		}

		// ------------------------------------------------------------------
		// 行为开关
		// ------------------------------------------------------------------
		function parseHm(text) {
			var m = /^(\d{1,2}):(\d{2})$/.exec(String(text == null ? "" : text));
			return m ? Number(m[1]) * 60 + Number(m[2]) : null;
		}
		function quietActive() {
			if (!cfg.quiet || !cfg.quiet.enabled) return false;
			var start = parseHm(cfg.quiet.start);
			var end = parseHm(cfg.quiet.end);
			if (start === null || end === null) return false;
			var d = new Date();
			var cur = d.getHours() * 60 + d.getMinutes();
			return start <= end ? cur >= start && cur < end : cur >= start || cur < end;
		}
		function passCooldown(key) {
			var now = Date.now();
			var last = cooldowns.get(key) || 0;
			if (now - last < (Number(cfg.cooldownMs) || 0)) return false;
			cooldowns.set(key, now);
			return true;
		}
		/** 待处理车道开关：approval 独占一条；question 车道由 question / plan-review 任一开启。 */
		function laneEnabled(lane) {
			var kinds = Array.isArray(cfg.alertKinds) ? cfg.alertKinds : DEFAULTS.alertKinds;
			return lane === "approval" ? kinds.indexOf("approval") >= 0 : kinds.indexOf("question") >= 0 || kinds.indexOf("plan-review") >= 0;
		}
		function truncate(text, max) {
			var s = String(text == null ? "" : text).trim();
			return s.length > max ? s.slice(0, max - 1) + "…" : s;
		}

		// ------------------------------------------------------------------
		// 通道 1：提示音（WebAudio 双音；浏览器策略要求先有一次用户手势）
		// ------------------------------------------------------------------
		var audio = null;
		function audioCtx() {
			if (audio === null) {
				var AC = window.AudioContext || window.webkitAudioContext;
				if (typeof AC !== "function") return null;
				try { audio = new AC(); } catch { return null; }
			}
			if (audio.state === "suspended") audio.resume().catch(() => {});
			return audio;
		}
		if (typeof document !== "undefined" && document.addEventListener) {
			document.addEventListener("pointerdown", () => {
			audioCtx();
			// 页面不可见时的系统通知升级依赖授权：借同一手势顺带索权。
			// 仅 default 态发起（已拒绝/已授权/不支持时不动）。
			try {
				if (typeof Notification !== "undefined" && Notification.permission === "default") {
					Notification.requestPermission().then(() => notifyStore()).catch(() => {});
				}
			} catch { /* ignore */ }
		}, { once: true, capture: true });
		}
		function chime(kind) {
			if (!cfg.sound) return;
			var ac = audioCtx();
			if (!ac || ac.state !== "running") return;
			try {
				var t0 = ac.currentTime;
				var vol = Math.max(0.0001, Math.min(1, Number(cfg.volume) || 0));
				var tones = kind === "alert" ? [[880, 0], [1318.5, 0.14]] : kind === "error" ? [[440, 0], [329.6, 0.16]] : [[659.3, 0], [987.8, 0.12]];
				tones.forEach((tone) => {
					var osc = ac.createOscillator();
					var gain = ac.createGain();
					osc.type = "sine";
					osc.frequency.value = tone[0];
					gain.gain.setValueAtTime(0.0001, t0 + tone[1]);
					gain.gain.exponentialRampToValueAtTime(vol, t0 + tone[1] + 0.02);
					gain.gain.exponentialRampToValueAtTime(0.0001, t0 + tone[1] + 0.32);
					osc.connect(gain);
					gain.connect(ac.destination);
					osc.start(t0 + tone[1]);
					osc.stop(t0 + tone[1] + 0.4);
				});
			} catch (error) { recordError("chime", error); }
		}

		// ------------------------------------------------------------------
		// 通道 2：标签页标题徽标 + PWA app badge
		// ------------------------------------------------------------------
		function pendingCount() {
			var n = 0;
			pendings.forEach((items) => items.forEach(() => { n += 1; }));
			return n;
		}
		function allPending() {
			var rows = [];
			pendings.forEach((items) => items.forEach((p) => rows.push(p)));
			return rows.sort((a, b) => a.ts - b.ts);
		}
		function updateBadge() {
			if (typeof document === "undefined") return;
			try {
				var n = pendingCount();
				document.title = cfg.badge && n > 0 ? "(" + n + ") " + BASE_TITLE : BASE_TITLE;
				if (navigator && typeof navigator.setAppBadge === "function") {
					if (cfg.badge && n > 0) navigator.setAppBadge(n).catch(() => {});
					else if (typeof navigator.clearAppBadge === "function") navigator.clearAppBadge().catch(() => {});
				}
			} catch (error) { recordError("badge", error); }
		}

		// ------------------------------------------------------------------
		// 通道 3：浏览器 OS 通知（不自动索权；设置卡片手动申请）
		// ------------------------------------------------------------------
		function notificationSupported() {
			return typeof Notification !== "undefined";
		}
		/** 页面不可见（最小化 / 被其他窗口完全遮挡）。 */
		function pageHidden() {
			return typeof document !== "undefined" && document.visibilityState === "hidden";
		}
		/**
		 * 页面无人值守：不可见，或已失焦（用户点去了别的窗口，document.hasFocus()=false）。
		 * 失焦但可见时页内 toast 仍然看得到，但用户注意力已不在本窗口——同样升级。
		 */
		function pageUnattended() {
			if (pageHidden()) return true;
			try {
				return typeof document.hasFocus === "function" && !document.hasFocus();
			} catch { return false; }
		}
		var osWarnedNoPermission = false;
		// 可见性变化留痕（诊断用）：确认「切走标签页/最小化」确实触发了 hidden。
		try {
			document.addEventListener("visibilitychange", () => {
				diag.lastVisibility = document.visibilityState + "@" + new Date().toISOString();
				notifyStore();
			});
		} catch { /* 非 DOM 环境 */ }
		function osNotify(title, body) {
			// 升级语义：OS 通知开关开启时始终发；即使关闭，页面无人值守
			// （最小化 / 完全遮挡 / 失焦）且 escalateOnHidden（默认开）时也自动升级。
			// 免打扰仍由调用方把总闸。
			diag.os.attempt += 1;
			var unattended = pageUnattended();
			var wanted = cfg.notify || (unattended && cfg.escalateOnHidden !== false);
			if (!wanted) {
				diag.os.skipDisabled += 1;
				diag.os.lastSkip = "disabled(unattended:" + unattended + ")";
				return;
			}
			if (!notificationSupported()) {
				diag.os.lastSkip = "unsupported";
				return;
			}
			if (Notification.permission !== "granted") {
				diag.os.skipPermission += 1;
				diag.os.lastSkip = "permission:" + Notification.permission;
				// 页面无人值守时升级被权限卡住：回来后至少看见一次原因说明。
				if (unattended && !osWarnedNoPermission) {
					osWarnedNoPermission = true;
					addToast({
						kind: "error",
						title: "系统通知未授权",
						body: "页面无人值守时的升级提醒无法送达——回到页面点一下，在浏览器弹窗里允许通知"
					});
				}
				return;
			}
			try {
				var n = new Notification(title, { body: body, tag: PLUGIN_ID });
				diag.os.sent += 1;
				n.addEventListener("error", () => { /* 授权或系统层拒绝：静默 */ });
			} catch (error) {
				diag.os.error += 1;
				recordError("os-notify", error);
			}
		}

		// ------------------------------------------------------------------
		// 通道 4/5：toast + 通知中心 dock（shell.overlay 渲染，数据驱动）
		// ------------------------------------------------------------------
		function addToast(item) {
			if (!cfg.toast) return;
			var key = "t" + Date.now() + Math.random().toString(36).slice(2, 7);
			toasts.push(Object.assign({ key: key, ts: Date.now() }, item));
			if (toasts.length > 5) toasts.splice(0, toasts.length - 5);
			if (ctxRef) ctxRef.timeout(() => dismissToast(key), item.kind === "error" ? 9000 : 6000);
			notifyStore();
		}
		function dismissToast(key) {
			var before = toasts.length;
			toasts = toasts.filter((t) => t.key !== key);
			if (toasts.length !== before) notifyStore();
		}
		function openSession(sid) {
			try {
				if (ctxRef && ctxRef.sessions && typeof ctxRef.sessions.open === "function" && typeof sid === "string" && sid) {
					ctxRef.sessions.open(sid);
					return true;
				}
			} catch (error) { recordError("open-session", error); }
			return false;
		}
		function shortSid(sid) {
			return typeof sid === "string" && sid.length > 10 ? sid.slice(0, 8) + "…" : String(sid == null ? "" : sid);
		}

		// ------------------------------------------------------------------
		// 待处理状态机
		// ------------------------------------------------------------------
		function pendingKey(lane) { return lane; }

		function addPending(sid, lane, info) {
			var items = pendings.get(sid);
			if (!items) { items = new Map(); pendings.set(sid, items); }
			var key = pendingKey(lane);
			var existing = items.get(key);
			if (existing) {
				existing.count += 1;
				existing.ts = Date.now();
				existing.body = info.body;
				return false; // 已在提醒中，不重复响铃
			}
			items.set(key, { key: key, lane: lane, sid: sid, title: info.title, body: info.body, count: 1, ts: Date.now() });
			return true;
		}
		function removePending(sid, key) {
			var items = pendings.get(sid);
			if (!items) return;
			items.delete(key);
			if (items.size === 0) pendings.delete(sid);
			updateBadge();
			notifyStore();
		}
		/** waterfall 链返回 = 该请求已被应答：清除对应会话的对应车道待处理项。 */
		function resolvePending(lane, scope) {
			var sid = sidOf(scope);
			if (sid === null) return;
			removePending(sid, lane);
		}
		function clearSessionPending(sid) {
			if (pendings.delete(sid)) {
				updateBadge();
				notifyStore();
			}
		}
		function pendingCountOf(sid) {
			var items = pendings.get(sid);
			return items ? items.size : 0;
		}

		function summarize(lane, request) {
			if (lane === "approval") {
				var tool = request && typeof request.toolName === "string" ? request.toolName : "未知工具";
				var title = "等待审批：" + tool;
				var body = request && typeof request.reason === "string" && request.reason ? truncate(request.reason, 120) : "工具请求越权执行，需要你批准";
				return { title: title, body: body };
			}
			var qs = request && Array.isArray(request.questions) ? request.questions : [];
			var first = qs[0] || {};
			var text = typeof first.question === "string" && first.question ? first.question : "有提问等待回答";
			return {
				title: qs.length > 1 ? qs.length + " 个问题等待回答" : "提问等待回答",
				body: truncate(text, 120)
			};
		}

		function sidOf(scope) {
			try {
				if (ctxRef && ctxRef.sessions && typeof ctxRef.sessions.scopeOf === "function") {
					var sid = ctxRef.sessions.scopeOf(scope);
					if (typeof sid === "string") return sid;
				}
			} catch { /* scope 解析失败走兜底 */ }
			try {
				if (scope && typeof scope.id === "string") return scope.id;
			} catch { /* ignore */ }
			return null;
		}

		/** waterfall 观察者：只提醒，绝不返回非 next() 值（那会变成应答）。 */
		function observePending(lane, scope, request) {
			note("pending");
			if (!laneEnabled(lane)) return;
			var sid = sidOf(scope) || "unknown";
			var info = summarize(lane, request);
			var isNew = addPending(sid, lane, info);
			updateBadge();
			if (!isNew) return;
			if (quietActive()) return; // 静默更新徽标与 dock
			if (!passCooldown(lane + ":" + sid)) return;
			chime("alert");
			osNotify(info.title, info.body);
			addToast({ kind: lane, title: info.title, body: info.body, sid: sid });
		}

		/** 回合结束（running true→false）。有待处理项说明是在等用户，不误报完成。 */
		function onSessionIdle(sid) {
			note("idle");
			if (pendingCountOf(sid) > 0) return;
			if (!cfg.completion) return;
			if (quietActive()) return;
			if (!passCooldown("idle:" + sid)) return;
			var body = "会话回合已结束，等待你的输入";
			if (cfg.completionSound) chime("done");
			if (cfg.completionNotify) osNotify("回合结束", body);
			addToast({ kind: "idle", title: "回合结束", body: body, sid: sid });
		}

		/** 会话异常（api-session/error：宿主在回合位置之外观察到的失败）。 */
		function onSessionError(sid, message) {
			note("error");
			if (!cfg.agentError) return;
			if (quietActive()) return;
			if (!passCooldown("error:" + sid)) return;
			var body = truncate(message, 160) || "会话运行异常";
			chime("error");
			osNotify("会话异常", body);
			addToast({ kind: "error", title: "会话异常", body: body, sid: sid });
		}

		// ------------------------------------------------------------------
		// 设置读写（ctx.remote.settings：describe 读 / update 合并写）
		// ------------------------------------------------------------------
		function refreshConfig() {
			if (!ctxRef || !ctxRef.remote || !ctxRef.remote.settings) return Promise.resolve();
			return Promise.resolve()
				.then(() => ctxRef.remote.settings.describe())
				.then((described) => {
					var row = described && Array.isArray(described.namespaces)
						? described.namespaces.find((candidate) => candidate && candidate.ns === NS)
						: null;
					if (row && row.value && typeof row.value === "object") {
						cfg = mergeConfig(DEFAULTS, row.value);
						optimistic = {}; // 服务器值落地即清空乐观回显（拖动中的下一次 onChange 会立即重设）
						updateBadge();
						notifyStore();
						publishDiag();
					}
				})
				.catch((error) => recordError("refresh-config", error));
		}
		function writePatch(patch) {
			if (!ctxRef || !ctxRef.remote || !ctxRef.remote.settings) return Promise.reject(new Error("settings remote 不可用"));
			return Promise.resolve()
				// 网关按 descriptor 严格校验参数数：update 的声明是
				// (ns, patch, expectedRevision)，第三参 number | undefined——
				// 传 void 0 表示无条件写（codec 会把 undefined 字段直接省略）。
				.then(() => ctxRef.remote.settings.update(NS, patch, void 0))
				.then(() => refreshConfig())
				.catch((error) => {
					recordError("write-config", error);
					addToast({ kind: "error", title: "保存失败", body: String((error && error.message) || error) });
					throw error;
				});
		}

		// ------------------------------------------------------------------
		// 卡片写入通道：乐观回显 + 150ms 合并
		// 受控输入若等服务端往返才更新会视觉回弹；拖动音量/键入冷却也会
		// 产生写风暴。这里本地立即生效，150ms 内的补丁合并成一次 update。
		// ------------------------------------------------------------------
		var optimistic = {};
		var writeMerged = {};
		var writeTimer = null;
		function cardValue(key) {
			if (key in optimistic) return optimistic[key];
			if (key === "quiet.enabled") return !!(cfg.quiet && cfg.quiet.enabled);
			if (key === "quiet.start") return cfg.quiet ? cfg.quiet.start : DEFAULTS.quiet.start;
			if (key === "quiet.end") return cfg.quiet ? cfg.quiet.end : DEFAULTS.quiet.end;
			return cfg[key];
		}
		function optimisticQuiet() {
			return {
				enabled: !!cardValue("quiet.enabled"),
				start: String(cardValue("quiet.start")),
				end: String(cardValue("quiet.end"))
			};
		}
		function patchOf(key, value) {
			if (key === "quiet.enabled" || key === "quiet.start" || key === "quiet.end") {
				var quiet = optimisticQuiet();
				if (key === "quiet.enabled") quiet.enabled = !!value;
				else if (key === "quiet.start") quiet.start = String(value);
				else quiet.end = String(value);
				return { quiet: quiet };
			}
			var body = {};
			body[key] = value;
			return body;
		}
		function cardWrite(key, value) {
			optimistic[key] = value;
			notifyStore();
			if (!ctxRef) return;
			Object.assign(writeMerged, patchOf(key, value));
			if (writeTimer) writeTimer(); // 取消上一次待发的合并写
			writeTimer = ctxRef.timeout(() => {
				writeTimer = null;
				var body = writeMerged;
				writeMerged = {};
				writePatch(body).then(() => {}, () => {}); // 失败已由 writePatch toast 提示
			}, 150);
		}

		// ------------------------------------------------------------------
		// 样式
		// ------------------------------------------------------------------
		var CSS = [
			".hn-overlay{position:fixed;right:16px;bottom:16px;z-index:900;display:flex;flex-direction:column;align-items:flex-end;gap:8px;pointer-events:none;font-size:13px}",
			".hn-overlay>*{pointer-events:auto}",
			".hn-dock-bell{width:40px;height:40px;border-radius:50%;border:1px solid rgba(128,128,128,.35);background:rgba(24,24,28,.92);color:#eee;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.25);position:relative}",
			".hn-dock-bell[data-count='0']{opacity:.55}",
			".hn-dock-badge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:#e5484d;color:#fff;font-size:11px;line-height:18px;text-align:center;font-weight:600}",
			".hn-panel{width:320px;max-height:60vh;overflow:auto;border-radius:10px;border:1px solid rgba(128,128,128,.35);background:rgba(24,24,28,.96);color:#eee;box-shadow:0 8px 28px rgba(0,0,0,.35)}",
			".hn-panel-head{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid rgba(128,128,128,.25);font-weight:600}",
			".hn-panel-head a{cursor:pointer;opacity:.7;font-size:12px;font-weight:400}",
			".hn-item{padding:8px 12px;border-bottom:1px solid rgba(128,128,128,.18)}",
			".hn-item:last-child{border-bottom:none}",
			".hn-item-title{font-weight:600;margin-bottom:2px}",
			".hn-item-body{opacity:.8;margin-bottom:6px;word-break:break-all}",
			".hn-item-foot{display:flex;gap:8px;align-items:center}",
			".hn-item-sid{opacity:.5;font-size:11px;flex:1}",
			".hn-toasts{display:flex;flex-direction:column;align-items:flex-end;gap:8px}",
			".hn-toast{width:300px;border-radius:10px;border:1px solid rgba(128,128,128,.35);background:rgba(24,24,28,.95);color:#eee;padding:10px 12px;box-shadow:0 6px 20px rgba(0,0,0,.3);cursor:pointer}",
			".hn-toast[data-kind='error']{border-color:rgba(229,72,77,.65)}",
			".hn-toast-title{font-weight:600;margin-bottom:2px}",
			".hn-toast-body{opacity:.85;word-break:break-all}",
			".hn-card{display:flex;flex-direction:column;gap:12px;max-width:560px}",
			".hn-card-section{border:1px solid rgba(128,128,128,.25);border-radius:10px;padding:10px 14px}",
			".hn-card-section>h4{margin:0 0 8px;font-size:13px;opacity:.9}",
			".hn-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:6px 0;min-height:32px}",
			".hn-row .hn-label{display:flex;flex-direction:column;gap:2px;min-width:0}",
			".hn-row .hn-title{font-size:13px}",
			".hn-row .hn-hint{opacity:.55;font-size:12px;line-height:1.5}",
			".hn-toggle{position:relative;width:36px;height:20px;flex:none;display:inline-block}",
			".hn-toggle>input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer;z-index:1}",
			".hn-toggle>i{position:absolute;inset:0;border-radius:10px;background:rgba(128,128,128,.4);transition:background .15s}",
			".hn-toggle>i::after{content:\"\";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.3);transition:transform .15s}",
			".hn-toggle>input:checked+i{background:#4f8cff}",
			".hn-toggle>input:checked+i::after{transform:translateX(16px)}",
			".hn-toggle>input:focus-visible+i{outline:2px solid rgba(79,140,255,.6);outline-offset:2px}",
			".hn-inline{display:flex;align-items:center;gap:8px}",
			".hn-actions{display:flex;gap:8px;padding:2px 0}",
			".hn-range{width:160px;accent-color:#4f8cff;cursor:pointer}",
			".hn-value{min-width:38px;text-align:right;font-size:12px;opacity:.6}",
			".hn-input{border:1px solid rgba(128,128,128,.45);background:transparent;color:inherit;border-radius:6px;padding:3px 8px;width:88px;color-scheme:dark light}",
			".hn-btn{border:1px solid rgba(128,128,128,.45);background:transparent;color:inherit;border-radius:6px;padding:4px 12px;cursor:pointer;font-size:12px}",
			".hn-btn:hover{background:rgba(128,128,128,.2);border-color:rgba(128,128,128,.7)}",
			".hn-muted{opacity:.6;font-size:12px;line-height:1.5}"
		].join("\n");

		// 静态客户端协议没有 styles 服务（那是动态 runner 的闭包参数）：
		// 照官方静态插件做法，模块作用域直接插 <style>，data-plugin* 标记
		// 供 HMR 簿记（claimStyles）认领，data-plugin-css 查重保证幂等。
		var STYLE_TAG_ID = PLUGIN_ID + "/client.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(STYLE_TAG_ID) + "]") === null) {
			var styleTag = document.createElement("style");
			styleTag.dataset.plugin = PLUGIN_ID;
			styleTag.dataset.pluginCss = STYLE_TAG_ID;
			styleTag.textContent = CSS;
			document.head.appendChild(styleTag);
		}

		// ------------------------------------------------------------------
		// React 组件
		// ------------------------------------------------------------------
		function useStoreTick() {
			var _React$useReducer = React.useReducer((x) => x + 1, 0);
			var force = _React$useReducer[1];
			React.useEffect(() => subscribeStore(force), []);
		}

		function DockItem(props) {
			var p = props.p;
			function go() {
				if (openSession(p.sid)) removePending(p.sid, p.key);
			}
			function ignore() {
				removePending(p.sid, p.key);
			}
			return React.createElement(
				"div",
				{ className: "hn-item" },
				React.createElement("div", { className: "hn-item-title" }, (p.count > 1 ? "[" + p.count + "] " : "") + p.title),
				React.createElement("div", { className: "hn-item-body" }, p.body),
				React.createElement(
					"div",
					{ className: "hn-item-foot" },
					React.createElement("span", { className: "hn-item-sid" }, shortSid(p.sid)),
					React.createElement("button", { className: "hn-btn", onClick: go }, "前往"),
					React.createElement("button", { className: "hn-btn", onClick: ignore }, "忽略")
				)
			);
		}

		function Dock() {
			useStoreTick();
			var _React$useState = React.useState(false);
			var expanded = _React$useState[0];
			var setExpanded = _React$useState[1];
			var rows = allPending();
			var count = rows.length;
			return React.createElement(
				"div",
				{ style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" } },
				expanded
					? React.createElement(
							"div",
							{ className: "hn-panel" },
							React.createElement(
								"div",
								{ className: "hn-panel-head" },
								React.createElement("span", null, "通知中心（" + count + "）"),
								React.createElement("a", { onClick: () => setExpanded(false) }, "收起")
							),
							count === 0
								? React.createElement("div", { className: "hn-item hn-muted" }, "暂无待处理事项")
								: rows.map((p) => React.createElement(DockItem, { key: p.sid + ":" + p.key, p: p }))
					  )
					: null,
				React.createElement(
					"button",
					{
						className: "hn-dock-bell",
						"data-count": String(count),
						title: count > 0 ? count + " 项待处理" : "通知中心",
						onClick: () => setExpanded(!expanded)
					},
					count > 0 ? "🔔" : "🔕",
					count > 0 ? React.createElement("span", { className: "hn-dock-badge" }, String(count)) : null
				)
			);
		}

		function Toasts() {
			useStoreTick();
			return React.createElement(
				"div",
				{ className: "hn-toasts" },
				toasts.map((t) =>
					React.createElement(
						"div",
						{
							key: t.key,
							className: "hn-toast",
							"data-kind": t.kind,
							title: "点击前往会话",
							onClick: () => {
								if (t.sid) openSession(t.sid);
								dismissToast(t.key);
							}
						},
						React.createElement("div", { className: "hn-toast-title" }, t.title),
						React.createElement("div", { className: "hn-toast-body" }, t.body)
					)
				)
			);
		}

		function NotifierOverlay() {
			useStoreTick();
			return React.createElement(
				"div",
				{ className: "hn-overlay" },
				cfg.toast ? React.createElement(Toasts, null) : null,
				cfg.dock ? React.createElement(Dock, null) : null
			);
		}

		function Toggle(props) {
			var checked = !!props.checked;
			return React.createElement(
				"div",
				{ className: "hn-row" },
				React.createElement(
					"div",
					{ className: "hn-label" },
					React.createElement("span", { className: "hn-title" }, props.label),
					props.hint ? React.createElement("span", { className: "hn-hint" }, props.hint) : null
				),
				React.createElement(
					"label",
					{ className: "hn-toggle" },
					React.createElement("input", {
						type: "checkbox",
						checked: checked,
						onChange: (e) => props.onChange(e.target.checked)
					}),
					React.createElement("i")
				)
			);
		}

		/**
		 * `plugins.bundle.config` 契约要求双视图：summary 是插件页卡片下的
		 * 一行简介，page 才是完整表单。分发器按 `props.view` 分支，两者共享
		 * 同一配置状态（settingsScope 快照 + 乐观层）。
		 */
		function NotifierBundleConfig(props) {
			return props.view === "summary"
				? React.createElement(NotifierConfigSummary)
				: React.createElement(NotifierSettingsCard);
		}

		/** summary 视图：一行纯文本简介，跟随时开关状态。 */
		function NotifierConfigSummary() {
			useStoreTick();
			var enabled = [];
			if (cardValue("sound")) enabled.push("提示音");
			if (cardValue("notify") || cardValue("escalateOnHidden")) enabled.push("OS 通知");
			if (cardValue("badge")) enabled.push("徽标");
			if (cardValue("toast")) enabled.push("toast");
			if (cardValue("dock")) enabled.push("通知中心");
			return React.createElement(
				"span",
				null,
				enabled.length === 0
					? "多通道提醒已安装，所有通道未开启 — 打开此插件页面进行配置"
					: "提醒通道：" + enabled.join(" · ")
			);
		}

		function NotifierSettingsCard() {
			useStoreTick();
			var perm = notificationSupported() ? Notification.permission : "unsupported";
			function requestPermission() {
				if (!notificationSupported()) return;
				Notification.requestPermission().then(() => notifyStore()).catch(() => {});
			}
			/** 链路自证：索权（按钮点击即手势）→ 立即发一条真实系统通知 → 页内反馈结果。 */
			function sendTestNotification() {
				if (!notificationSupported()) {
					addToast({ kind: "error", title: "测试系统通知", body: "当前浏览器不支持系统通知" });
					return;
				}
				var proceed = () => {
					if (Notification.permission !== "granted") {
						addToast({
							kind: "error",
							title: "测试系统通知",
							body: "权限未授权（" + Notification.permission + "）：地址栏锁图标 → 网站设置 → 通知 → 允许"
						});
						notifyStore();
						return;
					}
					try {
						new Notification("通知插件测试", {
							body: "看到这条 Windows 通知说明链路正常（当前页面：" + (pageUnattended() ? "无人值守" : "在焦点上") + "）",
							tag: PLUGIN_ID + "-test"
						});
						diag.os.sent += 1;
						addToast({ kind: "idle", title: "测试系统通知", body: "已发送——注意屏幕右下角的 Windows 通知横幅" });
					} catch (error) {
						diag.os.error += 1;
						addToast({ kind: "error", title: "测试系统通知", body: "发送失败：" + String((error && error.message) || error) });
					}
					notifyStore();
				};
				if (Notification.permission === "default") {
					Notification.requestPermission().then(proceed, proceed);
				} else {
					proceed();
				}
			}
			/** 读取走乐观回显（cardValue），写入走合并调度（cardWrite）。 */
			function toggle(key, label, hint) {
				return React.createElement(Toggle, {
					key: key,
					checked: cardValue(key),
					label: label,
					hint: hint,
					onChange: (next) => cardWrite(key, next)
				});
			}
			return React.createElement(
				"div",
				{ className: "hn-card" },
				React.createElement(
					"div",
					{ className: "hn-card-section" },
					React.createElement("h4", null, "待处理提醒（审批 / 提问）"),
					toggle("sound", "提示音"),
					React.createElement(
						"div",
						{ className: "hn-row" },
						React.createElement("div", { className: "hn-label" }, React.createElement("span", { className: "hn-title" }, "音量")),
						React.createElement(
							"div",
							{ className: "hn-inline" },
							React.createElement("input", {
								className: "hn-range",
								type: "range",
								min: "0",
								max: "1",
								step: "0.05",
								value: String(cardValue("volume")),
								onChange: (e) => cardWrite("volume", Number(e.target.value))
							}),
							React.createElement("span", { className: "hn-value" }, Math.round(Number(cardValue("volume")) * 100) + "%")
						)
					),
					toggle("notify", "OS 通知", perm === "granted" ? "已授权" : perm === "denied" ? "已被浏览器拒绝" : perm === "unsupported" ? "浏览器不支持" : "未授权"),
					perm === "default"
						? React.createElement(
								"div",
								{ className: "hn-actions" },
								React.createElement("button", { className: "hn-btn", onClick: requestPermission }, "申请系统通知权限")
						  )
						: null,
					perm !== "unsupported"
						? React.createElement(
								"div",
								{ className: "hn-actions" },
								React.createElement("button", { className: "hn-btn", onClick: sendTestNotification }, "发送测试系统通知")
						  )
						: null,
					toggle("escalateOnHidden", "页面无人值守时升级系统通知", "最小化 / 被完全遮挡 / 点去了别的窗口（失焦）时，即使上面 OS 通知关闭也自动发系统通知"),
					toggle("badge", "标签页 / PWA 徽标"),
					toggle("toast", "页内 toast"),
					toggle("dock", "通知中心 dock")
				),
				React.createElement(
					"div",
					{ className: "hn-card-section" },
					React.createElement("h4", null, "状态提醒"),
					toggle("completion", "回合结束提醒"),
					toggle("completionSound", "回合结束提示音"),
					toggle("completionNotify", "回合结束 OS 通知"),
					toggle("agentError", "会话异常提醒"),
					toggle("connection", "连接恢复提醒")
				),
				React.createElement(
					"div",
					{ className: "hn-card-section" },
					React.createElement("h4", null, "行为"),
					React.createElement(
						"div",
						{ className: "hn-row" },
						React.createElement("div", { className: "hn-label" }, React.createElement("span", { className: "hn-title" }, "同类提醒冷却")),
						React.createElement(
							"div",
							{ className: "hn-inline" },
							React.createElement("input", {
								className: "hn-input",
								type: "number",
								min: "0",
								value: String(cardValue("cooldownMs")),
								onChange: (e) => {
									var raw = e.target.value;
									if (raw === "") { optimistic["cooldownMs"] = ""; notifyStore(); return; } // 清空只回显，不产生写
									var v = Number(raw);
									if (v >= 0) cardWrite("cooldownMs", v);
								}
							}),
							React.createElement("span", { className: "hn-value" }, "毫秒")
						)
					),
					toggle("quiet.enabled", "免打扰时段", "静音提示音 / OS 通知 / toast，徽标与 dock 静默更新"),
					!!cardValue("quiet.enabled")
						? React.createElement(
								"div",
								{ className: "hn-row" },
								React.createElement("div", { className: "hn-label" }, React.createElement("span", { className: "hn-title" }, "时段")),
								React.createElement(
									"div",
									{ className: "hn-inline" },
									React.createElement("input", {
										className: "hn-input",
										type: "time",
										value: String(cardValue("quiet.start")),
										onChange: (e) => cardWrite("quiet.start", e.target.value)
									}),
									React.createElement("span", { className: "hn-value" }, "至"),
									React.createElement("input", {
										className: "hn-input",
										type: "time",
										value: String(cardValue("quiet.end")),
										onChange: (e) => cardWrite("quiet.end", e.target.value)
									})
								)
						  )
						: null
				),
				React.createElement(
					"div",
					{ className: "hn-card-section" },
					React.createElement("h4", null, "诊断"),
					toggle("diagnostics", "暴露 window.__NOTIFIER_DIAG__"),
					React.createElement("div", { className: "hn-muted" }, "检测面：官方转发的 approval/request · user-questions/request · api-session/* · connection/reset；零补丁。")
				)
			);
		}

		// ------------------------------------------------------------------
		// 插件入口
		// ------------------------------------------------------------------
		var inject = ["remote", "remote.settings", "slots", "timer", "sessions"];

		/**
		 * waterfall 车道（审批/提问）的观察注册。
		 *
		 * cordis waterfall 的首个返回值即终止整条链：官方审批/问答 UI 的应答器
		 * 返回 `await pending.result`，普通 $on 注册的观察者排在它之后永远收不到
		 * 事件（这就是"待处理审批/提问没提醒"的根因）。$on 底下只是往 ctx 的
		 * 钩子表写 `remote.events.eventPrefix + 事件名`（前缀随启动随机，但运行时
		 * 可读），这里直接以 { prepend: true } 向同一张表注册，保证：
		 *   观察者先跑 → next() 放行 → 官方应答器应答 → 应答值原样回流。
		 *
		 * 内部面不可用时退化为普通 $on（此时这两个车道可能被应答器拦截，
		 * 提醒不响——会在诊断里记一条）。
		 */
		function observeWaterfall(ctx, event, handler) {
			try {
				var events = ctx.remote && ctx.remote.events;
				if (events && typeof events.eventPrefix === "string") {
					return ctx.on(events.eventPrefix + event, handler, { prepend: true });
				}
				recordError("waterfall-observe", new Error("remote.events.eventPrefix 不可用，退化为 $on"));
			} catch (error) {
				recordError("waterfall-observe", error);
			}
			return ctx.remote.$on(event, handler);
		}

		function apply(ctx) {
			ctxRef = ctx;

			// ---- 事件检测面 ----
			// waterfall 车道：prepend 抢位观察，应答值原样回流；链返回即已应答，
			// 顺手精确清除对应待处理项。
			observeWaterfall(ctx, "approval/request", function (request, next) {
				try { observePending("approval", this, request); } catch (error) { recordError("approval", error); }
				return Promise.resolve(next()).then((answer) => {
					try { resolvePending("approval", this); } catch { /* ignore */ }
					return answer;
				});
			});
			observeWaterfall(ctx, "user-questions/request", function (request, next) {
				try { observePending("question", this, request); } catch (error) { recordError("question", error); }
				return Promise.resolve(next()).then((answer) => {
					try { resolvePending("question", this); } catch { /* ignore */ }
					return answer;
				});
			});
			ctx.remote.$on("api-session/status", (sessionId, running) => {
				if (typeof sessionId !== "string" || sessionId === "") return;
				try {
					if (running) clearSessionPending(sessionId); // 重新开跑 → 阻塞已解除
					else onSessionIdle(sessionId);
				} catch (error) { recordError("status", error); }
			});
			ctx.remote.$on("api-session/error", (sessionId, message) => {
				if (typeof sessionId !== "string" || sessionId === "") return;
				try { onSessionError(sessionId, message); } catch (error) { recordError("error-lane", error); }
			});
			ctx.remote.$on("api-session/activity", (sessionId) => {
				if (typeof sessionId !== "string" || sessionId === "") return;
				try { clearSessionPending(sessionId); } catch { /* ignore */ }
			});
			ctx.remote.$on("settings/document-updated", (ns) => {
				if (ns === NS) refreshConfig();
			});
			ctx.on("connection/reset", () => {
				note("reconnect");
				if (cfg.connection && !quietActive()) addToast({ kind: "info", title: "连接已恢复", body: "与 dsh 宿主的连接重新建立" });
			});

			// ---- UI 落点 ----
			ctx.slots.inject("shell.overlay", () =>
				ctx.slots.register({ name: "shell.overlay", id: OVERLAY_ID, order: 40, label: "通知" }, NotifierOverlay)
			);
			// 插件页（ui-plugin-manager）为本插件包页提供的配置挂载点：
			// keyed 槽位，key 必须等于包名，页面据 ledger 动态发现（注册即出现），
			// 包详情页渲染 view:"page"，Installed 卡片下渲染 view:"summary"。
			ctx.slots.inject("plugins.bundle.config", () =>
				ctx.slots.register({ name: "plugins.bundle.config", key: PLUGIN_ID }, NotifierBundleConfig)
			);

			// ---- 配置与清理 ----
			refreshConfig();
			ctx.effect(
				() => () => {
					try {
						document.title = BASE_TITLE;
						if (navigator && typeof navigator.clearAppBadge === "function") navigator.clearAppBadge().catch(() => {});
					} catch { /* ignore */ }
				},
				PLUGIN_ID + ": badge cleanup"
			);
			publishDiag();

			// ---- 模拟入口（仅驱动本插件的本地处理函数，不触碰真实会话/审批） ----
			// 控制台：__NOTIFIER_SIM__.help
			var SIM_SID = "sim-notifier";
			try {
				window.__NOTIFIER_SIM__ = {
					sid: SIM_SID,
					/** 模拟待处理审批/提问：提示音 + 徽标 + dock + toast + OS 通知 */
					pending(lane, text) {
						var l = lane === "question" ? "question" : "approval";
						var request =
							l === "approval"
								? { toolName: "bash", reason: text || "模拟：等待审批演练" }
								: { questions: [{ question: text || "模拟：这是一个测试提问" }] };
						observePending(l, { id: SIM_SID }, request);
						return "pending(" + l + ") 已触发。要试 idle() 请先 clear()——回合结束提醒在有待处理项时会被正确抑制。";
					},
					/** 清除模拟待处理（徽标/中心同步回落） */
					clear() {
						clearSessionPending(SIM_SID);
						return "模拟待处理已清除";
					},
					/** 模拟回合结束（running true→false）；有待处理项时按设计静默 */
					idle() {
						onSessionIdle(SIM_SID);
						return "idle 已触发（若有待处理项则被抑制，先 clear()）";
					},
					/** 模拟会话异常 */
					error(message) {
						onSessionError(SIM_SID, message || "模拟：会话运行异常演练");
						return "error 已触发";
					},
					/** 模拟连接恢复 toast */
					reconnect() {
						note("reconnect");
						if (cfg.connection && !quietActive()) addToast({ kind: "info", title: "连接已恢复", body: "与 dsh 宿主的连接重新建立（模拟）" });
						return "reconnect 已触发";
					},
					/** 清空模拟产生的全部本地状态 */
					reset() {
						pendings.clear();
						toasts.length = 0;
						updateBadge();
						notifyStore();
						return "已重置（待处理/中心/徽标清空）";
					},
					help: "pending() → clear() → idle()；error(msg)；reconnect()；reset()。注意：同类提醒受 cooldownMs 冷却；免打扰时段内只静默更新徽标与通知中心；OS 通知需先在卡片里申请权限。模拟条目的「前往」不会真的打开会话。"
				};
			} catch { /* 模拟入口尽力而为 */ }
		}

		module.exports = {
			apply: apply,
			inject: inject,
			__diagnostics: diag
		};
		return module.exports;
	}
});
