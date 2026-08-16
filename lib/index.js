// src/index.ts
import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";
import { API_REMOTE_FORWARDED_EVENTS } from "@deepseek-ai/dsh-api-remotes";
import z from "@deepseek-ai/schemastery";
var ALERTER_SETTINGS_NAMESPACE = settingsNamespace("notifications");
var ALERTER_REMOTE_EVENT = "notifications/evt";
var SECTION_ORDER = 120;
var JOBS_TICK_MS = 5e3;
var inject = ["systemPrompt"];
var GUIDANCE = "\u672C\u673A\u5DF2\u5B89\u88C5 dsh-web-notify \u63D2\u4EF6\uFF08DSH Web GUI \u7684\u300C\u901A\u77E5\u300D\uFF09\uFF1A\u5F53\u4EFB\u610F\u4F1A\u8BDD\u7684\u5BA1\u6279\u6216\u8BA1\u5212\u5BA1\u6279\u5904\u4E8E\u7B49\u5F85\u65F6\uFF0C\u6D4F\u89C8\u5668\u4F1A\u64AD\u653E\u63D0\u793A\u97F3\u3001\u5728\u6807\u7B7E\u9875\u6807\u9898\u663E\u793A\u5F85\u5BA1\u6279\u5FBD\u6807\u3001\u53F3\u4E0B\u89D2\u51FA\u73B0\u901A\u77E5\u4E2D\u5FC3\uFF08\u53EF\u5C55\u5F00\u8DF3\u8F6C\uFF09\u3002\u68C0\u6D4B\u7BA1\u9053\u8986\u76D6\u5168\u90E8\u4F1A\u8BDD\u884C\uFF08\u542B\u5B50\u4EE3\u7406\uFF09\uFF1B\u88AB\u59D4\u6D3E\u7684\u5B50\u4EE3\u7406\u56E0\u5BA1\u6279\u7B56\u7565\u56FA\u5B9A\u4E3A never\u3001\u63D0\u95EE\u88AB\u62D2\uFF0C\u5B9E\u9645\u4E0D\u4F1A\u4EA7\u751F\u5F85\u5BA1\u6279/\u8BA1\u5212\u5BA1\u6279/\u63D0\u95EE\u6761\u76EE\uFF08\u53EA\u53EF\u80FD\u51FA\u73B0\u7236\u4F1A\u8BDD\u7684\u5BA1\u6279\uFF09\uFF0C\u4F46\u5176\u5B8C\u6210\u3001\u4EFB\u52A1\u5931\u8D25\u4E0E\u6A21\u578B/\u5DE5\u5177\u8FD0\u884C\u5F02\u5E38\u63D0\u9192\u7167\u5E38\u751F\u6548\u3002\u53E6\u6709\u4F1A\u8BDD\u5B8C\u6210\u3001\u4EFB\u52A1\u5931\u8D25\u3001\u8FDE\u63A5\u6389\u7EBF\u6216\u6062\u590D\u3001\u4EE5\u53CA\u6A21\u578B/\u5DE5\u5177\u8FD0\u884C\u5F02\u5E38\uFF08\u5982 429 \u914D\u989D\u8D85\u9650\u3001\u8FBE\u5230\u8F93\u51FA\u4E0A\u9650\uFF09\u63D0\u9192\u3002\u63D0\u9192\u5728\u6D4F\u89C8\u5668\u7AEF\u7684 dsh Web \u9875\u9762\u751F\u6548\uFF1BOS \u901A\u77E5\u4E0E\u63D0\u793A\u97F3\u9700\u6D4F\u89C8\u5668\u5141\u8BB8\uFF1B\u672C\u63D2\u4EF6\u53EA\u8D1F\u8D23\u63D0\u9192\u4E0E\u8DF3\u8F6C\uFF0C\u4E0D\u4EE3\u66FF\u7528\u6237\u505A\u6279\u51C6/\u62D2\u7EDD\u51B3\u5B9A\u3002\u914D\u7F6E\u53EF\u5728 GUI \u8BBE\u7F6E\u9875\u7684\u300C\u63D2\u4EF6\u914D\u7F6E\u300D\u2192\u300C\u901A\u77E5\u300D\u5361\u7247\u8C03\u6574\u3002";
var Config = z.object({
  sound: z.boolean().default(true),
  volume: z.number().min(0).max(1).default(0.15),
  badge: z.boolean().default(true),
  toast: z.boolean().default(true),
  notify: z.boolean().default(true),
  dock: z.boolean().default(true),
  completion: z.boolean().default(true),
  completionSound: z.boolean().default(true),
  completionNotify: z.boolean().default(true),
  connection: z.boolean().default(true),
  connectionAlertAfterMs: z.number().min(1e3).default(1e4),
  jobFailure: z.boolean().default(true),
  failureNotify: z.boolean().default(false),
  agentError: z.boolean().default(true),
  cooldownMs: z.number().min(0).default(5e3),
  diagnostics: z.boolean().default(true),
  alertKinds: z.array(z.string()).default(["approval", "plan-review", "question"]),
  quiet: z.object({
    enabled: z.boolean().default(false),
    start: z.string().default("23:00"),
    end: z.string().default("08:00")
  }).default({ enabled: false, start: "23:00", end: "08:00" }),
  soundResolved: z.boolean().default(false)
});
function errorText(error) {
  if (error === null || error === void 0) return "";
  const trimmed = (raw) => {
    const v = raw.trim();
    return v.length > 240 ? `${v.slice(0, 237)}...` : v;
  };
  if (typeof error === "string") return trimmed(error);
  if (typeof error === "object") {
    const e = error;
    if (typeof e.message === "string" && e.message !== "") return trimmed(e.message);
    const parts = [];
    if (typeof e.name === "string" && e.name !== "") parts.push(e.name);
    if (typeof e.code === "string" && e.code !== "") parts.push(`(${e.code})`);
    if (parts.length > 0) return trimmed(parts.join(" "));
    try {
      return trimmed(JSON.stringify(error));
    } catch {
      return trimmed(String(error));
    }
  }
  return trimmed(String(error));
}
function jsonLossless(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === void 0 || value === null) continue;
    out[key] = value;
  }
  return out;
}
function projectAgentError(event) {
  if (event === null || typeof event !== "object") return void 0;
  const e = event;
  const d = e.data;
  switch (e.type) {
    case "tool/result": {
      const blockError = d?.message?.content?.some((b) => b?.isError === true);
      if (d?.error === void 0 && !blockError) return void 0;
      return { kind: "tool-error", tool: typeof d?.name === "string" ? d.name : void 0, message: errorText(d?.error) };
    }
    case "llm/retry": {
      const failure = d?.failure;
      if (failure === null || typeof failure !== "object") return void 0;
      return {
        kind: "llm-retry",
        message: errorText(failure.message),
        code: typeof failure.code === "string" ? String(failure.code) : void 0
      };
    }
    case "turn/end": {
      const reason = d?.reason;
      const kind = reason !== null && typeof reason === "object" && "kind" in reason ? reason.kind : void 0;
      if (kind === "error") return { kind: "turn-error", message: errorText(reason?.error) };
      if (kind === "max-tokens") return { kind: "turn-max-tokens" };
      if (kind === "interrupted") return { kind: "turn-interrupted" };
      return void 0;
    }
    default:
      return void 0;
  }
}
function projectCompletion(event) {
  if (event === null || typeof event !== "object") return void 0;
  const e = event;
  if (e.type !== "turn/end") return void 0;
  const reason = e.data?.reason;
  const kind = reason !== null && typeof reason === "object" && "kind" in reason ? reason.kind : void 0;
  return kind === "completed" ? { completed: true } : void 0;
}
function startAlerterFeed(ctx) {
  const disposers = [];
  const dispose = () => {
    for (const d of disposers.splice(0)) {
      try {
        d();
      } catch {
      }
    }
  };
  const reportedLlmFailures = /* @__PURE__ */ new Set();
  try {
    console.info(`[notifications] forwarded-events len=${API_REMOTE_FORWARDED_EVENTS.length} has-evts=${String(API_REMOTE_FORWARDED_EVENTS.includes(ALERTER_REMOTE_EVENT))}`);
    console.info("[notifications] feed started");
    const onSessionEvent = (session, event) => {
      try {
        const sessionId = session !== null && typeof session === "object" && "id" in session ? String(session.id) : "";
        const sessionTitle = session !== null && typeof session === "object" && "title" in session && typeof session.title === "string" ? session.title : "";
        const view = projectAgentError(event);
        if (view !== void 0) {
          console.info(`[notifications] error event kind=${view.kind} session=${sessionId}${view.tool ? ` tool=${view.tool}` : ""} message=${String(view.message ?? "").slice(0, 120)}`);
          if (view.kind === "llm-retry" && view.code !== void 0) {
            const key = `${sessionId}:${view.code}`;
            if (reportedLlmFailures.has(key)) return;
            reportedLlmFailures.add(key);
          }
          ctx.emit(ALERTER_REMOTE_EVENT, jsonLossless({
            type: "agent-error",
            ts: Date.now(),
            sessionId,
            title: sessionTitle,
            kind: view.kind,
            tool: view.tool,
            message: view.message
          }));
        }
        if (projectCompletion(event) !== void 0) {
          console.info(`[notifications] completion event session=${sessionId}`);
          ctx.emit(ALERTER_REMOTE_EVENT, jsonLossless({ type: "agent-completed", ts: Date.now(), sessionId, title: sessionTitle }));
        }
      } catch (error) {
        console.warn("[notifications] session/event projection", error);
      }
    };
    disposers.push(ctx.on("session/event", onSessionEvent));
    const prevStatus = /* @__PURE__ */ new Map();
    const tick = () => {
      try {
        const jobs = ctx.get?.("jobs");
        if (jobs === void 0 || typeof jobs !== "object" || typeof jobs.list !== "function") return;
        const sessions = ctx.get?.("sessions");
        const agents = ctx.get?.("agents");
        const list = typeof sessions?.list === "function" ? sessions.list() : [];
        for (const session of list) {
          const sid = session !== null && typeof session === "object" && "id" in session ? String(session.id) : "";
          if (sid === "") continue;
          const agent = typeof agents?.get === "function" ? agents.get(sid) : void 0;
          let views = [];
          try {
            views = jobs.list(agent);
          } catch {
          }
          for (const view of views) {
            const id = view?.id;
            const status = view?.status;
            if (typeof id !== "string" || typeof status !== "string" || id === "") continue;
            const key = `${sid}:${id}`;
            if (prevStatus.get(key) === status) continue;
            prevStatus.set(key, status);
            ctx.emit(ALERTER_REMOTE_EVENT, jsonLossless({
              type: "job-status",
              ts: Date.now(),
              sessionId: sid,
              jobId: id,
              status
            }));
          }
        }
      } catch (error) {
        console.warn("[notifications] jobs status tick", error);
      }
    };
    const timer = setInterval(tick, JOBS_TICK_MS);
    disposers.push(() => clearInterval(timer));
    tick();
    let beats = 0;
    const beatTimer = setInterval(() => {
      try {
        beats += 1;
        ctx.emit(ALERTER_REMOTE_EVENT, jsonLossless({ type: "heartbeat", ts: Date.now(), n: beats }));
      } catch (error) {
        console.warn("[notifications] heartbeat emit", error);
      }
    }, 3e4);
    disposers.push(() => clearInterval(beatTimer));
  } catch (error) {
    console.warn("[notifications] feed setup", error);
  }
  return dispose;
}
function apply(ctx, config = {}) {
  let current = () => config ?? {};
  installSettingsSection(ctx, ALERTER_SETTINGS_NAMESPACE, Config, config ?? {}, {
    setSource: (source) => {
      current = source;
    },
    onChange: () => {
    }
  });
  void current;
  let disposeSection;
  const sync = () => {
    disposeSection?.();
    disposeSection = void 0;
    if (ctx.systemPrompt === void 0) return;
    disposeSection = ctx.systemPrompt.section({
      name: "plugin:notifications",
      order: SECTION_ORDER,
      text: GUIDANCE
    });
  };
  sync();
  return startAlerterFeed(ctx);
}
export {
  ALERTER_REMOTE_EVENT,
  ALERTER_SETTINGS_NAMESPACE,
  Config,
  GUIDANCE,
  apply,
  inject,
  projectAgentError,
  projectCompletion,
  startAlerterFeed
};
//# sourceMappingURL=index.js.map
