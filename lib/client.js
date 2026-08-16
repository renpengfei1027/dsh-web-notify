window.__ModuleLoader__.load({
	id: "dsh-notifications",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  __diagnostics: () => diag,
  apply: () => apply,
  hostFeedCounters: () => hostFeedCounters,
  hostJobStatusCounts: () => hostJobStatusCounts,
  hostJobStatuses: () => hostJobStatuses,
  inject: () => inject,
  lastHeartbeatAt: () => lastHeartbeatAt,
  startAgentEvents: () => startAgentEvents
});
module.exports = __toCommonJS(index_exports);

// src/client/types.ts
var DEFAULTS = {
  sound: true,
  volume: 0.15,
  badge: true,
  toast: true,
  notify: true,
  dock: true,
  completion: true,
  completionSound: true,
  completionNotify: true,
  connection: true,
  connectionAlertAfterMs: 1e4,
  jobFailure: true,
  failureNotify: false,
  agentError: true,
  cooldownMs: 5e3,
  diagnostics: true,
  alertKinds: ["approval", "plan-review", "question"],
  quiet: { enabled: false, start: "23:00", end: "08:00" },
  soundResolved: false
};

// src/client/locales.ts
var NS = "notifications";
var zh = {
  "kind.approval": "\u5BA1\u6279",
  "kind.planReview": "\u8BA1\u5212\u5BA1\u6279",
  "kind.question": "\u63D0\u95EE",
  "toast.waiting": "\u7B49\u5F85\u5904\u7406",
  "toast.pending": "\u5F85\u5904\u7406",
  "toast.go": "\u53BB\u5904\u7406",
  "toast.dismiss": "\u5FFD\u7565",
  // OS-notification titles & bodies (per-event, so the system notification
  // tray at a glance reveals what happened — no more "completed needs action").
  "notify.pending.title": "DSH \u7B49\u5F85\u5904\u7406",
  "notify.pending.body": "\u4F1A\u8BDD\u300C{title}\u300D\u6709{kind}\u7B49\u5F85\u4F60\u7684\u5904\u7406",
  "notify.completion.title": "DSH \u4EFB\u52A1\u5B8C\u6210",
  "notify.completion.body": "\u4F1A\u8BDD\u300C{title}\u300D\u5DF2\u5B8C\u6210",
  "notify.failure.title": "DSH \u4EFB\u52A1\u5931\u8D25",
  "notify.failure.body": "\u4F1A\u8BDD\u300C{sessionTitle}\u300D\u7684\u4EFB\u52A1\u300C{label}\u300D\u5931\u8D25{detail}",
  "notify.error.title": "DSH \u4EFB\u52A1\u5F02\u5E38",
  "notify.error.body": "{kindLabel}{tool} \u2014 \u4F1A\u8BDD\u300C{title}\u300D{message}",
  "title.badge": "\u26A0 {count} \u5F85\u5BA1\u6279 \u2014 ",
  "dock.title": "\u901A\u77E5",
  "dock.close": "\u6536\u8D77",
  "dock.all": "\u5171 {count} \u9879\u5F85\u5904\u7406",
  "completion.title": "\u4EFB\u52A1\u5B8C\u6210",
  "completion.body": "\u4F1A\u8BDD\u300C{title}\u300D\u5DF2\u5B8C\u6210",
  "conn.lost": "\u8FDE\u63A5\u65AD\u5F00,\u6B63\u5728\u91CD\u8FDE",
  "conn.restored": "\u5DF2\u91CD\u65B0\u8FDE\u63A5",
  "job.failed": "\u4EFB\u52A1\u5931\u8D25",
  "job.body": "{label}{detail}",
  "agent.error": "\u4EFB\u52A1\u5F02\u5E38",
  "agent.error.tool": "\u5DE5\u5177\u6267\u884C\u5931\u8D25",
  "agent.error.turn": "\u4EFB\u52A1\u6267\u884C\u5931\u8D25",
  "agent.error.maxTokens": "\u8FBE\u5230\u8F93\u51FA\u4E0A\u9650",
  "agent.error.interrupted": "\u6267\u884C\u610F\u5916\u4E2D\u65AD",
  "agent.error.llmRetry": "\u6A21\u578B\u8BF7\u6C42\u5931\u8D25",
  "demo.title": "\u6F14\u793A\u5361\u7247",
  "demo.body": "\u4E00\u6B21\u6027\u4E8B\u4EF6\u5361\u7247(\u70B9\u300C\u5FFD\u7565\u300D\u5173\u95ED)",
  // ---- settings card (family-shared chrome copy) ----
  "settings.title": "\u901A\u77E5",
  "settings.description": "\u5BA1\u6279\u3001\u63D0\u95EE\u7B49\u5F85\u5904\u7406,\u4EE5\u53CA\u5B8C\u6210\u3001\u5931\u8D25\u3001\u65AD\u7EBF\u7684\u63D0\u9192\u65B9\u5F0F",
  "settings.collapse": "\u6536\u8D77",
  "settings.expand": "\u5C55\u5F00",
  "settings.notExposed": "\u8BBE\u7F6E\u670D\u52A1\u672A\u5F00\u653E\u8BE5\u547D\u540D\u7A7A\u95F4,\u5361\u7247\u4E0D\u53EF\u7F16\u8F91(\u9ED8\u8BA4\u914D\u7F6E\u751F\u6548)",
  "settings.unsaved": "\u672A\u4FDD\u5B58",
  "settings.readOnly": "\u5F53\u524D\u6587\u6863\u4E0D\u5141\u8BB8\u5199\u5165,\u5361\u7247\u53EA\u8BFB",
  "settings.saveFailed": "\u4FDD\u5B58\u672A\u751F\u6548,\u8BF7\u68C0\u67E5\u540E\u518D\u8BD5",
  "settings.discard": "\u4E22\u5F03",
  "settings.save": "\u4FDD\u5B58",
  "settings.saving": "\u4FDD\u5B58\u4E2D\u2026",
  "settings.overridden": "\u5DF2\u8986\u76D6",
  "settings.reset": "\u91CD\u7F6E",
  "settings.inherit": "\u7EE7\u627F",
  "settings.on": "\u5F00",
  "settings.off": "\u5173",
  "settings.invalidNumber": "\u65E0\u6548\u6570\u5B57",
  // ---- settings card fields ----
  "settings.field.sound": "\u63D0\u793A\u97F3",
  "settings.field.soundHint": "\u5F85\u5904\u7406\u4E8B\u9879\u5230\u8FBE\u65F6\u64AD\u653E\u63D0\u793A\u97F3",
  "settings.field.volume": "\u97F3\u91CF",
  "settings.field.volumeHint": "\u63D0\u793A\u97F3\u5927\u5C0F(0 \u9759\u97F3,1 \u6700\u5927)",
  "settings.field.badge": "\u6807\u7B7E\u9875\u6807\u9898\u5FBD\u6807",
  "settings.field.badgeHint": "\u5F85\u5904\u7406\u65F6\u5728\u6807\u7B7E\u9875\u6807\u9898\u663E\u793A \u26A0 \u8BA1\u6570;\u5B89\u88C5\u4E3A PWA \u540E\u7CFB\u7EDF\u56FE\u6807\u540C\u6B65\u663E\u793A",
  "settings.field.toast": "\u4E00\u6B21\u6027\u4E8B\u4EF6\u5361\u7247",
  "settings.field.toastHint": "\u5B8C\u6210/\u5931\u8D25/\u65AD\u7EBF\u7B49\u4E00\u6B21\u6027\u4E8B\u4EF6\u7684\u53F3\u4E0B\u89D2\u8F7B\u63D0\u793A",
  "settings.field.notify": "OS \u901A\u77E5",
  "settings.field.notifyHint": "\u9700\u6D4F\u89C8\u5668\u5141\u8BB8 127.0.0.1 \u53D1\u9001\u901A\u77E5",
  "settings.field.dock": "\u901A\u77E5 Dock",
  "settings.field.dockHint": "\u5F85\u5904\u7406\u9879\u7EDF\u4E00\u6536\u8FDB\u53F3\u4E0B\u89D2 Dock,\u4E0D\u518D\u9010\u6761\u5F39\u5361\u7247",
  "settings.field.completion": "\u2460 \u5B8C\u6210\u63D0\u9192",
  "settings.field.completionHint": "\u4F1A\u8BDD/\u5B50\u4EE3\u7406\u5B8C\u6210\u65F6\u63D0\u9192",
  "settings.field.completionSound": "\u5B8C\u6210\u63D0\u793A\u97F3",
  "settings.field.completionSoundHint": "\u5B8C\u6210\u4E8B\u4EF6\u540C\u65F6\u64AD\u653E\u63D0\u793A\u97F3",
  "settings.field.completionNotify": "\u5B8C\u6210\u8D70 OS \u901A\u77E5",
  "settings.field.completionNotifyHint": "\u5B8C\u6210\u4E8B\u4EF6\u540C\u65F6\u53D1 OS \u901A\u77E5",
  "settings.field.connection": "\u2461 \u6389\u7EBF/\u91CD\u8FDE\u63D0\u9192",
  "settings.field.connectionHint": "\u65AD\u7EBF\u8D85\u8FC7\u9608\u503C\u540E\u63D0\u9192,\u6062\u590D\u65F6\u8F7B\u63D0\u793A",
  "settings.field.connectionAlertAfterMs": "\u65AD\u7EBF\u63D0\u9192\u9608\u503C",
  "settings.field.connectionAlertAfterMsHint": "\u65AD\u7EBF\u6301\u7EED\u8D85\u8FC7\u8BE5\u6BEB\u79D2\u6570\u624D\u63D0\u9192",
  "settings.field.jobFailure": "\u2462 \u4EFB\u52A1\u5931\u8D25\u63D0\u9192",
  "settings.field.jobFailureHint": "\u540E\u53F0\u4EFB\u52A1\u975E\u96F6\u9000\u51FA\u6216\u4E2D\u65AD\u65F6\u63D0\u9192",
  "settings.field.failureNotify": "\u5931\u8D25/\u5F02\u5E38\u8D70 OS \u901A\u77E5",
  "settings.field.failureNotifyHint": "\u2462 \u4EFB\u52A1\u5931\u8D25\u4E0E \u2463 \u4EFB\u52A1\u5F02\u5E38\u5171\u7528\u4E00\u4E2A\u7CFB\u7EDF\u901A\u77E5\u5F00\u5173",
  "settings.field.agentError": "\u2463 \u4EFB\u52A1\u5F02\u5E38\u63D0\u9192",
  "settings.field.agentErrorHint": "\u6A21\u578B/\u5DE5\u5177\u8FD0\u884C\u5F02\u5E38:429 \u914D\u989D\u8D85\u9650\u3001\u8FBE\u5230\u8F93\u51FA\u4E0A\u9650\u3001\u6267\u884C\u4E2D\u65AD\u3001\u5DE5\u5177\u6267\u884C\u5931\u8D25",
  "settings.field.cooldownMs": "\u540C\u4F1A\u8BDD\u53BB\u91CD\u51B7\u5374",
  "settings.field.cooldownMsHint": "\u540C\u4E00\u4F1A\u8BDD\u540C\u4E00\u7C7B\u4E8B\u4EF6\u5728\u6B64\u95F4\u9694\u5185\u53EA\u63D0\u9192\u4E00\u6B21",
  "settings.field.diagnostics": "on-device \u89C2\u6D4B\u4EEA",
  "settings.field.diagnosticsHint": "\u91C7\u6837\u6700\u8FD1 60 \u6B21\u4F1A\u8BDD\u5FEB\u7167(\u542B job \u72B6\u6001),\u7528\u4E8E\u6392\u67E5;\u72B6\u6001\u96C6\u5408\u59CB\u7EC8\u81EA\u52A8\u6536\u96C6"
};
var en = {
  "kind.approval": "approval",
  "kind.planReview": "plan review",
  "kind.question": "question",
  "toast.waiting": "waiting",
  "toast.pending": "pending",
  "toast.go": "Handle",
  "toast.dismiss": "Dismiss",
  "notify.pending.title": "DSH action required",
  "notify.pending.body": "{kind} is waiting in session \u201C{title}\u201D",
  "notify.completion.title": "DSH task done",
  "notify.completion.body": "Session \u201C{title}\u201D has completed",
  "notify.failure.title": "DSH task failed",
  "notify.failure.body": "Task \u201C{label}\u201D in \u201C{sessionTitle}\u201D failed{detail}",
  "notify.error.title": "DSH task error",
  "notify.error.body": "{kindLabel}{tool} \u2014 \u201C{title}\u201D{message}",
  "title.badge": "\u26A0 {count} approval pending \u2014 ",
  "dock.title": "Notifications",
  "dock.close": "Close",
  "dock.all": "{count} pending total",
  "completion.title": "Done",
  "completion.body": "Session \u201C{title}\u201D finished",
  "conn.lost": "Connection lost \u2014 reconnecting",
  "conn.restored": "Reconnected",
  "job.failed": "Task failed",
  "job.body": "{label}{detail}",
  "agent.error": "Task error",
  "agent.error.tool": "Tool failed",
  "agent.error.turn": "Turn failed",
  "agent.error.maxTokens": "Output limit reached",
  "agent.error.interrupted": "Interrupted unexpectedly",
  "agent.error.llmRetry": "Model request failed",
  "demo.title": "Demo card",
  "demo.body": "One-shot event card (tap \u201CDismiss\u201D)",
  // ---- settings card (family-shared chrome copy) ----
  "settings.title": "Notifications",
  "settings.description": "How the GUI alerts you about pending approvals/questions, and about completions, job failures and disconnects",
  "settings.collapse": "Collapse",
  "settings.expand": "Expand",
  "settings.notExposed": "This settings namespace is not exposed; the card is read-only (defaults apply)",
  "settings.unsaved": "unsaved",
  "settings.readOnly": "Read-only: this document does not accept writes",
  "settings.saveFailed": "Save did not land \u2014 check your values",
  "settings.discard": "Discard",
  "settings.save": "Save",
  "settings.saving": "Saving\u2026",
  "settings.overridden": "overridden",
  "settings.reset": "Reset",
  "settings.inherit": "inherit",
  "settings.on": "On",
  "settings.off": "Off",
  "settings.invalidNumber": "invalid number",
  // ---- settings card fields ----
  "settings.field.sound": "Chime",
  "settings.field.soundHint": "Plays a chime when something needs attention",
  "settings.field.volume": "Volume",
  "settings.field.volumeHint": "Chime loudness (0 silent, 1 loudest)",
  "settings.field.badge": "Title badge",
  "settings.field.badgeHint": "Shows a \u26A0 count in the tab title while pending; synced to the app icon when installed as a PWA",
  "settings.field.toast": "One-shot event toasts",
  "settings.field.toastHint": "Corner toasts for one-shot events: completion, failure, disconnect",
  "settings.field.notify": "OS notifications",
  "settings.field.notifyHint": "Requires the browser to allow 127.0.0.1 notifications",
  "settings.field.dock": "Notifications dock",
  "settings.field.dockHint": "Pending items collect in the corner dock instead of one toast each",
  "settings.field.completion": "\u2460 Completion alerts",
  "settings.field.completionHint": "Alerts when a session or subagent finishes",
  "settings.field.completionSound": "Completion chime",
  "settings.field.completionSoundHint": "Also plays a chime on completion",
  "settings.field.completionNotify": "Completions via OS notify",
  "settings.field.completionNotifyHint": "Also sends an OS notification on completion",
  "settings.field.connection": "\u2461 Disconnect/reconnect",
  "settings.field.connectionHint": "Alerts once the outage exceeds the threshold; a light cue on restore",
  "settings.field.connectionAlertAfterMs": "Disconnect threshold",
  "settings.field.connectionAlertAfterMsHint": "Milliseconds of outage before alerting",
  "settings.field.jobFailure": "\u2462 Job-failure alerts",
  "settings.field.jobFailureHint": "Alerts when a background job exits non-zero or is interrupted",
  "settings.field.failureNotify": "Failures/errors via OS notify",
  "settings.field.failureNotifyHint": "One shared OS-notify switch for \u2462 failures and \u2463 runtime errors",
  "settings.field.agentError": "\u2463 Model/tool error alerts",
  "settings.field.agentErrorHint": "Model/tool runtime errors: 429 quota, output limit, interruption, tool failure",
  "settings.field.cooldownMs": "Per-session cooldown",
  "settings.field.cooldownMsHint": "One alert per session per event kind within this interval",
  "settings.field.diagnostics": "On-device observer",
  "settings.field.diagnosticsHint": "Samples the last 60 session snapshots (incl. job status) for diagnosis; the status set is always collected"
};
var dict = zh;
function pickDict() {
  const lang = typeof navigator !== "undefined" ? navigator.language : "";
  return String(lang).toLowerCase().startsWith("en") ? en : zh;
}
function setDict(next) {
  dict = next;
}
function t(key, vars) {
  let text = dict[key] ?? key;
  if (vars !== void 0) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}

// src/client/channels.ts
var KIND_LABEL = {
  approval: () => t("kind.approval"),
  "plan-review": () => t("kind.planReview"),
  question: () => t("kind.question")
};
function kindLabel(kind) {
  return (KIND_LABEL[kind] ?? (() => kind))();
}
function audioContext() {
  const w = typeof window === "undefined" ? void 0 : window;
  const AC = w?.["AudioContext"] ?? w?.["webkitAudioContext"];
  if (typeof AC !== "function") return void 0;
  try {
    const ac = new AC();
    if (ac.state === "suspended") void ac.resume().catch(() => {
    });
    return ac;
  } catch {
    return void 0;
  }
}
function playChime(volume) {
  const ac = audioContext();
  if (ac === void 0) return;
  try {
    const notes = [659.25, 783.99, 987.77];
    const t0 = ac.currentTime + 0.02;
    notes.forEach((freq, index) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = t0 + index * 0.12;
      gain.gain.setValueAtTime(1e-4, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(2e-4, volume), start + 0.02);
      gain.gain.exponentialRampToValueAtTime(1e-4, start + 0.28);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  } catch {
  }
}
function playResolvedCue(volume) {
  const ac = audioContext();
  if (ac === void 0) return;
  try {
    const notes = [783.99, 659.25];
    const t0 = ac.currentTime + 0.02;
    notes.forEach((freq, index) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = t0 + index * 0.1;
      gain.gain.setValueAtTime(1e-4, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(2e-4, volume * 0.6), start + 0.02);
      gain.gain.exponentialRampToValueAtTime(1e-4, start + 0.22);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(start);
      osc.stop(start + 0.25);
    });
  } catch {
  }
}
function playDoneCue(volume) {
  const ac = audioContext();
  if (ac === void 0) return;
  try {
    const freq = 659.25;
    const t0 = ac.currentTime + 0.02;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(1e-4, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(2e-4, volume * 0.5), t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(1e-4, t0 + 0.3);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + 0.35);
  } catch {
  }
}
function inQuiet(cfg) {
  if (cfg.quiet?.enabled !== true) return false;
  const d = /* @__PURE__ */ new Date();
  const nowMin = d.getHours() * 60 + d.getMinutes();
  const parse = (value, fallback) => {
    const parts = String(value ?? fallback).split(":").map(Number);
    return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  };
  const startMin = parse(cfg.quiet.start, "23:00");
  const endMin = parse(cfg.quiet.end, "08:00");
  return startMin <= endMin ? nowMin >= startMin && nowMin < endMin : nowMin >= startMin || nowMin < endMin;
}
function jumpToSession(sessions, sid) {
  try {
    window.focus();
  } catch {
  }
  if (sessions !== void 0 && sid !== "") try {
    sessions.open(sid);
  } catch {
  }
}
function notifyOs(row, notifTitle, notifBody, opts) {
  if (!("Notification" in window)) return;
  const tag = "dsh-notifications:" + row.id;
  const attach = (n) => {
    const onClick = opts?.onClick;
    if (typeof onClick === "function") {
      try {
        n.onclick = (ev) => {
          ev.preventDefault();
          try {
            n.close();
          } catch {
          }
          try {
            onClick();
          } catch {
          }
        };
      } catch {
      }
    }
  };
  const fire = () => {
    try {
      const n = new Notification(notifTitle, {
        body: notifBody,
        tag,
        silent: false,
        requireInteraction: opts?.requireInteraction === true
      });
      attach(n);
    } catch {
    }
  };
  if (Notification.permission === "granted") fire();
  else if (Notification.permission === "default") {
    const request = () => {
      window.removeEventListener("pointerdown", request);
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") fire();
      });
    };
    window.addEventListener("pointerdown", request, { once: true });
  }
}
function pulseCompletionTab(title, durationMs = 5e3) {
  try {
    const marker = `\u2713 ${title} \u2014 `;
    const restore = () => {
      try {
        if (typeof document !== "undefined" && document.title.startsWith(marker)) {
          document.title = document.title.slice(marker.length);
        }
      } catch {
      }
    };
    if (typeof document !== "undefined") {
      const base = document.title.replace(/^✓ [^—]*— /, "");
      document.title = `${marker}${base}`;
      setTimeout(restore, durationMs);
    }
    const nav = typeof navigator !== "undefined" ? navigator : void 0;
    try {
      void nav?.setAppBadge?.(1);
    } catch {
    }
    const clearBadge = () => {
      try {
        void nav?.clearAppBadge?.();
      } catch {
      }
    };
    setTimeout(clearBadge, durationMs);
  } catch {
  }
}

// src/client/stores.ts
function createToastStore() {
  let items = [];
  const listeners = /* @__PURE__ */ new Set();
  const emit = () => {
    for (const fn of [...listeners]) try {
      fn();
    } catch {
    }
  };
  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getSnapshot() {
      return items;
    },
    push(item) {
      items = [...items, item];
      emit();
    },
    remove(key) {
      if (!items.some((item) => item.key === key)) return;
      items = items.filter((item) => item.key !== key);
      emit();
    },
    clearSession(sessionId) {
      const next = items.filter((item) => item.sessionId !== sessionId);
      if (next.length === items.length) return;
      items = next;
      emit();
    }
  };
}
function createDockStore() {
  let state = { rows: [], pulse: 0 };
  const listeners = /* @__PURE__ */ new Set();
  const emit = () => {
    for (const fn of [...listeners]) try {
      fn();
    } catch {
    }
  };
  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getSnapshot() {
      return state;
    },
    replace(rows) {
      state = { rows, pulse: state.pulse };
      emit();
    },
    pulse() {
      state = { ...state, pulse: state.pulse + 1 };
      emit();
    }
  };
}

// src/client/toast-mount.tsx
var import_client = require("react-dom/client");
var import_jsx_runtime2 = require("react/jsx-runtime");

// src/client/toast-ui.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var TOAST_ROOT_ID = "dsh-notifications-root";
var CARD_STYLE = {
  boxSizing: "border-box",
  pointerEvents: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  padding: "10px 12px",
  borderRadius: "12px",
  border: "1px solid var(--dsw-alias-state-warn-secondary)",
  background: "var(--dsw-specific-input-major)",
  boxShadow: "var(--dsw-shadow-lv2)",
  color: "var(--dsw-alias-label-primary)",
  fontFamily: "var(--ds-font-family)",
  fontSize: "13px",
  lineHeight: "18px"
};
var DOT_STYLE = {
  background: "var(--dsw-alias-state-warn-primary)",
  borderRadius: "50%",
  width: "8px",
  height: "8px",
  flexShrink: "0"
};
var ACTION_BTN_STYLE = {
  cursor: "pointer",
  border: "none",
  borderRadius: "8px",
  padding: "4px 10px",
  fontFamily: "inherit",
  fontSize: "12px",
  lineHeight: "18px"
};
var VARIANT_ACCENT = {
  error: "var(--dsw-alias-label-error)",
  warning: "var(--dsw-alias-state-warn-primary)",
  done: "var(--dsw-alias-state-warn-secondary)",
  info: "var(--dsw-alias-state-warn-primary)"
};
var ACCENT = (item) => VARIANT_ACCENT[item.variant ?? "info"] ?? VARIANT_ACCENT.info;
function ToastCard({ item, onGo, onDismiss }) {
  const accent = ACCENT(item);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { ...CARD_STYLE, borderColor: accent }, role: "alert", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "8px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { ...DOT_STYLE, background: accent } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: accent, fontWeight: 600 }, children: item.kindLabel })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: item.title }),
    item.body !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { color: "var(--dsw-alias-label-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: item.body }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "2px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => onDismiss(item), title: t("toast.dismiss"), style: { ...ACTION_BTN_STYLE, color: "var(--dsw-alias-label-tertiary)", background: "transparent" }, children: t("toast.dismiss") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => onGo(item), title: t("toast.go"), style: { ...ACTION_BTN_STYLE, color: "var(--dsw-alias-label-primary)", background: "var(--dsw-alias-interactive-bg-hover)" }, children: t("toast.go") })
    ] })
  ] });
}
function ToastStack({ store, onGo, onDismiss }) {
  const items = (0, import_react.useSyncExternalStore)(store.subscribe, store.getSnapshot);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        position: "fixed",
        top: "64px",
        right: "16px",
        zIndex: 2147483e3,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        width: "min(340px, calc(100vw - 32px))",
        pointerEvents: "none"
      },
      "aria-live": "polite",
      children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToastCard, { item, onGo, onDismiss }, item.key))
    }
  );
}

// src/client/toast-mount.tsx
function mountToasts(store, actions) {
  let rootEl = document.getElementById(TOAST_ROOT_ID);
  if (rootEl === null) {
    rootEl = document.createElement("div");
    rootEl.id = TOAST_ROOT_ID;
    document.body.appendChild(rootEl);
  }
  const reactRoot = (0, import_client.createRoot)(rootEl);
  reactRoot.render((0, import_jsx_runtime2.jsx)(ToastStack, { store, onGo: actions.go, onDismiss: actions.dismiss }, void 0));
  return () => {
    reactRoot.unmount();
    const el = document.getElementById(TOAST_ROOT_ID);
    if (el !== null && el.childNodes.length === 0) el.remove();
  };
}

// src/client/badge.ts
var BADGE_RE = /^⚠\s*\d+\s*(?:待审批|approval pending)\s*—\s*/i;
function installTitleBadge() {
  let pendingCount = 0;
  let selfWriteAt = 0;
  let observer = null;
  let titleEl;
  const ensureTitle = () => {
    if (titleEl === void 0 || !document.contains(titleEl)) {
      titleEl = document.querySelector("title") ?? (() => {
        const el = document.createElement("title");
        document.head.appendChild(el);
        return el;
      })();
    }
    return titleEl;
  };
  const apply2 = () => {
    const node = ensureTitle();
    const raw = node.textContent ?? "";
    if (pendingCount > 0) {
      const badge = t("title.badge", { count: pendingCount });
      if (!raw.startsWith(badge)) {
        selfWriteAt = Date.now();
        node.textContent = badge + raw.replace(BADGE_RE, "");
      }
    } else if (BADGE_RE.test(raw)) {
      selfWriteAt = Date.now();
      node.textContent = raw.replace(BADGE_RE, "");
    }
  };
  observer = new MutationObserver(() => {
    if (Date.now() - selfWriteAt < 50) return;
    if (pendingCount > 0) apply2();
    else if (BADGE_RE.test(document.title)) apply2();
  });
  observer.observe(document.head, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["data-t"] });
  return {
    setCount(count) {
      pendingCount = count;
      apply2();
    },
    dispose() {
      observer?.disconnect();
      if (BADGE_RE.test(document.title)) {
        selfWriteAt = Date.now();
        document.title = document.title.replace(BADGE_RE, "");
      }
    }
  };
}
function updateAppBadge(count) {
  const nav = typeof navigator === "undefined" ? void 0 : navigator;
  if (nav === void 0 || typeof nav["setAppBadge"] !== "function") return;
  try {
    if (count > 0) {
      void nav["setAppBadge"](count);
    } else if (typeof nav["clearAppBadge"] === "function") {
      void nav["clearAppBadge"]();
    } else {
      void nav["setAppBadge"](0);
    }
  } catch {
  }
}
function faviconDomAvailable() {
  if (typeof document === "undefined") return false;
  if (typeof document.querySelectorAll !== "function") return false;
  if (typeof document.createElement !== "function") return false;
  try {
    const c = document.createElement("canvas");
    if (typeof c.getContext !== "function" || c.getContext("2d") === null) return false;
  } catch {
    return false;
  }
  return typeof document.head !== "undefined" && document.head !== null;
}
function ensureIconLink() {
  const existing = document.querySelectorAll('link[rel~="icon"]');
  let noSizes;
  let tabSize;
  let any;
  for (let i = 0; i < existing.length; i++) {
    const el2 = existing.item(i);
    if (el2 === null) continue;
    any = any ?? el2;
    const sizes = el2.getAttribute("sizes") ?? "";
    if (sizes === "") {
      noSizes = noSizes ?? el2;
      continue;
    }
    if (sizes.includes("16") || sizes.includes("32")) {
      tabSize = tabSize ?? el2;
      continue;
    }
  }
  const best = noSizes ?? tabSize ?? any;
  if (best !== void 0) return best;
  const el = document.createElement("link");
  el.rel = "icon";
  el.type = "image/png";
  document.head.appendChild(el);
  return el;
}
var FAVICON_SIZE = 32;
var FAVICON_MAX_DIGIT = 9;
var FAVICON_BADGE_INSET = 10;
var FAVICON_BADGE_R_NUM = 9;
var FAVICON_BADGE_R_DOT = 7;
var FAVICON_BADGE_STROKE = 1;
var FAVICON_BADGE_FONT = "bold 12px system-ui, -apple-system, Segoe UI, sans-serif";
var FAVICON_TEXT_NUDGE = 0.5;
var FAVICON_BADGE_FILL = "#e53935";
var FAVICON_BADGE_STROKE_COLOR = "rgba(255,255,255,0.85)";
var FAVICON_BADGE_TEXT_COLOR = "#ffffff";
function drawFavicon(count) {
  const SIZE = FAVICON_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, SIZE, SIZE);
  const cx = SIZE - FAVICON_BADGE_INSET;
  const cy = SIZE - FAVICON_BADGE_INSET;
  const r = count > FAVICON_MAX_DIGIT ? FAVICON_BADGE_R_DOT : FAVICON_BADGE_R_NUM;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = FAVICON_BADGE_FILL;
  ctx.fill();
  ctx.lineWidth = FAVICON_BADGE_STROKE;
  ctx.strokeStyle = FAVICON_BADGE_STROKE_COLOR;
  ctx.stroke();
  if (count <= FAVICON_MAX_DIGIT) {
    ctx.fillStyle = FAVICON_BADGE_TEXT_COLOR;
    ctx.font = FAVICON_BADGE_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(count), cx, cy + FAVICON_TEXT_NUDGE);
  }
  return canvas.toDataURL("image/png");
}
function installFaviconBadge() {
  if (!faviconDomAvailable()) {
    return { setCount: () => {
    }, dispose: () => {
    } };
  }
  let ownCount = 0;
  const link = ensureIconLink();
  const originalHref = link.getAttribute("href") ?? null;
  const dataUrlCache = /* @__PURE__ */ new Map();
  const apply2 = () => {
    try {
      if (ownCount <= 0) {
        if (originalHref !== null) link.setAttribute("href", originalHref);
        else link.removeAttribute("href");
        return;
      }
      let url = dataUrlCache.get(ownCount);
      if (url === void 0) {
        url = drawFavicon(ownCount);
        dataUrlCache.set(ownCount, url);
      }
      link.setAttribute("href", url);
    } catch {
    }
  };
  return {
    setCount(count) {
      const c = Math.max(0, Math.floor(count));
      if (c === ownCount) return;
      ownCount = c;
      apply2();
    },
    dispose() {
      try {
        if (originalHref !== null) link.setAttribute("href", originalHref);
        else link.removeAttribute("href");
      } catch {
      }
      dataUrlCache.clear();
    }
  };
}

// src/client/sentinel.ts
function startSentinel(sessions, cfg, channels) {
  const previous = /* @__PURE__ */ new Map();
  const firedAt = /* @__PURE__ */ new Map();
  let seeded = false;
  let pendingTotal = 0;
  const titleBadge = cfg.badge ? installTitleBadge() : null;
  const faviconBadge = cfg.badge ? installFaviconBadge() : null;
  const refreshTitle = () => {
    titleBadge?.setCount(pendingTotal);
    faviconBadge?.setCount(pendingTotal);
    updateAppBadge(pendingTotal);
  };
  const onAlert = (row, kind, silenced) => {
    if (silenced !== true) {
      if (cfg.sound && !inQuiet(cfg)) playChime(cfg.volume);
      if (cfg.notify) {
        const title = row.displayTitle ?? row.id;
        notifyOs(row, t("notify.pending.title"), t("notify.pending.body", { title, kind: kindLabel(kind) }), {
          requireInteraction: kind === "approval",
          onClick: () => jumpToSession(sessions, row.id)
        });
      }
    }
    channels.onArrive?.();
    refreshTitle();
  };
  const onResolved = () => {
    if (cfg.soundResolved && !inQuiet(cfg)) playResolvedCue(cfg.volume);
    refreshTitle();
  };
  const reconcile = () => {
    const snapshot = sessions.list.getSnapshot();
    const next = /* @__PURE__ */ new Map();
    for (const sid of snapshot.ids) {
      const row = snapshot.byId[sid];
      if (row === void 0) continue;
      const interaction = row.pendingInteraction;
      if (interaction !== void 0 && cfg.alertKinds.includes(interaction)) next.set(sid, interaction);
    }
    if (!seeded) {
      seeded = true;
      pendingTotal = next.size;
      if (pendingTotal > 0) for (const [sid, kind] of next) previous.set(sid, kind);
      refreshTitle();
      return;
    }
    if (previous.size === 0 && next.size === 0) return;
    const now = Date.now();
    const pageVisible = typeof document !== "undefined" && document.visibilityState === "visible";
    const current = snapshot.current;
    for (const [sid, kind] of next) {
      if (previous.get(sid) === kind) continue;
      if (now - (firedAt.get(`${sid}:${kind}`) ?? 0) < cfg.cooldownMs) continue;
      firedAt.set(`${sid}:${kind}`, now);
      const silenced = pageVisible && current !== void 0 && sid === current;
      onAlert(snapshot.byId[sid], kind, silenced);
    }
    for (const [sid, kind] of previous) {
      if (next.get(sid) !== kind) onResolved();
    }
    previous.clear();
    if (next.size > 0) for (const [sid, kind] of next) previous.set(sid, kind);
    pendingTotal = next.size;
    refreshTitle();
  };
  const unsubscribe = sessions.list.subscribe(reconcile);
  reconcile();
  return () => {
    unsubscribe();
    titleBadge?.dispose();
    faviconBadge?.dispose();
    updateAppBadge(0);
  };
}

// src/client/dock.ts
var import_react2 = require("react");
var import_jsx_runtime3 = require("react/jsx-runtime");
var import_client2 = require("react-dom/client");
var DOCK_ROOT_ID = "dsh-notifications-dock-root";
var KIND_DOT = {
  approval: "var(--dsw-alias-state-warn-primary)",
  "plan-review": "var(--dsw-alias-state-business-primary)",
  question: "var(--dsw-alias-label-tertiary)"
};
var KIND_TEXT = KIND_DOT;
var PANEL_STYLE = {
  boxSizing: "border-box",
  position: "fixed",
  right: "16px",
  bottom: "78px",
  zIndex: "2147483000",
  display: "flex",
  flexDirection: "column",
  width: "min(360px, calc(100vw - 32px))",
  maxHeight: "60vh",
  borderRadius: "12px",
  border: "1px solid var(--dsw-alias-state-warn-secondary)",
  background: "var(--dsw-specific-input-major)",
  boxShadow: "var(--dsw-shadow-lv2)",
  color: "var(--dsw-alias-label-primary)",
  fontFamily: "var(--ds-font-family)",
  fontSize: "13px",
  lineHeight: "18px",
  padding: "10px 12px",
  gap: "4px"
};
var FAB_STYLE = {
  boxSizing: "border-box",
  position: "fixed",
  right: "16px",
  bottom: "20px",
  zIndex: "2147483000",
  cursor: "pointer",
  border: "none",
  borderRadius: "999px",
  minWidth: "48px",
  height: "48px",
  padding: "0 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  background: "var(--dsw-alias-state-warn-primary)",
  color: "var(--dsw-alias-state-warn-label)",
  fontFamily: "var(--ds-font-family)",
  fontSize: "14px",
  lineHeight: "20px",
  fontWeight: "700",
  boxShadow: "var(--dsw-shadow-lv2)"
};
function DockPanel({ store, onGo }) {
  const { rows, pulse } = (0, import_react2.useSyncExternalStore)(store.subscribe, store.getSnapshot);
  const [expanded, setExpanded] = (0, import_react2.useState)(false);
  const [pulsing, setPulsing] = (0, import_react2.useState)(false);
  (0, import_react2.useEffect)(() => {
    if (rows.length === 0) setExpanded(false);
  }, [rows.length]);
  (0, import_react2.useEffect)(() => {
    if (pulse === 0) return;
    setPulsing(true);
    const timer = setTimeout(() => setPulsing(false), 900);
    return () => clearTimeout(timer);
  }, [pulse]);
  if (rows.length === 0) return null;
  const count = rows.length;
  const fabStyle = pulsing ? { ...FAB_STYLE, transition: "box-shadow 0.25s ease", boxShadow: "0 0 0 3px var(--dsw-alias-state-warn-primary), var(--dsw-shadow-lv2)" } : FAB_STYLE;
  return (0, import_jsx_runtime3.jsxs)(import_react2.Fragment, {
    children: [
      (0, import_jsx_runtime3.jsx)("button", {
        type: "button",
        "aria-label": t("dock.title"),
        "aria-expanded": expanded,
        title: t("dock.title"),
        onClick: () => setExpanded(!expanded),
        style: fabStyle,
        children: [(0, import_jsx_runtime3.jsx)("span", { children: "\u26A0\uFE0F" }), (0, import_jsx_runtime3.jsx)("span", { children: count > 99 ? "99+" : String(count) })]
      }),
      expanded ? (0, import_jsx_runtime3.jsxs)("div", {
        style: PANEL_STYLE,
        "aria-label": t("dock.title"),
        children: [
          (0, import_jsx_runtime3.jsxs)("div", {
            style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", paddingBottom: "6px", borderBottom: "1px solid var(--dsw-alias-state-warn-secondary)" },
            children: [
              (0, import_jsx_runtime3.jsx)("span", { style: { fontWeight: 700, fontSize: "14px", lineHeight: "20px" }, children: t("dock.title") }),
              (0, import_jsx_runtime3.jsx)("span", { style: { color: "var(--dsw-alias-label-tertiary)", fontSize: "12px", lineHeight: "18px" }, children: t("dock.all", { count }) })
            ]
          }),
          rows.map((item) => (0, import_jsx_runtime3.jsxs)("div", {
            key: item.key,
            style: { display: "flex", alignItems: "center", gap: "8px", padding: "4px 0" },
            children: [
              (0, import_jsx_runtime3.jsx)("span", { style: { background: KIND_DOT[item.kind] ?? "var(--dsw-alias-label-tertiary)", borderRadius: "50%", width: "8px", height: "8px", flexShrink: 0 } }),
              (0, import_jsx_runtime3.jsx)("div", { style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: item.title }),
              (0, import_jsx_runtime3.jsx)("span", { style: { color: KIND_TEXT[item.kind] ?? "var(--dsw-alias-label-tertiary)", fontWeight: 600, flexShrink: 0 }, children: item.kindLabel }),
              (0, import_jsx_runtime3.jsx)("button", {
                type: "button",
                onClick: () => onGo(item),
                title: t("toast.go"),
                style: { ...ACTION_BTN_STYLE, color: "var(--dsw-alias-label-primary)", background: "var(--dsw-alias-interactive-bg-hover)", flexShrink: 0 },
                children: t("toast.go")
              })
            ]
          }, item.key))
        ]
      }) : null
    ]
  });
}
function mountDock(store, actions) {
  let rootEl = document.getElementById(DOCK_ROOT_ID);
  if (rootEl === null) {
    rootEl = document.createElement("div");
    rootEl.id = DOCK_ROOT_ID;
    document.body.appendChild(rootEl);
  }
  const reactRoot = (0, import_client2.createRoot)(rootEl);
  reactRoot.render((0, import_jsx_runtime3.jsx)(DockPanel, { store, onGo: actions.go }, void 0));
  return () => {
    reactRoot.unmount();
    const el = document.getElementById(DOCK_ROOT_ID);
    if (el !== null && el.childNodes.length === 0) el.remove();
  };
}
function startDock(dockStore, sessions, cfg) {
  const project = () => {
    const snapshot = sessions.list.getSnapshot();
    const rows = [];
    for (const sid of snapshot.ids) {
      const row = snapshot.byId[sid];
      if (row === void 0) continue;
      const kind = row.pendingInteraction;
      if (kind === void 0 || !cfg.alertKinds.includes(kind)) continue;
      rows.push({
        key: `${kind}:${sid}`,
        sessionId: sid,
        title: row.displayTitle ?? row.id,
        kind,
        kindLabel: kindLabel(kind),
        ts: typeof row.updatedAt === "number" && Number.isFinite(row.updatedAt) ? row.updatedAt : 0
      });
    }
    rows.sort((a, b) => b.ts - a.ts);
    dockStore.replace(rows);
  };
  const unsubscribe = sessions.list.subscribe(project);
  project();
  const unmount = mountDock(dockStore, {
    go: (item) => {
      try {
        sessions.open(item.sessionId);
      } catch (error) {
        console.warn("[notifications] open session", error);
      }
    }
  });
  return () => {
    unsubscribe();
    unmount();
  };
}

// src/client/lifecycle.ts
function pageHidden() {
  return typeof document === "undefined" || document.visibilityState !== "visible";
}
var completionFiredAt = /* @__PURE__ */ new Map();
function fireCompletion(cfg, channels, sid, displayTitle, sessions) {
  if (!cfg.completion || sid === "") return;
  const now = Date.now();
  if (now - (completionFiredAt.get(sid) ?? 0) < cfg.cooldownMs) return;
  const title = humanTitle(sid, void 0, displayTitle);
  completionFiredAt.set(sid, now);
  const gotoSession = () => jumpToSession(sessions, sid);
  if (pageHidden()) {
    pulseCompletionTab(title);
  } else if (cfg.toast) {
    channels.toast.push({
      key: `completion:${sid}`,
      sessionId: sid,
      title,
      kindLabel: t("completion.title"),
      ts: now,
      variant: "done"
    });
  }
  if (cfg.completionSound && cfg.sound && !inQuiet(cfg)) playDoneCue(cfg.volume);
  if (cfg.completionNotify && cfg.notify) notifyOs(
    { id: sid },
    t("notify.completion.title"),
    t("notify.completion.body", { title }),
    { onClick: gotoSession }
  );
}
function softCompletionCue(cfg) {
  if (!cfg.completion) return;
  if (!cfg.completionSound || !cfg.sound || inQuiet(cfg)) return;
  playDoneCue(cfg.volume);
}
var jobSamples = [];
var seenJobStatuses = /* @__PURE__ */ new Set();
var jobStatusCounts = {};
function recordSample(snapshot, alerts, collect) {
  const jobs = [];
  const jbs = snapshot.jobsBySession;
  if (jbs !== void 0 && jbs !== null) {
    for (const sid of Object.keys(jbs)) {
      for (const job of jbs[sid] ?? []) {
        if (job === null || typeof job !== "object") continue;
        const j = job;
        const status = String(j.status ?? "running");
        seenJobStatuses.add(status);
        jobStatusCounts[status] = (jobStatusCounts[status] ?? 0) + 1;
        const detail = typeof j.detail === "string" ? j.detail.slice(0, 140) : void 0;
        jobs.push({ sid, id: String(j.id ?? ""), status, detail });
      }
    }
  }
  if (!collect) return;
  const completedIds = snapshot.ids.filter((sid) => snapshot.byId[sid]?.completed === true);
  jobSamples.push({ t: Date.now(), completedIds, jobsBySessionKeys: jobs.map((j) => j.id), jobs, alerts });
  if (jobSamples.length > 60) jobSamples.shift();
}
function startLifecycleMonitor(sessions, cfg, channels) {
  const prevCompleted = /* @__PURE__ */ new Map();
  const prevJobs = /* @__PURE__ */ new Map();
  const alertedFailedJobs = /* @__PURE__ */ new Set();
  let seeded = false;
  const ANOMALY = /* @__PURE__ */ new Set(["failed", "killed"]);
  const ERROR_SIG = /quota|insufficient|rate\s*limit|429\b|\b429|timeout|timed\s*out|exception|unauthor|forbidden|access denied|refus|abort|connection failed|econnrefused|exit status|insufficient_quota/i;
  const detailAnomalous = (detail) => {
    if (typeof detail !== "string" || detail.length === 0) return false;
    return !/exit code:\s*0(\D|$)/i.test(detail);
  };
  const jobAnomalous = (job) => {
    const status = job.status ?? "running";
    if (ANOMALY.has(status)) return true;
    if (status !== "running") {
      if (typeof job.detail === "string" && detailAnomalous(job.detail)) return true;
      const hay = `${job.label ?? ""}\0${job.detail ?? ""}`;
      if (ERROR_SIG.test(hay)) return true;
    }
    return false;
  };
  const reconcile = () => {
    const snapshot = sessions.list.getSnapshot();
    const current = snapshot.current;
    const now = Date.now();
    const firedAlerts = [];
    const sids = new Set(snapshot.ids);
    if (snapshot.jobsBySession !== void 0) for (const key of Object.keys(snapshot.jobsBySession)) sids.add(key);
    if (!seeded) {
      seeded = true;
      for (const sid of sids) {
        const row = snapshot.byId[sid];
        if (row !== void 0) prevCompleted.set(sid, row.completed === true);
        const jobs = snapshot.jobsBySession?.[sid];
        if (jobs !== void 0 && jobs.length > 0) {
          const seed = /* @__PURE__ */ new Map();
          for (const job of jobs) {
            if (job === null || typeof job !== "object") continue;
            seed.set(job.id ?? "", job.status ?? "running");
          }
          prevJobs.set(sid, seed);
        }
      }
      recordSample(snapshot, firedAlerts, cfg.diagnostics);
      return;
    }
    for (const sid of sids) {
      const row = snapshot.byId[sid];
      if (row !== void 0) {
        const done = row.completed === true;
        const prevDone = prevCompleted.get(sid) === true;
        if (done && !prevDone) {
          if (sid !== current || pageHidden()) {
            fireCompletion(cfg, channels, sid, row.displayTitle, sessions);
          } else {
            softCompletionCue(cfg);
          }
        }
        prevCompleted.set(sid, done);
      }
      const jobs = snapshot.jobsBySession?.[sid] ?? void 0;
      if (jobs === void 0 || jobs.length === 0) {
        prevJobs.delete(sid);
        continue;
      }
      const prevMap = prevJobs.get(sid) ?? /* @__PURE__ */ new Map();
      const curMap = /* @__PURE__ */ new Map();
      for (const job of jobs) {
        if (job === null || typeof job !== "object") continue;
        const id = job.id ?? "";
        const status = job.status ?? "running";
        curMap.set(id, status);
        if (jobAnomalous(job) && prevMap.get(id) !== status && !alertedFailedJobs.has(id)) {
          alertedFailedJobs.add(id);
          firedAlerts.push(`jobfail:${id}`);
          const detail = typeof job.detail === "string" && job.detail.length > 0 ? " (" + job.detail + ")" : "";
          if (cfg.toast) {
            channels.toast.push({
              key: `jobfail:${id}`,
              sessionId: sid,
              title: row?.displayTitle ?? sid,
              kindLabel: t("job.failed"),
              body: t("job.body", { label: job.label ?? id, detail }),
              ts: now,
              variant: "error"
            });
          }
          if (cfg.sound && !inQuiet(cfg)) playResolvedCue(cfg.volume);
          if (cfg.failureNotify && cfg.notify) {
            const label = job.label ?? id;
            const sessionTitle = row?.displayTitle ?? sid;
            notifyOs(
              { id: sid },
              t("notify.failure.title"),
              t("notify.failure.body", { sessionTitle, label, detail }),
              {
                onClick: () => jumpToSession(sessions, sid)
              }
            );
          }
        }
      }
      prevJobs.set(sid, curMap);
    }
    recordSample(snapshot, firedAlerts, cfg.diagnostics);
  };
  const unsubscribe = sessions.list.subscribe(reconcile);
  reconcile();
  return () => {
    unsubscribe();
  };
}
var ALERTER_REMOTE_EVENT = "notifications/evt";
function humanTitle(sid, title, rowTitle) {
  if (title !== void 0 && title !== "") return title;
  if (rowTitle !== void 0 && rowTitle !== "") return rowTitle;
  const bare = sid.replace(/^session-/, "");
  return /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(bare) && bare.length > 20 ? `session ${bare.slice(0, 8)}` : sid;
}
var hostJobStatuses = /* @__PURE__ */ new Set();
var hostJobStatusCounts = {};
var hostFeedCounters = {};
var lastHeartbeatAt = 0;
var AGENT_ERROR_KIND_LABEL = {
  "tool-error": "agent.error.tool",
  "turn-error": "agent.error.turn",
  "turn-max-tokens": "agent.error.maxTokens",
  "turn-interrupted": "agent.error.interrupted",
  "llm-retry": "agent.error.llmRetry"
};
var agentErrorCooldownMs = 1e4;
var agentErrorFiredAt = /* @__PURE__ */ new Map();
function startAgentEvents(remote, cfg, channels, sessions) {
  const collectStatus = (payload) => {
    if (payload.type !== "job-status" || typeof payload.status !== "string" || payload.status === "") return;
    hostJobStatuses.add(payload.status);
    hostJobStatusCounts[payload.status] = (hostJobStatusCounts[payload.status] ?? 0) + 1;
  };
  const onFeed = (payload) => {
    try {
      if (payload === null || typeof payload !== "object") return;
      const event = payload;
      hostFeedCounters[String(event.type ?? "?")] = (hostFeedCounters[String(event.type ?? "?")] ?? 0) + 1;
      if (event.type === "heartbeat" && typeof event.ts === "number") lastHeartbeatAt = event.ts;
      if (event.type === "job-status") {
        collectStatus(event);
        return;
      }
      if (event.type === "agent-completed") {
        if (!cfg.completion) return;
        const sid2 = typeof event.sessionId === "string" ? event.sessionId : "";
        let current;
        let rowTitle;
        if (sessions !== void 0) {
          try {
            const snapshot = sessions.list.getSnapshot();
            current = snapshot.current;
            rowTitle = snapshot.byId[sid2]?.displayTitle;
          } catch {
          }
        }
        const silenced = !pageHidden() && current !== void 0 && sid2 !== "" && current === sid2;
        if (!silenced) {
          fireCompletion(cfg, channels, sid2, humanTitle(sid2, event.title, rowTitle), sessions);
        } else {
          softCompletionCue(cfg);
        }
        return;
      }
      if (event.type !== "agent-error") return;
      if (!cfg.agentError) return;
      const now = Date.now();
      const dedupeKey = `${event.sessionId ?? ""}:${event.kind ?? ""}`;
      if (now - (agentErrorFiredAt.get(dedupeKey) ?? 0) < agentErrorCooldownMs) return;
      agentErrorFiredAt.set(dedupeKey, now);
      const kindLabel2 = AGENT_ERROR_KIND_LABEL[event.kind ?? ""] ?? "agent.error";
      const tool = typeof event.tool === "string" && event.tool !== "" ? ` ${event.tool}` : "";
      const messageText = typeof event.message === "string" && event.message !== "" ? event.message : "";
      const message = messageText !== "" ? `: ${messageText}` : "";
      const title = humanTitle(event.sessionId ?? "", event.title);
      const sid = typeof event.sessionId === "string" ? event.sessionId : "";
      if (cfg.toast) {
        channels.toast.push({
          key: `agenterr:${event.ts ?? now}`,
          sessionId: event.sessionId,
          title,
          kindLabel: t(kindLabel2),
          body: t("agent.error") + tool + message,
          ts: now,
          variant: "error"
        });
      }
      if (cfg.sound && !inQuiet(cfg)) playResolvedCue(cfg.volume);
      if (cfg.failureNotify && cfg.notify) notifyOs(
        { id: event.sessionId ?? "" },
        t("notify.error.title"),
        t("notify.error.body", { kindLabel: t(kindLabel2), tool, title, message }),
        {
          onClick: () => jumpToSession(sessions, sid)
        }
      );
    } catch (error) {
      console.warn("[notifications] agent feed handler", error);
    }
  };
  if (typeof remote.$on !== "function") return () => {
  };
  const dispose = remote.$on(ALERTER_REMOTE_EVENT, onFeed);
  return () => {
    if (typeof dispose === "function") dispose();
  };
}
function startConnectionMonitor(conn, cfg, channels) {
  let phase = "boot";
  let lostAt = 0;
  let alerted = false;
  let timer = null;
  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
  const source = conn.hostDescription;
  const check = () => {
    const connected = source.getSnapshot() !== void 0;
    if (phase === "boot") {
      phase = connected ? "connected" : "boot";
      return;
    }
    if (connected) {
      if (phase === "reconnecting" && alerted) {
        if (cfg.toast) channels.toast.push({ key: "conn:up", sessionId: void 0, title: t("conn.restored"), kindLabel: t("conn.restored"), ts: Date.now(), variant: "done" });
        if (cfg.sound && !inQuiet(cfg)) playDoneCue(cfg.volume);
      }
      phase = "connected";
      alerted = false;
      lostAt = 0;
      clearTimer();
      return;
    }
    if (phase === "connected") {
      lostAt = Date.now();
      alerted = false;
    }
    if (!alerted && Date.now() - lostAt >= cfg.connectionAlertAfterMs) {
      alerted = true;
      clearTimer();
      if (cfg.toast) channels.toast.push({ key: "conn:down", sessionId: void 0, title: t("conn.lost"), kindLabel: t("conn.lost"), ts: Date.now(), variant: "warning" });
      if (cfg.sound && !inQuiet(cfg)) playChime(cfg.volume);
    } else if (timer === null) {
      timer = setTimeout(() => {
        timer = null;
        check();
      }, Math.max(1e3, cfg.connectionAlertAfterMs));
    }
    phase = "reconnecting";
  };
  const unsubscribe = typeof source.subscribe === "function" ? source.subscribe(check) : () => {
  };
  check();
  return () => {
    unsubscribe();
    clearTimer();
  };
}

// src/client/settings-card.tsx
var import_react3 = require("react");
var import_jsx_runtime4 = require("react/jsx-runtime");
var CARD_FIELDS = {
  sound: "boolean",
  volume: "number",
  badge: "boolean",
  toast: "boolean",
  notify: "boolean",
  dock: "boolean",
  completion: "boolean",
  completionSound: "boolean",
  completionNotify: "boolean",
  connection: "boolean",
  connectionAlertAfterMs: "number",
  jobFailure: "boolean",
  failureNotify: "boolean",
  agentError: "boolean",
  cooldownMs: "number",
  diagnostics: "boolean"
};
function createSettingsCardController(scope) {
  const staged = /* @__PURE__ */ new Map();
  const listeners = /* @__PURE__ */ new Set();
  let saving = false;
  let failed = false;
  const snap = () => scope.getSnapshot() ?? {};
  const valueOf = (field, layer) => {
    const record = snap()[layer];
    return record !== null && typeof record === "object" && Object.hasOwn(record, field) ? record[field] : void 0;
  };
  const format = (field) => {
    const v = valueOf(field, "value");
    return v === void 0 ? "" : String(v);
  };
  const baseOf = (field) => {
    const v = valueOf(field, "base");
    return v === void 0 ? "" : String(v);
  };
  const stored = (field) => {
    const u = snap().user;
    return u !== null && typeof u === "object" && Object.hasOwn(u, field);
  };
  const parse = (field, text) => {
    const trimmed = text.trim();
    if (trimmed === "") return { kind: "clear" };
    if (CARD_FIELDS[field] === "boolean") {
      if (trimmed === "true") return { kind: "set", value: true };
      if (trimmed === "false") return { kind: "set", value: false };
      return void 0;
    }
    if (CARD_FIELDS[field] === "string") return { kind: "set", value: trimmed };
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return void 0;
    if (field === "volume" && (n < 0 || n > 1)) return void 0;
    if ((field === "cooldownMs" || field === "connectionAlertAfterMs") && n < 0) return void 0;
    return { kind: "set", value: n };
  };
  const plan = () => {
    const out = [];
    for (const [field, edit] of staged) {
      if (edit.clear) {
        if (stored(field)) out.push({ field, run: () => scope.unset(field) });
        continue;
      }
      if (edit.text === format(field)) continue;
      const write = parse(field, edit.text);
      if (write === void 0) out.push({ field, run: void 0 });
      else if (write.kind === "clear") out.push({ field, run: () => scope.unset(field) });
      else out.push({ field, run: () => scope.set(field, write.value) });
    }
    return out;
  };
  scope.subscribe(() => publish());
  const actions = {
    edit: (field, text) => {
      staged.set(field, { text, clear: false });
      failed = false;
      publish();
    },
    resetField: (field) => {
      staged.set(field, { text: baseOf(field), clear: true });
      failed = false;
      publish();
    },
    discard: () => {
      if (staged.size === 0 && !failed) return;
      staged.clear();
      failed = false;
      publish();
    },
    save: () => {
      void (async () => {
        const p = plan();
        if (p.length === 0 || saving || p.some((item) => item.run === void 0)) return;
        saving = true;
        failed = false;
        publish();
        let landed = true;
        for (const item of p) {
          try {
            await item.run();
          } catch {
            landed = false;
          }
        }
        if (landed) for (const item of p) staged.delete(item.field);
        saving = false;
        failed = !landed;
        publish();
      })();
    }
  };
  const computeState = () => {
    const snapshot = snap();
    const p = plan();
    return {
      available: snapshot.status !== "loading",
      exposed: snapshot.status === "ready",
      writable: snapshot.writable === true,
      dirty: p.length > 0,
      invalid: p.some((item) => item.run === void 0),
      saving,
      failed,
      fields: Object.keys(CARD_FIELDS).map((field) => {
        const edit = staged.get(field);
        const text = edit === void 0 ? format(field) : edit.text;
        const write = edit === void 0 ? void 0 : edit.clear ? { kind: "clear" } : parse(field, edit.text);
        return { field, text, overridden: write?.kind === "set", invalid: edit !== void 0 && write === void 0 };
      })
    };
  };
  let current = computeState();
  const publish = () => {
    current = computeState();
    for (const fn of [...listeners]) try {
      fn();
    } catch {
    }
  };
  return {
    inject() {
      return {
        hooks: {
          approvalAlerterSettingsCard: {
            subscribe: (fn) => {
              listeners.add(fn);
              return () => {
                listeners.delete(fn);
              };
            },
            getSnapshot: () => current
          }
        },
        ...actions
      };
    }
  };
}
var SETTINGS_CARD_STYLE = {
  boxSizing: "border-box",
  border: "1px solid var(--dsw-alias-border-l2)",
  background: "var(--dsw-alias-bg-layer-3)",
  borderRadius: "12px",
  listStyle: "none"
};
var SETTINGS_CARD_OPEN_STYLE = {
  background: "var(--dsw-alias-bg-layer-2)",
  borderColor: "var(--dsw-alias-label-dimmed)"
};
var SETTINGS_HEADER_STYLE = {
  appearance: "none",
  width: "100%",
  font: "inherit",
  color: "inherit",
  textAlign: "left",
  cursor: "pointer",
  background: "transparent",
  border: "0",
  borderRadius: "12px",
  alignItems: "center",
  gap: "12px",
  padding: "14px 16px",
  display: "flex",
  boxSizing: "border-box"
};
var SETTINGS_HEAD_TEXT_STYLE = {
  flexDirection: "column",
  flex: "1",
  gap: "4px",
  minWidth: "0",
  display: "flex"
};
var SETTINGS_NAME_STYLE = {
  color: "var(--dsw-alias-label-primary)",
  fontSize: "15px",
  fontWeight: "600",
  lineHeight: "1.4"
};
var SETTINGS_DESC_STYLE = {
  color: "var(--dsw-alias-label-tertiary)",
  fontSize: "13px",
  lineHeight: "1.5"
};
var SETTINGS_PENDING_STYLE = {
  whiteSpace: "nowrap",
  background: "var(--dsw-alias-bg-module-platform)",
  color: "var(--dsw-alias-label-secondary)",
  borderRadius: "999px",
  flex: "none",
  padding: "1px 8px",
  fontSize: "11px",
  fontWeight: "500",
  lineHeight: "17px"
};
var SETTINGS_CHEVRON_STYLE = {
  color: "var(--dsw-alias-label-tertiary)",
  flex: "none",
  transition: "transform 0.16s"
};
var SETTINGS_BODY_STYLE = {
  borderTop: "1px solid var(--dsw-alias-border-l2)",
  margin: "0 16px",
  paddingBottom: "8px"
};
var SETTINGS_NOTE_STYLE = {
  color: "var(--dsw-alias-label-tertiary)",
  margin: "12px 0 0",
  fontSize: "12px",
  lineHeight: "1.5"
};
var SETTINGS_NOT_EXPOSED_STYLE = {
  color: "var(--dsw-alias-state-warn-primary)",
  margin: "12px 0 0",
  fontSize: "12px",
  lineHeight: "1.5"
};
var SETTINGS_FOOTER_STYLE = {
  borderTop: "1px solid var(--dsw-alias-border-l2)",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: "8px",
  padding: "12px 0 4px",
  display: "flex"
};
var SETTINGS_FAILED_STYLE = {
  minWidth: "0",
  color: "var(--dsw-alias-label-error)",
  flex: "1",
  margin: "0",
  fontSize: "12px",
  lineHeight: "1.5"
};
var SETTINGS_BUTTON_BASE = {
  appearance: "none",
  font: "inherit",
  cursor: "pointer",
  border: "1px solid transparent",
  borderRadius: "8px",
  padding: "5px 14px",
  fontSize: "13px",
  lineHeight: "1.5"
};
var SETTINGS_DISCARD_STYLE = {
  ...SETTINGS_BUTTON_BASE,
  borderColor: "var(--dsw-alias-border-l2)",
  color: "var(--dsw-alias-label-secondary)",
  background: "transparent"
};
var SETTINGS_SAVE_STYLE = {
  ...SETTINGS_BUTTON_BASE,
  background: "var(--dsw-alias-label-primary)",
  color: "var(--dsw-alias-bg-layer-3)"
};
var SETTINGS_DISABLED_STYLE = { opacity: "0.4", cursor: "default" };
var SETTINGS_FIELD_STYLE = {
  flexDirection: "column",
  gap: "6px",
  padding: "12px 0",
  display: "flex"
};
var SETTINGS_FIELD_TOP_STYLE = {
  borderTop: "1px solid var(--dsw-alias-border-l2)"
};
var SETTINGS_HEAD_STYLE = { alignItems: "center", gap: "8px", display: "flex" };
var SETTINGS_LABEL_STYLE = {
  minWidth: "0",
  color: "var(--dsw-alias-label-primary)",
  flex: "1",
  fontSize: "13px",
  fontWeight: "500",
  lineHeight: "1.5"
};
var SETTINGS_BADGES_STYLE = { alignItems: "center", gap: "8px", display: "inline-flex" };
var SETTINGS_BADGE_STYLE = {
  whiteSpace: "nowrap",
  background: "var(--dsw-alias-bg-module-platform)",
  color: "var(--dsw-alias-label-secondary)",
  borderRadius: "999px",
  padding: "1px 8px",
  fontSize: "11px",
  fontWeight: "500",
  lineHeight: "17px"
};
var SETTINGS_RESET_STYLE = {
  font: "inherit",
  color: "var(--dsw-alias-label-secondary)",
  cursor: "pointer",
  background: "transparent",
  border: "none",
  padding: "0",
  fontSize: "12px",
  lineHeight: "1.5"
};
var SETTINGS_CONTROL_STYLE = {
  border: "1px solid var(--dsw-alias-border-l2)",
  background: "var(--dsw-alias-bg-layer-3)",
  height: "34px",
  font: "inherit",
  color: "var(--dsw-alias-label-primary)",
  borderRadius: "8px",
  padding: "0 12px",
  fontSize: "13px",
  lineHeight: "1.5",
  boxSizing: "border-box"
};
var SETTINGS_CONTROL_INVALID_STYLE = {
  ...SETTINGS_CONTROL_STYLE,
  border: "1px solid var(--dsw-alias-label-error)"
};
var SETTINGS_SWITCH_STYLE = {
  position: "relative",
  boxSizing: "border-box",
  width: "40px",
  height: "22px",
  borderRadius: "999px",
  border: "1px solid var(--dsw-alias-border-l2)",
  background: "var(--dsw-alias-bg-layer-3)",
  cursor: "pointer",
  padding: "0",
  flexShrink: "0",
  transition: "background 0.15s ease, border-color 0.15s ease"
};
var SETTINGS_SWITCH_ON_STYLE = {
  ...SETTINGS_SWITCH_STYLE,
  background: "var(--dsw-alias-brand-primary)",
  borderColor: "var(--dsw-alias-brand-primary)"
};
var SETTINGS_SWITCH_KNOB_STYLE = {
  position: "absolute",
  top: "2px",
  left: "2px",
  width: "16px",
  height: "16px",
  borderRadius: "999px",
  background: "var(--dsw-alias-bg-module-platform)",
  transition: "transform 0.15s ease"
};
var SETTINGS_SWITCH_KNOB_ON_STYLE = {
  ...SETTINGS_SWITCH_KNOB_STYLE,
  transform: "translateX(18px)"
};
var SETTINGS_RANGE_ROW_STYLE = { alignItems: "center", gap: "10px", display: "flex" };
var SETTINGS_RANGE_STYLE = {
  flex: "1",
  minWidth: "0",
  margin: "0",
  accentColor: "var(--dsw-alias-brand-primary)"
};
var SETTINGS_RANGE_VALUE_STYLE = {
  minWidth: "34px",
  textAlign: "right",
  color: "var(--dsw-alias-label-secondary)",
  fontSize: "12px",
  lineHeight: "1.5",
  fontVariantNumeric: "tabular-nums"
};
var SETTINGS_HINT_STYLE = {
  color: "var(--dsw-alias-label-tertiary)",
  margin: "0",
  fontSize: "12px",
  lineHeight: "1.5"
};
var SETTINGS_INVALID_STYLE = {
  ...SETTINGS_HINT_STYLE,
  color: "var(--dsw-alias-label-error)"
};
function volumeText(text) {
  const v = parseFloat(text === "" ? "0.15" : text);
  return Number.isFinite(v) ? String(Math.max(0, Math.min(1, v))) : "0.15";
}
function AlerterSettingsCard(props) {
  const { t: T } = props;
  const state = props.useApprovalAlerterSettingsCard((s) => s);
  const [open, setOpen] = (0, import_react3.useState)(false);
  if (!state.available) return null;
  const title = T("settings.title");
  const description = T("settings.description");
  const cardStyle = open ? { ...SETTINGS_CARD_STYLE, ...SETTINGS_CARD_OPEN_STYLE } : SETTINGS_CARD_STYLE;
  const header = /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    "button",
    {
      type: "button",
      "aria-expanded": open,
      "aria-label": `${T(open ? "settings.collapse" : "settings.expand")}: ${title}`,
      onClick: () => {
        setOpen(!open);
      },
      style: SETTINGS_HEADER_STYLE,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { style: SETTINGS_HEAD_TEXT_STYLE, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: SETTINGS_NAME_STYLE, title, children: title }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: SETTINGS_DESC_STYLE, title: description, children: description })
        ] }),
        state.dirty ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: SETTINGS_PENDING_STYLE, title: T("settings.unsaved"), children: T("settings.unsaved") }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "svg",
          {
            width: "14",
            height: "14",
            viewBox: "0 0 14 14",
            fill: "none",
            xmlns: "http://www.w3.org/2000/svg",
            style: open ? { ...SETTINGS_CHEVRON_STYLE, transform: "rotate(180deg)" } : SETTINGS_CHEVRON_STYLE,
            children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              "path",
              {
                d: "M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z",
                fill: "currentColor"
              }
            )
          }
        )
      ]
    }
  );
  if (!state.exposed) {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: cardStyle, children: [
      header,
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: SETTINGS_BODY_STYLE, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: SETTINGS_NOT_EXPOSED_STYLE, role: "status", children: T("settings.notExposed") }) })
    ] });
  }
  const disabled = !state.writable;
  const blocked = !state.dirty || state.invalid || state.saving;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: cardStyle, children: [
    header,
    open ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: SETTINGS_BODY_STYLE, children: [
      !state.writable ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: SETTINGS_NOTE_STYLE, role: "status", children: T("settings.readOnly") }) : null,
      state.fields.map((field, index) => {
        const boolean = CARD_FIELDS[field.field] === "boolean";
        const label = T(`settings.field.${field.field}`);
        const hint = T(`settings.field.${field.field}Hint`);
        const id = `notifications-${field.field}`;
        return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: index === 0 ? SETTINGS_FIELD_STYLE : { ...SETTINGS_FIELD_STYLE, ...SETTINGS_FIELD_TOP_STYLE }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: SETTINGS_HEAD_STYLE, children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("label", { style: SETTINGS_LABEL_STYLE, htmlFor: id, children: label }),
            field.overridden ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { style: SETTINGS_BADGES_STYLE, children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: SETTINGS_BADGE_STYLE, children: T("settings.overridden") }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", style: SETTINGS_RESET_STYLE, disabled, onClick: () => {
                props.resetField(field.field);
              }, children: T("settings.reset") })
            ] }) : null
          ] }),
          boolean ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "button",
            {
              id,
              type: "button",
              role: "switch",
              "aria-checked": field.text === "true",
              "aria-label": label,
              disabled,
              title: field.text === "true" ? T("settings.on") : T("settings.off"),
              onClick: () => {
                props.edit(field.field, field.text === "true" ? "false" : "true");
              },
              style: field.text === "true" ? SETTINGS_SWITCH_ON_STYLE : SETTINGS_SWITCH_STYLE,
              children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: field.text === "true" ? SETTINGS_SWITCH_KNOB_ON_STYLE : SETTINGS_SWITCH_KNOB_STYLE })
            }
          ) : field.field === "volume" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: SETTINGS_RANGE_ROW_STYLE, children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              "input",
              {
                id,
                type: "range",
                min: "0",
                max: "1",
                step: "0.05",
                "aria-invalid": field.invalid || void 0,
                value: volumeText(field.text),
                disabled,
                onChange: (event) => {
                  props.edit(field.field, event.target.value);
                },
                style: SETTINGS_RANGE_STYLE
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: SETTINGS_RANGE_VALUE_STYLE, children: volumeText(field.text) })
          ] }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "input",
            {
              id,
              style: field.invalid ? SETTINGS_CONTROL_INVALID_STYLE : SETTINGS_CONTROL_STYLE,
              type: "text",
              inputMode: CARD_FIELDS[field.field] === "string" ? "text" : "numeric",
              "aria-invalid": field.invalid || void 0,
              value: field.text,
              disabled,
              onChange: (event) => {
                props.edit(field.field, event.target.value);
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: field.invalid ? SETTINGS_INVALID_STYLE : SETTINGS_HINT_STYLE, children: field.invalid ? T("settings.invalidNumber") : hint })
        ] }, field.field);
      }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: SETTINGS_FOOTER_STYLE, children: [
        state.failed ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: SETTINGS_FAILED_STYLE, role: "status", children: T("settings.saveFailed") }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "button",
          {
            type: "button",
            style: !state.dirty || state.saving ? { ...SETTINGS_DISCARD_STYLE, ...SETTINGS_DISABLED_STYLE } : SETTINGS_DISCARD_STYLE,
            disabled: !state.dirty || state.saving,
            onClick: () => {
              props.discard();
            },
            children: T("settings.discard")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "button",
          {
            type: "button",
            style: blocked ? { ...SETTINGS_SAVE_STYLE, ...SETTINGS_DISABLED_STYLE } : SETTINGS_SAVE_STYLE,
            disabled: blocked,
            onClick: () => {
              props.save();
            },
            children: T(state.saving ? "settings.saving" : "settings.save")
          }
        )
      ] })
    ] }) : null
  ] });
}

// src/client/index.ts
var inject = ["sessions", "locale", "slots", "settingsScope", "connection", "remote"];
function mergeConfig(base, overrides) {
  const merged = { ...base };
  if (overrides !== void 0 && overrides !== null && typeof overrides === "object") {
    for (const key of Object.keys(overrides)) merged[key] = overrides[key];
  }
  return merged;
}
var diag = { applied: false, sessions: false, locale: false, binder: "none", scopeStatus: "unset", cardRegistered: false, monitors: [], errors: [], jobSamples: [], diagnostics: true, seenStatuses: [], statusCounts: {}, hostStatuses: [], hostStatusCounts: {}, agentErrors: 0, connAvailable: false, connShape: "unknown" };
var fail = (errors, where, label, error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  errors.push(`${label}@${where} :: ${message}`);
  console.warn(`[notifications] ${label} failed in ${where}`, error);
};
function apply(ctx, config) {
  const errors = [];
  try {
    setDict(pickDict());
    diag.locale = true;
  } catch (error) {
    fail(errors, "apply", "locale pick", error);
  }
  try {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), "notifications: dictionaries");
  } catch (error) {
    fail(errors, "apply", "locale register", error);
  }
  const sessions = ctx.get("sessions");
  diag.sessions = sessions !== void 0 && sessions.list !== void 0 && typeof sessions.list.subscribe === "function";
  if (!diag.sessions) {
    fail(errors, "apply", "sessions guard", new Error("sessions service unavailable"));
    diag.applied = true;
    return;
  }
  const base = config === void 0 ? DEFAULTS : { ...DEFAULTS, ...config };
  const binder = ctx.get("webUiSettings") ?? ctx.get("settingsScope");
  diag.binder = ctx.get("webUiSettings") !== void 0 ? "webUiSettings" : binder !== void 0 ? "settingsScope" : "none";
  let served = void 0;
  const scope = binder !== void 0 && binder !== null && typeof binder.bind === "function" ? binder.bind({ namespace: NS }) : null;
  if (scope !== null) {
    try {
      const readValue = () => {
        try {
          const snapshot = scope.getSnapshot();
          diag.scopeStatus = snapshot === null || snapshot === void 0 || typeof snapshot !== "object" ? "missing" : String(snapshot.status);
          return snapshot !== null && typeof snapshot === "object" && snapshot.value !== null && typeof snapshot.value === "object" ? snapshot.value : void 0;
        } catch {
          return void 0;
        }
      };
      served = readValue();
      let timer = null;
      const unsub = scope.subscribe(() => {
        clearTimeout(timer ?? void 0);
        timer = setTimeout(() => {
          const value = readValue();
          if (value !== void 0) mount(mergeConfig(base, value));
        }, 120);
      });
      ctx.effect(() => () => {
        if (timer !== null) clearTimeout(timer);
        unsub();
      }, "notifications: settings subscription");
      const slots = ctx.get("slots");
      if (slots !== void 0 && typeof slots.inject === "function") {
        const controller = createSettingsCardController(scope);
        ctx.effect(() => slots.inject("settings.plugin.item", () => slots.register({
          name: "settings.plugin.item",
          id: "notifications",
          order: 30,
          locale: NS,
          inject: () => controller.inject()
        }, AlerterSettingsCard)), "notifications: settings card");
        diag.cardRegistered = true;
      } else {
        fail(errors, "card", "slots service", new Error("slots unavailable"));
      }
    } catch (error) {
      fail(errors, "card+scope", "settings bind", error);
    }
  } else {
    fail(errors, "card", "settings binder", new Error("no webUiSettings/settingsScope binder"));
  }
  const toastStore = createToastStore();
  diag.demo = (variant = "info") => {
    try {
      toastStore.push({
        key: `demo:${Date.now()}`,
        title: t("demo.title"),
        kindLabel: `variant \xB7 ${variant}`,
        body: t("demo.body"),
        ts: Date.now(),
        variant
      });
    } catch (error) {
      console.warn("[notifications] demo toast", error);
    }
  };
  diag.demoSound = (volume) => {
    try {
      const v = typeof volume === "number" && Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.15;
      playDoneCue(v);
    } catch (error) {
      console.warn("[notifications] demo sound", error);
    }
  };
  const actions = {
    go: (item) => {
      toastStore.remove(item.key);
      if (item.sessionId !== void 0) {
        try {
          sessions.open(item.sessionId);
        } catch (error) {
          console.warn("[notifications] open session", error);
        }
      }
    },
    dismiss: (item) => toastStore.remove(item.key)
  };
  try {
    const disposeToasts = base.toast ? mountToasts(toastStore, actions) : () => {
    };
    ctx.effect(() => () => disposeToasts(), "notifications: toasts");
  } catch (error) {
    fail(errors, "mount", "toasts", error);
  }
  const dockStore = base.dock ? createDockStore() : null;
  let mountDispose = () => {
  };
  const mount = (cfg) => {
    mountDispose();
    const disposers = [];
    const reg = (fn, label) => {
      disposers.push(ctx.effect(fn, label));
    };
    const safeReg = (fn, label) => {
      try {
        reg(fn, label);
        diag.monitors.push(label);
      } catch (error) {
        fail(errors, "mount", label, error);
      }
    };
    safeReg(() => startSentinel(sessions, cfg, { onArrive: () => {
      dockStore?.pulse();
    } }), "sentinel");
    if (cfg.dock) safeReg(() => startDock(dockStore, sessions, cfg), "dock");
    if (cfg.completion || cfg.jobFailure) safeReg(() => startLifecycleMonitor(sessions, cfg, { toast: toastStore }), "lifecycle");
    const conn = ctx.get("connection");
    const hostDescription = conn !== void 0 && typeof conn === "object" && conn !== null && typeof conn.hostDescription === "object" && conn.hostDescription !== null ? conn.hostDescription : void 0;
    diag.connAvailable = conn !== void 0;
    diag.connShape = hostDescription !== void 0 ? typeof hostDescription.getSnapshot : "missing";
    if (cfg.connection && hostDescription !== void 0 && typeof hostDescription.getSnapshot === "function") {
      safeReg(() => startConnectionMonitor(conn, cfg, { toast: toastStore }), "connection");
    }
    const remote = ctx.get("remote");
    diag.remoteKeys = remote !== void 0 && typeof remote === "object" && !Array.isArray(remote) ? Object.keys(remote).sort() : "missing";
    if (remote !== void 0 && typeof remote.$on === "function") {
      safeReg(() => startAgentEvents(remote, cfg, { toast: toastStore }, sessions), "agent-events");
    }
    mountDispose = () => {
      for (const d of disposers.reverse()) d();
    };
  };
  try {
    mount(mergeConfig(base, served));
  } catch (error) {
    fail(errors, "mount", "initial mount", error);
  }
  diag.applied = true;
  diag.errors = errors;
  diag.jobSamples = jobSamples;
  diag.diagnostics = mergeConfig(base, served).diagnostics === true;
  diag.seenStatuses = [...seenJobStatuses].sort();
  diag.statusCounts = { ...jobStatusCounts };
  diag.hostStatuses = [...hostJobStatuses].sort();
  diag.hostStatusCounts = { ...hostJobStatusCounts };
  diag.feedCounters = { ...hostFeedCounters };
  diag.lastHeartbeatAt = lastHeartbeatAt;
  diag.agentErrors = toastStore.getSnapshot().filter((i) => i.key.startsWith("agenterr:")).length;
  try {
    globalThis.__NOTIFICATIONS__ = diag;
  } catch {
  }
}

		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
