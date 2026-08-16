/**
 * Core sentinel: subscribe to the sessions list store, detect the edge at
 * which a session's `pendingInteraction` appears under an alerted kind, and
 * fan the alert out. Replays (reconnect / refresh) are de-duplicated with a
 * per-(session,kind) cooldown; the first baseline pass never fires — only
 * transitions alert. Pending IDENTITY visuals belong to the dock (its live
 * projection updates the count); the sentinel only pulses it on arrival.
 */
import type { SessionRowLike, SessionsLike } from './types.ts'
import { inQuiet, jumpToSession, kindLabel, notifyOs, playChime, playResolvedCue } from './channels.ts'
import { installTitleBadge, updateAppBadge, installFaviconBadge } from './badge.ts'
import { t } from './locales.ts'

export interface SentinelChannels {
  /** Dock arrival pulse (null-safe when the dock is disabled). */
  onArrive?(): void
}

export function startSentinel(sessions: SessionsLike, cfg: import('./types.ts').AlerterConfig, channels: SentinelChannels): () => void {
  const previous = new Map<string, string>()
  const firedAt = new Map<string, number>()
  let seeded = false
  let pendingTotal = 0
  const titleBadge = cfg.badge ? installTitleBadge() : null
  const faviconBadge = cfg.badge ? installFaviconBadge() : null
  const refreshTitle = () => {
    titleBadge?.setCount(pendingTotal)
    faviconBadge?.setCount(pendingTotal)
    updateAppBadge(pendingTotal)
  }

  const onAlert = (row: SessionRowLike, kind: string, silenced?: boolean) => {
    if (silenced !== true) {
      if (cfg.sound && !inQuiet(cfg)) playChime(cfg.volume)
      if (cfg.notify) {
        const title = row.displayTitle ?? row.id
        notifyOs(row, t('notify.pending.title'), t('notify.pending.body', { title, kind: kindLabel(kind) }), {
          requireInteraction: kind === 'approval',
          onClick: () => jumpToSession(sessions, row.id),
        })
      }
    }
    channels.onArrive?.()
    refreshTitle()
  }
  const onResolved = () => {
    if (cfg.soundResolved && !inQuiet(cfg)) playResolvedCue(cfg.volume)
    refreshTitle()
  }

  const reconcile = () => {
    const snapshot = sessions.list.getSnapshot()
    const next = new Map<string, string>()
    for (const sid of snapshot.ids) {
      const row = snapshot.byId[sid]
      if (row === void 0) continue
      const interaction = row.pendingInteraction
      if (interaction !== void 0 && cfg.alertKinds.includes(interaction)) next.set(sid, interaction)
    }
    // Baseline pass: record what is already pending; only transitions alert.
    if (!seeded) {
      seeded = true
      pendingTotal = next.size
      if (pendingTotal > 0) for (const [sid, kind] of next) previous.set(sid, kind)
      refreshTitle()
      return
    }
    if (previous.size === 0 && next.size === 0) return
    const now = Date.now()
    const pageVisible = typeof document !== 'undefined' && document.visibilityState === 'visible'
    const current = snapshot.current
    for (const [sid, kind] of next) {
      if (previous.get(sid) === kind) continue
      if (now - (firedAt.get(`${sid}:${kind}`) ?? 0) < cfg.cooldownMs) continue
      firedAt.set(`${sid}:${kind}`, now)
      const silenced = pageVisible && current !== void 0 && sid === current
      onAlert(snapshot.byId[sid]!, kind, silenced)
    }
    for (const [sid, kind] of previous) {
      if (next.get(sid) !== kind) onResolved()
    }
    previous.clear()
    if (next.size > 0) for (const [sid, kind] of next) previous.set(sid, kind)
    pendingTotal = next.size
    refreshTitle()
  }

  const unsubscribe = sessions.list.subscribe(reconcile)
  reconcile() // seed the baseline; the first pass never fires
  return () => {
    unsubscribe()
    titleBadge?.dispose()
    faviconBadge?.dispose()
    updateAppBadge(0)
  }
}

export { t }