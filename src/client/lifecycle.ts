/**
 * ① completion + ③ job-failure monitors, plus ② the connection monitor.
 *
 * All three ride baseline-seeded edge detection: never alert for state that
 * predates the page, per-id cooldown for replay dedupe; jobs alert at most
 * once per job id.
 */
import type { AlerterConfig, ConnectionLike, SessionsLike, ToastItem } from './types.ts'
import type { ToastStore } from './stores.ts'
import { inQuiet, jumpToSession, notifyOs, playChime, playDoneCue, playResolvedCue, pulseCompletionTab } from './channels.ts'
import { t } from './locales.ts'

/**
 * Whether the page is currently hidden (tab backgrounded / window minimized).
 * The monitors stay fully live while hidden — "monitor active" doesn't depend
 * on focus; only the current-session completion silencing defers to it, so a
 * completion you cannot see still notifies.
 */
export function pageHidden(): boolean {
  return typeof document === 'undefined' || document.visibilityState !== 'visible'
}

/**
 * Completion alerts, shared by both lanes: the sessions-list completed edge
 * (fallback; the host can consume the reminder before the browser sees it)
 * and the host event-stream `agent-completed` (authoritative). The per-session
 * cooldown keeps the two lanes idempotent — a completion arriving on both
 * within `cooldownMs` fires exactly once.
 */
const completionFiredAt = new Map<string, number>()

export function fireCompletion(
  cfg: AlerterConfig,
  channels: LifecycleChannels,
  sid: string,
  displayTitle?: string,
  sessions?: SessionsLike,
): void {
  if (!cfg.completion || sid === '') return
  const now = Date.now()
  if (now - (completionFiredAt.get(sid) ?? 0) < cfg.cooldownMs) return
  const title = humanTitle(sid, void 0, displayTitle)
  completionFiredAt.set(sid, now)
  const gotoSession = (): void => jumpToSession(sessions, sid)
  if (pageHidden()) {
    // Background completion: no corner card (it would be invisible) — blink the
    // tab title and pulse the PWA icon badge instead; sound + OS notify stay.
    pulseCompletionTab(title)
  } else if (cfg.toast) {
    channels.toast.push({
      key: `completion:${sid}`,
      sessionId: sid,
      title,
      kindLabel: t('completion.title'),
      ts: now,
      variant: 'done',
    } satisfies ToastItem)
  }
  if (cfg.completionSound && cfg.sound && !inQuiet(cfg)) playDoneCue(cfg.volume)
  if (cfg.completionNotify && cfg.notify) notifyOs(
    { id: sid },
    t('notify.completion.title'),
    t('notify.completion.body', { title }),
    { onClick: gotoSession },
  )
}

/**
 * Soft completion cue for the visible+current case — used when the page is
 * visible and the completed session is the one the user is already looking
 * at. Toast/OS-notify/sound-resolved are silenced, but a single soft cue is
 * played as a safety net (the user may have scrolled up or be looking away).
 *
 * This is the ONLY place this decision is made — both the sessions-list
 * monitor (①) and the host agent-event feed (④) route through here, so the
 * guard chain (cfg.completion → cooldown) is applied uniformly and
 * double-fire is impossible.
 */
function softCompletionCue(cfg: AlerterConfig): void {
  if (!cfg.completion) return
  if (!cfg.completionSound || !cfg.sound || inQuiet(cfg)) return
  playDoneCue(cfg.volume)
}

export interface LifecycleChannels {
  toast: ToastStore
}

/** One observed jobs-frame sample (ring buffer, for diagnosing ③ on-device). */
export interface JobSample {
  t: number
  jobsBySessionKeys: string[]
  jobs: Array<{ sid: string; id: string; status: string; detail?: string }>
  alerts: string[]
}

/** Ring buffer of the last N reconcile observations (exposed via diagnostics). */
export const jobSamples: JobSample[] = []

/**
 * Every job status this page has observed, collected automatically regardless
 * of the diagnostics switch (a Set — cheap, always on). Exposed as a sorted
 * array through `__NOTIFICATIONS__`; later per-status CSS rules can key on
 * these exact status strings.
 */
export const seenJobStatuses = new Set<string>()

/** How many times each status was observed (per reconcile job entry). */
export const jobStatusCounts: Record<string, number> = {}

function recordSample(snapshot: { jobsBySession?: unknown }, alerts: string[], collect: boolean): void {
  const jobs: JobSample['jobs'] = []
  const jbs = snapshot.jobsBySession as Record<string, readonly unknown[]> | undefined
  if (jbs !== void 0 && jbs !== null) {
    for (const sid of Object.keys(jbs)) {
      for (const job of jbs[sid] ?? []) {
        if (job === null || typeof job !== 'object') continue
        const j = job as { id?: unknown; status?: unknown; detail?: unknown }
        const status = String(j.status ?? 'running')
        // Always-on status ledger: the Set + counters live outside the ring so
        // "which statuses were seen" survives diagnostics being off.
        seenJobStatuses.add(status)
        jobStatusCounts[status] = (jobStatusCounts[status] ?? 0) + 1
        const detail = typeof j.detail === 'string' ? j.detail.slice(0, 140) : void 0
        jobs.push({ sid, id: String(j.id ?? ''), status, detail })
      }
    }
  }
  if (!collect) return
  const completedIds = snapshot.ids.filter((sid) => snapshot.byId[sid]?.completed === true)
  jobSamples.push({ t: Date.now(), completedIds, jobsBySessionKeys: jobs.map((j) => j.id), jobs, alerts })
  if (jobSamples.length > 60) jobSamples.shift()
}

export function startLifecycleMonitor(sessions: SessionsLike, cfg: AlerterConfig, channels: LifecycleChannels): () => void {
  const prevCompleted = new Map<string, boolean>()
  const prevJobs = new Map<string, Map<string, string>>()
  const alertedFailedJobs = new Set<string>()
  let seeded = false
  // ③ anomaly detection: explicit 'failed'/'killed' statuses always alert, and
  // so does a 'completed' job whose detail records an anomalous exit (the host
  // reports e.g. "exit code: 7" as status 'completed' — the failure only lives
  // in `detail`). A clean 'completed' (no detail, or "exit code: 0") never alerts.
  const ANOMALY = new Set(['failed', 'killed'])
  // Error-signature scan (case-insensitive): a job whose label or detail
  // carries a provider/agent error (quota, rate limits, timeouts, refusals…)
  // alerts even when the host mapped it to a completed/other status — this is
  // what makes an "Allocated quota exceeded" / 429 alert visible. `running` is
  // excluded so a transient in-flight message does not ring.
  const ERROR_SIG = /quota|insufficient|rate\s*limit|429\b|\b429|timeout|timed\s*out|exception|unauthor|forbidden|access denied|refus|abort|connection failed|econnrefused|exit status|insufficient_quota/i
  const detailAnomalous = (detail: unknown): boolean => {
    if (typeof detail !== 'string' || detail.length === 0) return false
    return !/exit code:\s*0(\D|$)/i.test(detail)
  }
  const jobAnomalous = (job: { status?: string; detail?: string; label?: string }): boolean => {
    const status = job.status ?? 'running'
    if (ANOMALY.has(status)) return true
    if (status !== 'running') {
      if (typeof job.detail === 'string' && detailAnomalous(job.detail)) return true
      const hay = `${job.label ?? ''}\u0000${job.detail ?? ''}`
      if (ERROR_SIG.test(hay)) return true
    }
    return false
  }

  const reconcile = () => {
    const snapshot = sessions.list.getSnapshot()
    const current = snapshot.current
    const now = Date.now()
    const firedAlerts: string[] = []
    // Jobs may belong to sessions absent from `ids` (id-breadcrumb routes),
    // so walk the union of ids and jobsBySession keys.
    const sids = new Set(snapshot.ids)
    if (snapshot.jobsBySession !== void 0) for (const key of Object.keys(snapshot.jobsBySession)) sids.add(key)
    // Baseline pass: record what already exists; only later edges alert.
    if (!seeded) {
      seeded = true
      for (const sid of sids) {
        const row = snapshot.byId[sid]
        if (row !== void 0) prevCompleted.set(sid, row.completed === true)
        const jobs = snapshot.jobsBySession?.[sid]
        if (jobs !== void 0 && jobs.length > 0) {
          const seed = new Map<string, string>()
          for (const job of jobs) {
            if (job === null || typeof job !== 'object') continue
            seed.set(job.id ?? '', job.status ?? 'running')
          }
          prevJobs.set(sid, seed)
        }
      }
      recordSample(snapshot, firedAlerts, cfg.diagnostics)
      return
    }
    for (const sid of sids) {
      const row = snapshot.byId[sid]
      if (row !== void 0) {
        const done = row.completed === true
        const prevDone = prevCompleted.get(sid) === true
        if (done && !prevDone) {
          if (sid !== current || pageHidden()) {
            fireCompletion(cfg, channels, sid, row.displayTitle, sessions)
          } else {
            softCompletionCue(cfg)
          }
        }
        prevCompleted.set(sid, done)
      }
      // ---- jobs (③) ----
      const jobs = snapshot.jobsBySession?.[sid] ?? void 0
      if (jobs === void 0 || jobs.length === 0) {
        prevJobs.delete(sid)
        continue
      }
      const prevMap = prevJobs.get(sid) ?? new Map<string, string>()
      const curMap = new Map<string, string>()
      for (const job of jobs) {
        if (job === null || typeof job !== 'object') continue
        const id = job.id ?? ''
        const status = job.status ?? 'running'
        curMap.set(id, status)
        if (jobAnomalous(job as { status?: string; detail?: string }) && prevMap.get(id) !== status && !alertedFailedJobs.has(id)) {
          alertedFailedJobs.add(id)
          firedAlerts.push(`jobfail:${id}`)
          const detail = typeof job.detail === 'string' && job.detail.length > 0 ? ' (' + job.detail + ')' : ''
          if (cfg.toast) {
            channels.toast.push({
              key: `jobfail:${id}`,
              sessionId: sid,
              title: row?.displayTitle ?? sid,
              kindLabel: t('job.failed'),
              body: t('job.body', { label: job.label ?? id, detail }),
              ts: now,
              variant: 'error',
            } satisfies ToastItem)
          }
          if (cfg.sound && !inQuiet(cfg)) playResolvedCue(cfg.volume)
          if (cfg.failureNotify && cfg.notify) {
            const label = job.label ?? id
            const sessionTitle = row?.displayTitle ?? sid
            notifyOs(
              { id: sid },
              t('notify.failure.title'),
              t('notify.failure.body', { sessionTitle, label, detail }),
              {
                onClick: () => jumpToSession(sessions, sid),
              },
            )
          }
        }
      }
      prevJobs.set(sid, curMap)
    }
    recordSample(snapshot, firedAlerts, cfg.diagnostics)
  }

  const unsubscribe = sessions.list.subscribe(reconcile)
  reconcile() // baseline: seeds maps without firing
  return () => { unsubscribe() }
}

// ---- ④ Host event feed (429 quota / model-tool errors + host job-status ledger). ----

/** The plugin's forwarded host event name (see scripts/patch-apiproxy.mjs). */
export const ALERTER_REMOTE_EVENT = 'notifications/evt'

/** The `remote` service's host-event subscription surface. */
export interface RemoteLike {
  $on?(event: string, handler: (payload: unknown) => void): unknown
}

/** One payload on the plugin's forwarded host event. */
export type AgentFeedEvent =
  | { type: 'agent-error'; ts?: number; sessionId?: string; title?: string; kind?: string; tool?: string; message?: string }
  | { type: 'agent-completed'; ts?: number; sessionId?: string; title?: string }
  | { type: 'job-status'; ts?: number; sessionId?: string; jobId?: string; status?: string }
  | { type: 'heartbeat'; ts?: number; n?: number }

/** Human title: host-provided, then the list row, then a short session tag (never a raw UUID). */
export function humanTitle(sid: string, title?: string, rowTitle?: string): string {
  if (title !== void 0 && title !== '') return title
  if (rowTitle !== void 0 && rowTitle !== '') return rowTitle
  const bare = sid.replace(/^session-/, '')
  return /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(bare) && bare.length > 20
    ? `session ${bare.slice(0, 8)}`
    : sid
}

/**
 * Host job-status ledger — always on, independent of the diagnostics switch.
 * The host polls the jobs service for every status TRANSITION (running →
 * stopping → completed/killed/failed…) and forwards each one; the browser
 * frames are last-wins and routinely miss intermediate statuses, so this is
 * the complete-status backstop ("查缺补漏").
 */
export const hostJobStatuses = new Set<string>()
export const hostJobStatusCounts: Record<string, number> = {}

/** Liveness ledger: every forwarded frame counted by type; heartbeat included. */
export const hostFeedCounters: Record<string, number> = {}
export let lastHeartbeatAt = 0

export interface AgentEventsChannels {
  toast: ToastStore
}

/** Agent-level anomaly label lookup (kind → locale key). */
const AGENT_ERROR_KIND_LABEL: Record<string, keyof typeof import('./locales.ts').zh> = {
  'tool-error': 'agent.error.tool',
  'turn-error': 'agent.error.turn',
  'turn-max-tokens': 'agent.error.maxTokens',
  'turn-interrupted': 'agent.error.interrupted',
  'llm-retry': 'agent.error.llmRetry',
}

/** Per session+kind cooldown: a retrying provider failure must not re-alert on every attempt. */
const agentErrorCooldownMs = 10000
const agentErrorFiredAt = new Map<string, number>()

/**
 * ④ Consume the host's forwarded feed: agent anomalies alert as their own
 * channel (toast + sound + optional OS notify, gated by `agentError`;
 * `jobFailure` no longer gates this lane), job status transitions feed the
 * always-on ledger.
 */
export function startAgentEvents(
  remote: RemoteLike,
  cfg: AlerterConfig,
  channels: AgentEventsChannels,
  sessions?: SessionsLike,
): () => void {
  const collectStatus = (payload: AgentFeedEvent): void => {
    if (payload.type !== 'job-status' || typeof payload.status !== 'string' || payload.status === '') return
    hostJobStatuses.add(payload.status)
    hostJobStatusCounts[payload.status] = (hostJobStatusCounts[payload.status] ?? 0) + 1
  }
  const onFeed = (payload: unknown): void => {
    try {
      if (payload === null || typeof payload !== 'object') return
      const event = payload as AgentFeedEvent
      hostFeedCounters[String(event.type ?? '?')] = (hostFeedCounters[String(event.type ?? '?')] ?? 0) + 1
      if (event.type === 'heartbeat' && typeof event.ts === 'number') lastHeartbeatAt = event.ts
      if (event.type === 'job-status') { collectStatus(event); return }
      if (event.type === 'agent-completed') {
        // The authoritative completion lane: the host sees turn/end completed
        // even when the manager consumes the list `completed` reminder before
        // the browser does. Silenced only while the page is visible AND the
        // completed session is the one currently open — hidden/minimized still
        // alerts (you cannot see it there).
        if (!cfg.completion) return
        const sid = typeof event.sessionId === 'string' ? event.sessionId : ''
        let current: string | undefined
        let rowTitle: string | undefined
        if (sessions !== void 0) {
          try {
            const snapshot = sessions.list.getSnapshot()
            current = snapshot.current
            rowTitle = snapshot.byId[sid]?.displayTitle
          } catch {}
        }
        const silenced = !pageHidden() && current !== void 0 && sid !== '' && current === sid
        if (!silenced) {
          fireCompletion(cfg, channels, sid, humanTitle(sid, event.title, rowTitle), sessions)
        } else {
          softCompletionCue(cfg)
        }
        return
      }
      if (event.type !== 'agent-error') return
      if (!cfg.agentError) return
      const now = Date.now()
      const dedupeKey = `${event.sessionId ?? ''}:${event.kind ?? ''}`
      if (now - (agentErrorFiredAt.get(dedupeKey) ?? 0) < agentErrorCooldownMs) return
      agentErrorFiredAt.set(dedupeKey, now)
      const kindLabel = AGENT_ERROR_KIND_LABEL[event.kind ?? ''] ?? 'agent.error'
      const tool = typeof event.tool === 'string' && event.tool !== '' ? ` ${event.tool}` : ''
      const messageText = typeof event.message === 'string' && event.message !== '' ? event.message : ''
      const message = messageText !== '' ? `: ${messageText}` : ''
      const title = humanTitle(event.sessionId ?? '', event.title)
      const sid = typeof event.sessionId === 'string' ? event.sessionId : ''
      if (cfg.toast) {
        channels.toast.push({
          key: `agenterr:${event.ts ?? now}`,
          sessionId: event.sessionId,
          title,
          kindLabel: t(kindLabel),
          body: t('agent.error') + tool + message,
          ts: now,
          variant: 'error',
        } satisfies ToastItem)
      }
      if (cfg.sound && !inQuiet(cfg)) playResolvedCue(cfg.volume)
      if (cfg.failureNotify && cfg.notify) notifyOs(
        { id: event.sessionId ?? '' },
        t('notify.error.title'),
        t('notify.error.body', { kindLabel: t(kindLabel), tool, title, message }),
        {
          onClick: () => jumpToSession(sessions, sid),
        },
      )
    } catch (error) {
      console.warn('[notifications] agent feed handler', error)
    }
  }
  if (typeof remote.$on !== 'function') return () => {}
  const dispose = remote.$on(ALERTER_REMOTE_EVENT, onFeed)
  return () => { if (typeof dispose === 'function') dispose() }
}

export interface ConnectionChannels {
  toast: ToastStore
}

/**
 * ② Watch the shared `connection` service's HostDescription source.
 * The service face is `{ api, hostDescription: { getSnapshot, subscribe }, rpc,
 * start(sinks) }` — getSnapshot lives UNDER hostDescription, and start() is
 * owned exclusively by the runtime (a second start() throws). We never call
 * start(); hostDescription.getSnapshot() is undefined before connect and while
 * reconnecting; alert once the connected→reconnecting edge persists past
 * `connectionAlertAfterMs`, then a light "reconnected" cue on restore.
 */
export function startConnectionMonitor(conn: ConnectionLike, cfg: AlerterConfig, channels: ConnectionChannels): () => void {
  let phase: 'boot' | 'connected' | 'reconnecting' = 'boot'
  let lostAt = 0
  let alerted = false
  let timer: ReturnType<typeof setTimeout> | null = null
  const clearTimer = () => { if (timer !== null) { clearTimeout(timer); timer = null } }
  const source = conn.hostDescription

  const check = () => {
    const connected = source.getSnapshot() !== void 0
    if (phase === 'boot') { phase = connected ? 'connected' : 'boot'; return }
    if (connected) {
      // The restore cue pairs with an actually-alerted loss: a quick blip that
      // never crossed the threshold stays silent (no conn:down, no conn:up).
      if (phase === 'reconnecting' && alerted) {
        if (cfg.toast) channels.toast.push({ key: 'conn:up', sessionId: void 0, title: t('conn.restored'), kindLabel: t('conn.restored'), ts: Date.now(), variant: 'done' })
        if (cfg.sound && !inQuiet(cfg)) playDoneCue(cfg.volume)
      }
      phase = 'connected'
      alerted = false
      lostAt = 0
      clearTimer()
      return
    }
    if (phase === 'connected') { lostAt = Date.now(); alerted = false }
    if (!alerted && Date.now() - lostAt >= cfg.connectionAlertAfterMs) {
      alerted = true
      clearTimer()
      if (cfg.toast) channels.toast.push({ key: 'conn:down', sessionId: void 0, title: t('conn.lost'), kindLabel: t('conn.lost'), ts: Date.now(), variant: 'warning' })
      if (cfg.sound && !inQuiet(cfg)) playChime(cfg.volume)
    } else if (timer === null) {
      timer = setTimeout(() => { timer = null; check() }, Math.max(1000, cfg.connectionAlertAfterMs))
    }
    phase = 'reconnecting'
  }

  const unsubscribe = typeof source.subscribe === 'function' ? source.subscribe(check) : () => {}
  check()
  return () => { unsubscribe(); clearTimer() }
}