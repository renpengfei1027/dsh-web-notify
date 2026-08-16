/**
 * dsh-notifications — host half.
 *
 * Three jobs:
 *  1. settings section — declares the `notifications` namespace so the web
 *     settings surface exposes an editable card (the browser half reads the
 *     same namespace through `webUiSettings`/`settingsScope` and
 *     live-reconfigures without a restart).
 *  2. presence — announces the browser-surface alerter to the model through a
 *     systemPrompt section.
 *  3. event feed — watches the official `session/event` stream for model/tool
 *     failures (429 quota, max-tokens, interrupted turns, tool errors) and
 *     polls the `jobs` service for status transitions, then emits both to the
 *     browser over the plugin's forwarded remote event (`notifications/evt`).
 *     See the apiproxy allowlist patch (scripts/patch-apiproxy.mjs).
 *
 * Mirrors the live-stats host pattern (installSettingsSection + schemastery
 * schema); defaults mirror the browser half's DEFAULTS in `client/types.ts`.
 */
import type { Context } from '@deepseek-ai/cordis'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { API_REMOTE_FORWARDED_EVENTS } from '@deepseek-ai/dsh-api-remotes'
import z from '@deepseek-ai/schemastery'

/** Settings namespace, spelled here (host owns it) and hand-spelled by the browser half. */
export const ALERTER_SETTINGS_NAMESPACE = settingsNamespace('notifications')

/** Host event forwarded to every browser tab (added to API_REMOTE_FORWARDED_EVENTS by the patch). */
export const ALERTER_REMOTE_EVENT = 'notifications/evt'

/** Order of the announcement section within the tool-guidance band. */
const SECTION_ORDER = 120

/** Job-status polling interval: catches transitions (running → stopping → …) that the browser's last-wins frames never deliver. */
const JOBS_TICK_MS = 5000

export const inject = ['systemPrompt']

/** Model-facing announcement: plugin presence, capabilities, and limits. */
export const GUIDANCE = '本机已安装 dsh-notifications 插件（DSH Web GUI 的「通知」）：当任意会话的审批或计划审批处于等待时，浏览器会播放提示音、在标签页标题显示待审批徽标、右下角出现通知中心（可展开跳转）。检测管道覆盖全部会话行（含子代理）；被委派的子代理因审批策略固定为 never、提问被拒，实际不会产生待审批/计划审批/提问条目（只可能出现父会话的审批），但其完成、任务失败与模型/工具运行异常提醒照常生效。另有会话完成、任务失败、连接掉线或恢复、以及模型/工具运行异常（如 429 配额超限、达到输出上限）提醒。提醒在浏览器端的 dsh Web 页面生效；OS 通知与提示音需浏览器允许；本插件只负责提醒与跳转，不代替用户做批准/拒绝决定。配置可在 GUI 设置页的「插件配置」→「通知」卡片调整。'

/** Runtime schema for the alerter settings (defaults live here, mirroring the browser DEFAULTS). */
export const Config = z.object({
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
  connectionAlertAfterMs: z.number().min(1000).default(10000),
  jobFailure: z.boolean().default(true),
  failureNotify: z.boolean().default(false),
  agentError: z.boolean().default(true),
  cooldownMs: z.number().min(0).default(5000),
  diagnostics: z.boolean().default(true),
  alertKinds: z.array(z.string()).default(['approval', 'plan-review', 'question']),
  quiet: z.object({
    enabled: z.boolean().default(false),
    start: z.string().default('23:00'),
    end: z.string().default('08:00'),
  }).default({ enabled: false, start: '23:00', end: '08:00' }),
  soundResolved: z.boolean().default(false),
})

/**
 * Best-effort error text out of an unknown error value (quota messages,
 * throwables, strings, or structured `{name, code}` tool failures); truncated
 * so a toast never carries a megabyte. Never yields "[object Object]".
 */
function errorText(error: unknown): string {
  if (error === null || error === void 0) return ''
  const trimmed = (raw: string): string => {
    const v = raw.trim()
    return v.length > 240 ? `${v.slice(0, 237)}...` : v
  }
  if (typeof error === 'string') return trimmed(error)
  if (typeof error === 'object') {
    const e = error as { message?: unknown; name?: unknown; code?: unknown }
    if (typeof e.message === 'string' && e.message !== '') return trimmed(e.message)
    const parts: string[] = []
    if (typeof e.name === 'string' && e.name !== '') parts.push(e.name)
    if (typeof e.code === 'string' && e.code !== '') parts.push(`(${e.code})`)
    if (parts.length > 0) return trimmed(parts.join(' '))
    try { return trimmed(JSON.stringify(error)) } catch { return trimmed(String(error)) }
  }
  return trimmed(String(error))
}

/**
 * The host's frame forwarder (`assertJsonArgs`) rejects any forwarded payload
 * whose JSON.stringify round-trip is not lossless — an `undefined` field value
 * vanishes and throws ("argument 0 is not lossless JSON data"), silently
 * dropping the frame. Every emit payload must therefore be plain JSON: drop
 * undefined/null values before emitting.
 */
function jsonLossless<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value === void 0 || value === null) continue
    out[key] = value
  }
  return out
}

/** One agent-level anomaly projected from the official session event stream. */
export interface AgentErrorEventView {
  kind: 'turn-error' | 'turn-max-tokens' | 'turn-interrupted' | 'tool-error' | 'llm-retry'
  tool?: string
  message?: string
  /** Provider-neutral machine-routing code from LlmFailure, present for llm-retry. */
  code?: string
}

/**
 * Project the official `session/event` vocabulary onto the agent anomalies the
 * ③ channel exists for. Structural-only (no @deepseek-ai/dsh-session import):
 * the runtime events are plain objects and the bundle stays offline-buildable.
 *
 * Coverage note: a provider model failure (429 quota, transport, …) surfaces as
 * the `llm/retry` event carrying `data.failure: { message, code, status }` —
 * NOT as turn/end. Retrying (or mode 'always') turns may never reach
 * turn/end='error', so without this branch quota errors would stay silent.
 */
export function projectAgentError(event: unknown): AgentErrorEventView | undefined {
  if (event === null || typeof event !== 'object') return void 0
  const e = event as { type?: unknown; data?: unknown }
  const d = e.data as { name?: unknown; error?: unknown; reason?: unknown; message?: unknown; failure?: unknown } | undefined
  switch (e.type) {
    case 'tool/result': {
      const blockError = (d?.message as { content?: Array<{ isError?: boolean }> } | undefined)?.content?.some((b) => b?.isError === true)
      if (d?.error === void 0 && !blockError) return void 0
      return { kind: 'tool-error', tool: typeof d?.name === 'string' ? d.name : void 0, message: errorText(d?.error) }
    }
    case 'llm/retry': {
      const failure = d?.failure
      if (failure === null || typeof failure !== 'object') return void 0
      return {
        kind: 'llm-retry',
        message: errorText((failure as { message?: unknown }).message),
        code: typeof (failure as { code?: unknown }).code === 'string' ? String((failure as { code: string }).code) : void 0,
      }
    }
    case 'turn/end': {
      const reason = d?.reason
      const kind = reason !== null && typeof reason === 'object' && 'kind' in (reason as object)
        ? (reason as { kind?: unknown }).kind
        : void 0
      if (kind === 'error') return { kind: 'turn-error', message: errorText((reason as { error?: unknown })?.error) }
      if (kind === 'max-tokens') return { kind: 'turn-max-tokens' }
      if (kind === 'interrupted') return { kind: 'turn-interrupted' }
      return void 0
    }
    default:
      return void 0
  }
}

/**
 * Project a `turn/end` completed reason — the authoritative "a round finished"
 * signal. The sessions-list `completed` marker is a manager-owned pending
 * reminder the manager may consume before the browser ever sees it, so
 * completions ride the event stream; the list edge stays as a fallback lane.
 */
export function projectCompletion(event: unknown): { completed: true } | undefined {
  if (event === null || typeof event !== 'object') return void 0
  const e = event as { type?: unknown; data?: unknown }
  if (e.type !== 'turn/end') return void 0
  const reason = (e.data as { reason?: unknown } | undefined)?.reason
  const kind = reason !== null && typeof reason === 'object' && 'kind' in (reason as object)
    ? (reason as { kind?: unknown }).kind
    : void 0
  return kind === 'completed' ? { completed: true } : void 0
}

/**
 * Register the host feed: agent-error + completion projections on
 * `session/event` plus a jobs-service status poll, all emitting via the
 * forwarded remote event. Every failure is logged, never thrown (the family
 * rule — a feed hiccup must not break the plugin or the host boot).
 */
export function startAlerterFeed(ctx: Context): () => void {
  const disposers: Array<() => void> = []
  const dispose = () => { for (const d of disposers.splice(0)) { try { d() } catch {} } }
  const reportedLlmFailures = new Set<string>()
  try {
    // Runtime confession: does the host process' resolved dsh-api-remotes list
    // (the SAME instance the frame forwarder iterates) contain our event?
    console.info(`[notifications] forwarded-events len=${API_REMOTE_FORWARDED_EVENTS.length} has-evts=${String(API_REMOTE_FORWARDED_EVENTS.includes(ALERTER_REMOTE_EVENT))}`)
    console.info('[notifications] feed started')
    const onSessionEvent = (session: unknown, event: unknown): void => {
      try {
        const sessionId = session !== null && typeof session === 'object' && 'id' in session
          ? String((session as { id: unknown }).id)
          : ''
        // Best-effort human title so the browser never falls back to a raw UUID.
        const sessionTitle = session !== null && typeof session === 'object' && 'title' in session && typeof (session as { title?: unknown }).title === 'string'
          ? (session as { title: string }).title
          : ''
        const view = projectAgentError(event)
        if (view !== void 0) {
          console.info(`[notifications] error event kind=${view.kind} session=${sessionId}${view.tool ? ` tool=${view.tool}` : ''} message=${String(view.message ?? '').slice(0, 120)}`)
          // llm/retry repeats while a provider failure keeps retrying (or with an
          // unbounded 'always' policy forever): report each session+code once.
          if (view.kind === 'llm-retry' && view.code !== void 0) {
            const key = `${sessionId}:${view.code}`
            if (reportedLlmFailures.has(key)) return
            reportedLlmFailures.add(key)
          }
          ctx.emit(ALERTER_REMOTE_EVENT, jsonLossless({
              type: 'agent-error',
              ts: Date.now(),
              sessionId,
              title: sessionTitle,
              kind: view.kind,
              tool: view.tool,
              message: view.message,
            }))
        }
        if (projectCompletion(event) !== void 0) {
          console.info(`[notifications] completion event session=${sessionId}`)
          ctx.emit(ALERTER_REMOTE_EVENT, jsonLossless({ type: 'agent-completed', ts: Date.now(), sessionId, title: sessionTitle }))
        }
      } catch (error) {
        console.warn('[notifications] session/event projection', error)
      }
    }
    disposers.push(ctx.on('session/event', onSessionEvent))

    const prevStatus = new Map<string, string>()
    const tick = (): void => {
      try {
        const jobs = (ctx as unknown as { get?: (name: string) => unknown }).get?.('jobs')
        if (jobs === void 0 || typeof jobs !== 'object' || typeof (jobs as { list?: unknown }).list !== 'function') return
        // Cordis ctx is a Proxy: reading an un-injected service property directly
        // throws "cannot get property X without inject". Only `ctx.get(name)` is
        // inject-free and returns undefined for not-yet-provided services.
        const sessions = (ctx as unknown as { get?: (name: string) => unknown }).get?.('sessions') as { list?: () => unknown[] } | undefined
        const agents = (ctx as unknown as { get?: (name: string) => unknown }).get?.('agents') as { get?: (id: string) => unknown } | undefined
        const list = typeof sessions?.list === 'function' ? sessions.list() : []
        for (const session of list) {
          const sid = session !== null && typeof session === 'object' && 'id' in session ? String((session as { id: unknown }).id) : ''
          if (sid === '') continue
          const agent = typeof agents?.get === 'function' ? agents.get(sid) : void 0
          let views: Array<{ id?: unknown; status?: unknown }> = []
          try { views = (jobs as { list: (agent: unknown) => Array<{ id?: unknown; status?: unknown }> }).list(agent) } catch {}
          for (const view of views) {
            const id = view?.id
            const status = view?.status
            if (typeof id !== 'string' || typeof status !== 'string' || id === '') continue
            const key = `${sid}:${id}`
            if (prevStatus.get(key) === status) continue
            prevStatus.set(key, status)
            ctx.emit(ALERTER_REMOTE_EVENT, jsonLossless({
              type: 'job-status',
              ts: Date.now(),
              sessionId: sid,
              jobId: id,
              status,
            }))
          }
        }
      } catch (error) {
        console.warn('[notifications] jobs status tick', error)
      }
    }
    const timer = setInterval(tick, JOBS_TICK_MS)
    disposers.push(() => clearInterval(timer))
    tick()
    // Feed liveness heartbeat (~every 30s): a forwarded-frame lane that works
    // end-to-end shows heartbeat arrivals in the browser diagnostics
    // (`lastHeartbeatAt`/`counters`). If the browser sees no heartbeat, the
    // host feed or the frame forwarding is broken and no event-type projections
    // can ever reach the browser either. Heartbeat frames are silent on the
    // host stdout (no console.info) — they exist purely for the browser-side
    // liveness probe.
    let beats = 0
    const beatTimer = setInterval(() => {
      try {
        beats += 1
        ctx.emit(ALERTER_REMOTE_EVENT, jsonLossless({ type: 'heartbeat', ts: Date.now(), n: beats }))
      } catch (error) {
        console.warn('[notifications] heartbeat emit', error)
      }
    }, 30000)
    disposers.push(() => clearInterval(beatTimer))
  } catch (error) {
    console.warn('[notifications] feed setup', error)
  }
  return dispose
}

/**
 * Register the settings section + the systemPrompt announcement + the event
 * feed. The settings payload is consumed by the browser half (it subscribes
 * the same namespace); the host keeps a pass-through source in case a future
 * host-side channel (e.g. taskbar flashing) wants the same live values.
 */
export function apply(ctx: Context, config: z.infer<typeof Config> = {}): void {
  let current: () => z.infer<typeof Config> = () => config ?? {}
  installSettingsSection(ctx, ALERTER_SETTINGS_NAMESPACE, Config, config ?? {}, {
    setSource: (source) => { current = source },
    onChange: () => { /* browser half self-updates via the settings scope */ },
  })
  void current
  let disposeSection: (() => void) | undefined
  const sync = () => {
    disposeSection?.()
    disposeSection = void 0
    if ((ctx as unknown as { systemPrompt?: unknown }).systemPrompt === void 0) return
    disposeSection = (ctx as unknown as { systemPrompt: { section(opts: object): () => void } }).systemPrompt.section({
      name: 'plugin:notifications',
      order: SECTION_ORDER,
      text: GUIDANCE,
    })
  }
  sync()
  return startAlerterFeed(ctx)
}