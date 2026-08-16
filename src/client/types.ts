/**
 * Local structural types for the alerter.
 *
 * These are deliberately loose (no @deepseek-ai imports): the browser bundle
 * must carry zero @deepseek-ai *runtime* requires (everything comes from
 * `ctx.get(...)` with guards), and this package builds offline with esbuild.
 * A future tsc + tsdown swap can replace these with the real types from
 * `@deepseek-ai/dsh-client-runtime/client`
 * (SessionSummary / SessionListState / JobView / SettingsScope / SnapshotStore).
 */

/** The approval interaction kinds this plugin alerts on. */
export type AlerterKind = 'approval' | 'plan-review' | 'question'

/** Quiet-hours block (sound suppression only). */
export interface QuietHours {
  enabled: boolean
  start: string
  end: string
}

/** Effective configuration for every alert channel. */
export interface AlerterConfig {
  sound: boolean
  volume: number
  badge: boolean
  toast: boolean
  notify: boolean
  dock: boolean
  completion: boolean
  completionSound: boolean
  completionNotify: boolean
  connection: boolean
  connectionAlertAfterMs: number
  jobFailure: boolean
  /** One OS-notify switch shared by ③ failures and ④ runtime anomalies. */
  failureNotify: boolean
  /** ④ model/tool runtime errors (429 quota, max-tokens, interrupted, tool errors). */
  agentError: boolean
  cooldownMs: number
  /** On-device observation ring (`jobSamples`) on/off; the status set is always collected. */
  diagnostics: boolean
  glow: boolean
  alertKinds: readonly AlerterKind[]
  quiet: QuietHours
  soundResolved: boolean
}

/** Defaults; overridden by the settings scope at runtime (live reconfig). */
export const DEFAULTS: AlerterConfig = {
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
  connectionAlertAfterMs: 10000,
  jobFailure: true,
  failureNotify: false,
  agentError: true,
  cooldownMs: 5000,
  diagnostics: true,
  glow: true,
  alertKinds: ['approval', 'plan-review', 'question'],
  quiet: { enabled: false, start: '23:00', end: '08:00' },
  soundResolved: false,
}

/** One sessions.list row, projected to the fields the alerter reads. */
export interface SessionRowLike {
  id: string
  displayTitle?: string
  pendingInteraction?: AlerterKind
  completed?: boolean
  updatedAt?: number
}

/** One background job (sessions snapshot `jobsBySession` value). */
export interface JobLike {
  id?: string
  kind?: string
  label?: string
  status?: string
  detail?: string
}

/** The parts of the sessions list snapshot the alerter consumes. */
export interface SessionListSnapshotLike {
  ids: readonly string[]
  byId: Record<string, SessionRowLike | undefined>
  current?: string
  jobsBySession?: Readonly<Record<string, readonly (JobLike | null)[] | undefined>>
}

/** A uSES-friendly list store (the `sessions.list` service surface). */
export interface ListStoreLike {
  subscribe(fn: () => void): () => void
  getSnapshot(): SessionListSnapshotLike
}

/** The `sessions` client service (injected). */
export interface SessionsLike {
  list: ListStoreLike
  open(id: string): void
}

/** The shared `connection` service: HostDescription source only (never start()). */
export interface ConnectionLike {
  hostDescription: {
    getSnapshot(): unknown
    subscribe?(fn: () => void): () => void
  }
}

/** Snapshot of a bound settings scope. */
export interface ScopeSnapshotLike {
  status?: string
  writable?: boolean
  value?: unknown
  base?: unknown
  user?: unknown
}

/** The bound settings scope for our namespace (webUiSettings ?? settingsScope). */
export interface ScopeLike {
  getSnapshot(): ScopeSnapshotLike
  subscribe(fn: () => void): () => void
  set(field: string, value: unknown): Promise<unknown> | unknown
  unset(field: string): Promise<unknown> | unknown
}

/** A settings binder (webUiSettings / settingsScope service). */
export interface BinderLike {
  bind(opts: { namespace: string }): ScopeLike
}

/**
 * Visual variant of a toast card. Kept separate from the event kind so the
 * styling map can later grow per situation (status ↔ style) without touching
 * the event wiring.
 */
export type ToastVariant = 'done' | 'error' | 'warning' | 'info'

/** One toast card item. */
export interface ToastItem {
  key: string
  sessionId?: string
  title: string
  kindLabel: string
  body?: string
  ts: number
  /** Styling variant; defaults to 'info' when absent. */
  variant?: ToastVariant
}

/** One row of the Approval Hub dock. */
export interface DockRow {
  key: string
  sessionId: string
  title: string
  kind: AlerterKind
  kindLabel: string
  ts: number
}

/** Toast stack actions (fire-and-forget navigation). */
export interface ToastActions {
  go(item: ToastItem): void
  dismiss(item: ToastItem): void
}