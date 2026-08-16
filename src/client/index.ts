/**
 * Client plugin body: register dictionaries, then the OFFICIAL plugin-config
 * settings card (`settings.plugin.item` slot — standalone, NOT the family's
 * `web-ui.plugin.item` group), then the live monitors (pending sentinel →
 * dock pulse, completion / job-failure lifecycle, connection) bound to a
 * config that a settings-scope subscription live-updates.
 *
 * Failure policy (mirrors the family rule): every wiring failure is logged,
 * never thrown — a throw in one surface must not kill the rest of the entry,
 * and the boot graph must never fail because of this plugin. Registration
 * order matters: the settings card comes FIRST, so even a hostile monitor
 * cannot prevent the card from existing.
 *
 * All services are fetched via `ctx.get(...)` with guards; the bundle itself
 * carries zero @deepseek-ai requires (externals resolve from the shell's
 * frozen module table).
 */
import type { AlerterConfig, AlerterKind, BinderLike, ConnectionLike, SessionsLike, ScopeLike, ToastItem, ToastVariant } from './types.ts'
import { DEFAULTS } from './types.ts'
import { NS, pickDict, setDict, t, zh, en } from './locales.ts'
import { playDoneCue } from './channels.ts'
import { createToastStore, createDockStore } from './stores.ts'
import { mountToasts } from './toast-mount.tsx'
import { startSentinel } from './sentinel.ts'
import { startDock } from './dock.ts'
import { startLifecycleMonitor, startConnectionMonitor, startAgentEvents, jobSamples, seenJobStatuses, jobStatusCounts, hostJobStatuses, hostJobStatusCounts, hostFeedCounters, lastHeartbeatAt } from './lifecycle.ts'
import { mountGlow } from './glow.ts'
import { createSettingsCardController, AlerterSettingsCard } from './settings-card.tsx'

/**
 * Services required by this plugin. The BOOT GRAPH is driven by the
 * package.json `dsh.client.inject` (provider packages); this export is the
 * apply-time service-level declaration — mirror the same set there and here.
 */
export const inject = ['sessions', 'locale', 'slots', 'settingsScope', 'connection', 'remote']

/** Merge runtime/entry config over the hard defaults, then settings over that. */
function mergeConfig(base: AlerterConfig, overrides: unknown): AlerterConfig {
  const merged: Record<string, unknown> = { ...base }
  if (overrides !== void 0 && overrides !== null && typeof overrides === 'object') {
    for (const key of Object.keys(overrides)) merged[key] = (overrides as Record<string, unknown>)[key]
  }
  return merged as AlerterConfig
}

interface ClientContext {
  get(name: string): unknown
  effect(fn: () => unknown, label?: string): () => void
  locale: { register(namespace: string, dicts: object): unknown }
}

interface LocaleService {
  register(namespace: string, dicts: object): unknown
}

interface SlotsService {
  inject(name: string, fn: () => unknown): () => void
  register(opts: object, component: unknown): unknown
}

/** Diagnostics the web console / debugging surface can read after apply. */
interface AlerterDiagnostics {
  applied: boolean
  sessions: boolean
  locale: boolean
  binder: 'webUiSettings' | 'settingsScope' | 'none'
  scopeStatus: string
  cardRegistered: boolean
  monitors: string[]
  errors: string[]
  jobSamples: unknown[]
  /** Whether the on-device observation ring is enabled. */
  diagnostics: boolean
  /** Every job status observed on this page (auto-collected, always on). */
  seenStatuses: string[]
  /** Per-status observation counts. */
  statusCounts: Record<string, number>
  /** Host-forwarded job statuses (complete vocabulary incl. intermediate states). */
  hostStatuses: string[]
  /** Per-status counts of host-forwarded transitions. */
  hostStatusCounts: Record<string, number>
  /** Agent anomaly (429 etc.) toasts shown. */
  agentErrors: number
  /** Push a one-shot demo toast card (visual preview); variant optional. */
  demo?(variant?: ToastVariant): void
  /** Play the completion cue once (volume 0–1; defaults to the built-in 0.15). */
  demoSound?(volume?: number): void
  /** Whether the injected `connection` service resolved, and its getSnapshot type. */
  connAvailable: boolean
  connShape: string
}

const diag: AlerterDiagnostics = { applied: false, sessions: false, locale: false, binder: 'none', scopeStatus: 'unset', cardRegistered: false, monitors: [], errors: [], jobSamples: [], diagnostics: true, seenStatuses: [], statusCounts: {}, hostStatuses: [], hostStatusCounts: {}, agentErrors: 0, connAvailable: false, connShape: 'unknown' }
const fail = (errors: string[], where: string, label: string, error: unknown) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  errors.push(`${label}@${where} :: ${message}`)
  console.warn(`[notifications] ${label} failed in ${where}`, error)
}

export function apply(ctx: ClientContext, config?: Partial<AlerterConfig>): void {
  const errors: string[] = []
  try { setDict(pickDict()); diag.locale = true } catch (error) { fail(errors, 'apply', 'locale pick', error) }
  try {
    ctx.effect(() => (ctx.locale as LocaleService).register(NS, { zh, en }), 'notifications: dictionaries')
  } catch (error) { fail(errors, 'apply', 'locale register', error) }

  const sessions = ctx.get('sessions') as SessionsLike | undefined
  diag.sessions = sessions !== void 0 && sessions.list !== void 0 && typeof sessions.list.subscribe === 'function'
  if (!diag.sessions) {
    fail(errors, 'apply', 'sessions guard', new Error('sessions service unavailable'))
    diag.applied = true
    return
  }
  const base: AlerterConfig = config === void 0 ? DEFAULTS : { ...DEFAULTS, ...config }

  // ---- Settings scope + OFFICIAL settings card FIRST (independent surface). ----
  const binder = (ctx.get('webUiSettings') ?? ctx.get('settingsScope')) as BinderLike | undefined
  diag.binder = (ctx.get('webUiSettings') as unknown) !== void 0 ? 'webUiSettings' : (binder !== void 0 ? 'settingsScope' : 'none')
  let served: unknown = void 0
  const scope = binder !== void 0 && binder !== null && typeof binder.bind === 'function'
    ? (binder.bind({ namespace: NS }) as ScopeLike)
    : null
  if (scope !== null) {
    try {
      const readValue = (): unknown => {
        try {
          const snapshot = scope.getSnapshot()
          diag.scopeStatus = snapshot === null || snapshot === void 0 || typeof snapshot !== 'object' ? 'missing' : String(snapshot.status)
          return snapshot !== null && typeof snapshot === 'object' && snapshot.value !== null && typeof snapshot.value === 'object'
            ? snapshot.value
            : void 0
        } catch { return void 0 }
      }
      served = readValue()
      let timer: ReturnType<typeof setTimeout> | null = null
      const unsub = scope.subscribe(() => {
        clearTimeout(timer ?? void 0)
        timer = setTimeout(() => {
          const value = readValue()
          if (value !== void 0) mount(mergeConfig(base, value))
        }, 120)
      })
      ctx.effect(() => () => { if (timer !== null) clearTimeout(timer); unsub() }, 'notifications: settings subscription')
      const slots = ctx.get('slots') as SlotsService | undefined
      if (slots !== void 0 && typeof slots.inject === 'function') {
        const controller = createSettingsCardController(scope)
        ctx.effect(() => slots.inject('settings.plugin.item', () => slots.register({
          name: 'settings.plugin.item',
          id: 'notifications',
          order: 30,
          locale: NS,
          inject: () => controller.inject(),
        }, AlerterSettingsCard)), 'notifications: settings card')
        diag.cardRegistered = true
      } else {
        fail(errors, 'card', 'slots service', new Error('slots unavailable'))
      }
    } catch (error) {
      fail(errors, 'card+scope', 'settings bind', error)
    }
  } else {
    fail(errors, 'card', 'settings binder', new Error('no webUiSettings/settingsScope binder'))
  }

  // ---- Toast portal (one-shot events: completions, job failures, connection). ----
  const toastStore = createToastStore()
  diag.demo = (variant: ToastVariant = 'info'): void => {
    try {
      toastStore.push({
        key: `demo:${Date.now()}`,
        title: t('demo.title'),
        kindLabel: `variant · ${variant}`,
        body: t('demo.body'),
        ts: Date.now(),
        variant,
      })
    } catch (error) { console.warn('[notifications] demo toast', error) }
  }
  diag.demoSound = (volume?: number): void => {
    try {
      const v = typeof volume === 'number' && Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.15
      playDoneCue(v)
    } catch (error) { console.warn('[notifications] demo sound', error) }
  }
  const actions = {
    go: (item: ToastItem) => {
      toastStore.remove(item.key)
      if (item.sessionId !== void 0) {
        try { sessions.open(item.sessionId) } catch (error) { console.warn('[notifications] open session', error) }
      }
    },
    dismiss: (item: ToastItem) => toastStore.remove(item.key),
  }
  try {
    const disposeToasts = base.toast ? mountToasts(toastStore, actions) : () => {}
    ctx.effect(() => () => disposeToasts(), 'notifications: toasts')
  } catch (error) { fail(errors, 'mount', 'toasts', error) }

  const dockStore = base.dock ? createDockStore() : null

  let mountDispose = () => {}
  const mount = (cfg: AlerterConfig) => {
    mountDispose()
    const disposers: Array<() => void> = []
    const reg = (fn: () => unknown, label: string) => { disposers.push(ctx.effect(fn, label)) }
    const safeReg = (fn: () => unknown, label: string) => {
      try { reg(fn, label); diag.monitors.push(label) } catch (error) { fail(errors, 'mount', label, error) }
    }
    safeReg(() => startSentinel(sessions, cfg, { onArrive: () => { dockStore?.pulse() } }), 'sentinel')
    if (cfg.dock) safeReg(() => startDock(dockStore!, sessions, cfg), 'dock')
    if (cfg.completion || cfg.jobFailure) safeReg(() => startLifecycleMonitor(sessions, cfg, { toast: toastStore }), 'lifecycle')
    const conn = ctx.get('connection') as { hostDescription?: { getSnapshot?: unknown; subscribe?: unknown } } | undefined
    const hostDescription = conn !== void 0 && typeof conn === 'object' && conn !== null && typeof conn.hostDescription === 'object' && conn.hostDescription !== null
      ? conn.hostDescription
      : void 0
    diag.connAvailable = conn !== void 0
    diag.connShape = hostDescription !== void 0 ? typeof hostDescription.getSnapshot : 'missing'
    if (cfg.connection && hostDescription !== void 0 && typeof hostDescription.getSnapshot === 'function') {
      safeReg(() => startConnectionMonitor(conn as ConnectionLike, cfg, { toast: toastStore }), 'connection')
    }
    const remote = ctx.get('remote') as { $on?(event: string, handler: (payload: unknown) => void): unknown } | undefined
    diag.remoteKeys = remote !== void 0 && typeof remote === 'object' && !Array.isArray(remote) ? Object.keys(remote).sort() : 'missing'
    if (remote !== void 0 && typeof remote.$on === 'function') {
      safeReg(() => startAgentEvents(remote, cfg, { toast: toastStore }, sessions), 'agent-events')
    }
    if (cfg.glow) safeReg(() => mountGlow(toastStore, dockStore), 'glow')
    mountDispose = () => { for (const d of disposers.reverse()) { try { d() } catch (error) { fail(errors, 'mount', 'disposer', error) } } }
  }

  try { mount(mergeConfig(base, served)) } catch (error) { fail(errors, 'mount', 'initial mount', error) }

  diag.applied = true
  diag.errors = errors
  diag.jobSamples = jobSamples
  diag.diagnostics = (mergeConfig(base, served)).diagnostics === true
  diag.seenStatuses = [...seenJobStatuses].sort()
  diag.statusCounts = { ...jobStatusCounts }
  diag.hostStatuses = [...hostJobStatuses].sort()
  diag.hostStatusCounts = { ...hostJobStatusCounts }
  diag.feedCounters = { ...hostFeedCounters }
  diag.lastHeartbeatAt = lastHeartbeatAt
  diag.agentErrors = toastStore.getSnapshot().filter((i) => i.key.startsWith('agenterr:')).length
  try {
    (globalThis as Record<string, unknown>).__NOTIFICATIONS__ = diag
  } catch { /* diagnostics are best-effort */ }
}

export type { AlerterKind }
export { diag as __diagnostics }
export { startAgentEvents, hostJobStatuses, hostJobStatusCounts, hostFeedCounters, lastHeartbeatAt } from './lifecycle.ts'