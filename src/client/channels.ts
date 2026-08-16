/**
 * Alert channel primitives: synthesized WebAudio cues (no asset files),
 * quiet-hours gating, and the lazy OS notification (permission requested on
 * the next user gesture).
 */
import type { AlerterConfig, AlerterKind, SessionRowLike } from './types.ts'
import { t } from './locales.ts'

/** Kind display labels (session rows surface these strings). */
export const KIND_LABEL: Record<string, () => string> = {
  approval: () => t('kind.approval'),
  'plan-review': () => t('kind.planReview'),
  question: () => t('kind.question'),
}

export function kindLabel(kind: string): string {
  return (KIND_LABEL[kind] ?? (() => kind))()
}

interface AudioContextLike {
  state: string
  currentTime: number
  resume(): Promise<void>
  createOscillator(): OscillatorNodeLike
  createGain(): GainNodeLike
  destination: unknown
}
interface OscillatorNodeLike {
  type: string
  frequency: { value: number }
  connect(node: unknown): void
  start(at: number): void
  stop(at: number): void
}
interface GainNodeLike {
  gain: { setValueAtTime(v: number, at: number): void; exponentialRampToValueAtTime(v: number, at: number): void }
  connect(node: unknown): void
}

function audioContext(): AudioContextLike | undefined {
  const w = typeof window === 'undefined' ? void 0 : (window as unknown as Record<string, unknown>)
  const AC = w?.['AudioContext'] ?? w?.['webkitAudioContext']
  if (typeof AC !== 'function') return void 0
  try {
    const ac = new (AC as new () => AudioContextLike)()
    if (ac.state === 'suspended') void ac.resume().catch(() => {})
    return ac
  } catch {
    return void 0
  }
}

/** Play the alert chime: three ascending sine notes (E5-G5-B5). */
export function playChime(volume: number): void {
  const ac = audioContext()
  if (ac === void 0) return
  try {
    const notes = [659.25, 783.99, 987.77]
    const t0 = ac.currentTime + 0.02
    notes.forEach((freq, index) => {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = t0 + index * 0.12
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28)
      osc.connect(gain)
      gain.connect(ac.destination)
      osc.start(start)
      osc.stop(start + 0.3)
    })
  } catch { /* audio is best-effort; visual channels still fire */ }
}

/** Soft two-note downward cue (opt-in, for resolved approvals). */
export function playResolvedCue(volume: number): void {
  const ac = audioContext()
  if (ac === void 0) return
  try {
    const notes = [783.99, 659.25]
    const t0 = ac.currentTime + 0.02
    notes.forEach((freq, index) => {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = t0 + index * 0.1
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume * 0.6), start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22)
      osc.connect(gain)
      gain.connect(ac.destination)
      osc.start(start)
      osc.stop(start + 0.25)
    })
  } catch {}
}

/** Soft single ascending note for completions (quieter than the alert chime). */
export function playDoneCue(volume: number): void {
  const ac = audioContext()
  if (ac === void 0) return
  try {
    const freq = 659.25
    const t0 = ac.currentTime + 0.02
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume * 0.5), t0 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3)
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.start(t0)
    osc.stop(t0 + 0.35)
  } catch {}
}

/** Whether `now` falls inside the configured quiet hours (sound suppression only). */
export function inQuiet(cfg: AlerterConfig): boolean {
  if (cfg.quiet?.enabled !== true) return false
  const d = new Date()
  const nowMin = d.getHours() * 60 + d.getMinutes()
  const parse = (value: string | undefined, fallback: string): number => {
    const parts = String(value ?? fallback).split(':').map(Number)
    return (parts[0] ?? 0) * 60 + (parts[1] ?? 0)
  }
  const startMin = parse(cfg.quiet.start, '23:00')
  const endMin = parse(cfg.quiet.end, '08:00')
  return startMin <= endMin ? nowMin >= startMin && nowMin < endMin : nowMin >= startMin || nowMin < endMin
}

/**
 * Shared "jump to session" callback for notification onClick handlers:
 * focus the browser window and open the given session in the DSH UI.
 * Silently no-ops if sessions is unavailable or open() throws.
 */
export function jumpToSession(sessions: { open(id: string): unknown } | undefined, sid: string): void {
  try { window.focus() } catch {}
  if (sessions !== void 0 && sid !== '') try { sessions.open(sid) } catch {}
}

/**
 * OS-level notification (requires permission; requested lazily on a user gesture).
 *
 * Callers provide the *final* title and body directly so each event type can
 * have its own semantics — no more “task completed” being templated into
 * “needs action”. Each caller is responsible for picking the matching
 * `notify.<event>.title` + `notify.<event>.body` dictionary keys.
 */
export function notifyOs(
  row: { id: string },
  notifTitle: string,
  notifBody: string,
  opts?: { onClick?: () => void; requireInteraction?: boolean },
): void {
  if (!('Notification' in window)) return
  const tag = 'dsh-notifications:' + row.id
  const attach = (n: Notification): void => {
    const onClick = opts?.onClick
    if (typeof onClick === 'function') {
      try {
        n.onclick = (ev) => {
          ev.preventDefault()
          try { n.close() } catch {}
          try { onClick() } catch {}
        }
      } catch {}
    }
  }
  const fire = () => {
    try {
      const n = new Notification(notifTitle, {
        body: notifBody,
        tag,
        silent: false,
        requireInteraction: opts?.requireInteraction === true,
      })
      attach(n)
    } catch {}
  }
  if (Notification.permission === 'granted') fire()
  else if (Notification.permission === 'default') {
    const request = () => {
      window.removeEventListener('pointerdown', request)
      Notification.requestPermission().then((permission) => { if (permission === 'granted') fire() })
    }
    window.addEventListener('pointerdown', request, { once: true })
  }
}

/**
 * Background attention cue for completions: blink the tab title and pulse the
 * PWA icon badge, then restore both after a few seconds. Used instead of the
 * corner card while the page is hidden (a hidden corner card is invisible).
 */
export function pulseCompletionTab(title: string, durationMs = 5000): void {
  try {
    const marker = `✓ ${title} — `
    const restore = () => {
      try {
        if (typeof document !== 'undefined' && document.title.startsWith(marker)) {
          document.title = document.title.slice(marker.length)
        }
      } catch {}
    }
    if (typeof document !== 'undefined') {
      const base = document.title.replace(/^✓ [^—]*— /, '')
      document.title = `${marker}${base}`
      setTimeout(restore, durationMs)
    }
    const nav = (typeof navigator !== 'undefined' ? navigator : void 0) as { setAppBadge?: (count?: number) => Promise<void>; clearAppBadge?: () => Promise<void> } | undefined
    try { void nav?.setAppBadge?.(1) } catch {}
    const clearBadge = () => { try { void nav?.clearAppBadge?.() } catch {} }
    setTimeout(clearBadge, durationMs)
  } catch {}
}

export type { AlerterKind, SessionRowLike }