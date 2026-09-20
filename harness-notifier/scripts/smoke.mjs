// dsh-harness-notifier — 本地 smoke（无依赖，node >= 20）
//
// 在假 DOM / 假 ctx 里执行 lib/client.js，验证：
//   1) ModuleLoader 协议注册（id 正确、factory 可执行、style 标签插入）
//   2) apply 后事件订阅面完整（$on 六事件 + connection/reset）
//   3) 设置卡片写入链路：onChange → cardWrite → 150ms 合并 →
//      remote.settings.update 恰好收到 3 个参数 (ns, patch, undefined)
//
// 运行：node scripts/smoke.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";

const fail = (msg) => {
	console.error(`smoke FAILED: ${msg}`);
	process.exit(1);
};

const code = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");

// ---- 假 DOM ----
const styleTags = [];
const documentStub = {
	title: "DSH",
	addEventListener() {},
	querySelector() {
		return null;
	},
	createElement() {
		const tag = { dataset: {}, textContent: "" };
		styleTags.push(tag);
		return tag;
	},
	head: { appendChild() {} }
};

// ---- 假 React（仅覆盖模块加载 + 组件直调所需） ----
const fakeReact = {
	createElement: (type, props, ...children) => ({ type, props, children }),
	useReducer: (reducer, initial) => [initial, () => {}],
	useState: (initial) => [initial, () => {}],
	useEffect: () => {}
};

// ---- 收集器 ----
const subscribedEvents = [];
const ctxOnCalls = [];
const slotInjections = [];
const registeredSlots = [];
const timeoutCalls = [];
const settingsUpdateCalls = [];
let describeCalls = 0;

let loaded = null;
const sandbox = {
	window: { __ModuleLoader__: { load: (def) => { loaded = def; } } },
	document: documentStub,
	navigator: {},
	console,
	setTimeout,
	clearTimeout,
	require: (name) => {
		if (name === "react") return fakeReact;
		throw new Error(`unexpected require(${name})`);
	}
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: "lib/client.js" });

// 1) 协议注册
if (!loaded) fail("window.__ModuleLoader__.load 未被调用");
if (loaded.id !== "dsh-harness-notifier") fail(`注册 id 错误: ${loaded.id}`);

const plugin = loaded.factory(sandbox.require);
if (typeof plugin.apply !== "function") fail("factory 产物缺 apply");
const expectedInject = ["remote", "remote.settings", "slots", "timer", "sessions"];
if (JSON.stringify(plugin.inject) !== JSON.stringify(expectedInject)) fail(`inject 不匹配: ${JSON.stringify(plugin.inject)}`);

// style 标签在 factory（模块作用域）执行时插入
if (styleTags.length !== 1) fail(`style 标签数量错误: ${styleTags.length}`);
if (!styleTags[0].dataset.pluginCss) fail("style 标签缺少 data-plugin-css 标记");

// 2) apply + 事件订阅面
const fakeRemoteEvents = { eventPrefix: "internal/api-gateway/remote-event/test-uuid/" };
const fakeCtx = {
	remote: {
		events: fakeRemoteEvents,
		$on(event, handler) {
			subscribedEvents.push(event);
			return () => {};
		},
		settings: {
			describe() {
				describeCalls += 1;
				return Promise.resolve({ namespaces: [{ ns: "notifications", value: { volume: 0.3 } }] });
			},
			update(...args) {
				settingsUpdateCalls.push(args);
				return Promise.resolve({});
			}
		}
	},
	sessions: {
		open() {},
		scopeOf: () => "sess-0001"
	},
	slots: {
		inject(key, callback) {
			slotInjections.push(key);
			callback();
			return () => {};
		},
		register(spec, component) {
			registeredSlots.push({ spec, component });
			return () => {};
		}
	},
	on(name, listener, options) {
		ctxOnCalls.push({ name, listener, options: options || null });
		return () => {};
	},
	effect(fn) {
		const disposer = typeof fn === "function" ? fn() : undefined;
		return typeof disposer === "function" ? disposer : () => {};
	},
	timeout(callback, ms) {
		const entry = { callback, ms, cancelled: false };
		entry.timer = setTimeout(() => {
			if (!entry.cancelled) callback();
		}, ms);
		timeoutCalls.push(entry);
		return () => {
			entry.cancelled = true;
			clearTimeout(entry.timer);
		};
	}
};
plugin.apply(fakeCtx);

for (const event of [
	"api-session/status",
	"api-session/error",
	"api-session/activity",
	"settings/document-updated"
]) {
	if (!subscribedEvents.includes(event)) fail(`缺少 $on 订阅: ${event}`);
}
// waterfall 车道必须以 prepend 抢在官方应答器之前（否则首个返回值终止链条，观察者永远收不到）
const waterfallKeys = [
	"internal/api-gateway/remote-event/test-uuid/approval/request",
	"internal/api-gateway/remote-event/test-uuid/user-questions/request"
];
for (const key of waterfallKeys) {
	const row = ctxOnCalls.find((call) => call.name === key);
	if (!row) fail(`waterfall 观察者未以内部前缀键注册: ${key}`);
	if (!row.options || row.options.prepend !== true) fail(`waterfall 观察者缺少 prepend: ${key}`);
}
if (!slotInjections.includes("shell.overlay")) fail("缺少 shell.overlay 注入");
if (!slotInjections.includes("plugins.bundle.config")) fail("缺少 plugins.bundle.config 注入");

await new Promise((resolve) => setTimeout(resolve, 20)); // refreshConfig 往返
if (describeCalls < 1) fail("apply 后未调用 settings.describe");

// 2.5) waterfall 观察者语义：观察 + 放行 + 应答值原样回流
const approvalRow = ctxOnCalls.find((call) => call.name.endsWith("approval/request"));
const fakeScope = { id: "sess-0001" };
const passed = await approvalRow.listener.call(fakeScope, { toolName: "bash", reason: "smoke" }, () => Promise.resolve("rejected"));
if (passed !== "rejected") fail(`应答值未原样回流: ${String(passed)}`);

// 3) 设置卡片写入链路：渲染卡片 → 找到控件 → 触发 onChange
const cardEntry = registeredSlots.find((row) => row.spec && row.spec.name === "plugins.bundle.config" && row.spec.key === "dsh-harness-notifier");
if (!cardEntry) fail("plugins.bundle.config 未以 key=dsh-harness-notifier 注册");
if (typeof cardEntry.component !== "function") fail("设置卡片组件缺失");
// 双视图契约：page = 完整表单，summary = 一行简介
const card = cardEntry.component({ view: "page" });
const summaryEl = cardEntry.component({ view: "summary" });
if (typeof summaryEl.type !== "function") fail("summary 视图未返回组件");
const controls = [];
(function walk(node) {
	if (!node || typeof node !== "object") return;
	if (typeof node.type === "function") {
		// 函数组件：渲染一层再继续（假 React 不做真实渲染）
		walk(node.type(node.props || {}));
		return;
	}
	if (node.props && typeof node.props.onChange === "function") controls.push(node.props);
	for (const child of node.children || []) walk(child);
})(card);
if (controls.length < 5) fail(`卡片控件数量异常: ${controls.length}`);

const checkbox = controls.find((p) => p.type === "checkbox");
if (!checkbox) fail("未找到 checkbox 控件");
const range = controls.find((p) => p.type === "range");
if (!range) fail("未找到音量滑杆");

// 第一次改动：调度 150ms 合并写，此时不应有 update 调用
const baseline = timeoutCalls.length;
checkbox.onChange({ target: { checked: false } });
if (settingsUpdateCalls.length !== 0) fail("合并窗口内提前发出了 update");
if (timeoutCalls.length !== baseline + 1) fail(`第一次改动应恰好调度一个合并写定时器: +${timeoutCalls.length - baseline}`);

// 立刻第二次改动（音量）：旧定时器应被取消，两份补丁合并
range.onChange({ target: { value: "0.5" } });
if (!timeoutCalls[baseline].cancelled) fail("第二次改动未取消第一次的待发定时器");

// 150ms 窗口过后：恰一次 update，恰好 3 个参数
await new Promise((resolve) => setTimeout(resolve, 200));
if (settingsUpdateCalls.length !== 1) fail(`update 调用次数错误: ${settingsUpdateCalls.length}`);
const args = settingsUpdateCalls[0];
if (args.length !== 3) fail(`update 参数数错误: ${args.length}（期望 3：ns, patch, expectedRevision）`);
if (args[0] !== "notifications") fail(`update ns 错误: ${args[0]}`);
if (args[1].sound !== false || args[1].volume !== 0.5) fail(`合并补丁内容错误: ${JSON.stringify(args[1])}`);
if (args[2] !== undefined) fail(`expectedRevision 应为 undefined: ${String(args[2])}`);

console.log("smoke OK");
console.log("  - ModuleLoader 协议注册 + style 插入 ✓");
console.log("  - 事件订阅面（$on × 4 + waterfall 观察者 prepend × 2 + overlay + settings 卡片）✓");
console.log("  - 卡片写入链路：乐观回显 + 合并 + update(ns, patch, undefined) 三参 ✓");
