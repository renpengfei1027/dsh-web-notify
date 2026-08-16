/** Ambient edge glow — idle by default; flashes on completion/error, steady orange when pending. */
import type { ToastStore } from './stores.ts'
import type { DockStore } from './dock.ts'

const GLOW_ROOT_ID = 'dsh-web-notify-glow'
const STYLE_ID = 'dsh-web-notify-glow-vars'
const FLASH_MS = 1600

const STYLE_CSS = `#${GLOW_ROOT_ID}{
position:fixed;inset:0;pointer-events:none;z-index:2147482998;
box-shadow:inset 0 0 24px 3px transparent;
transition:box-shadow .3s ease;
}`

const STEADY_PENDING = 'rgba(245,166,35,.20)'
const FLASH_GREEN = 'rgba(29,201,129,.50)'
const FLASH_RED = 'rgba(229,72,72,.50)'

export function mountGlow(toastStore: ToastStore, dockStore: DockStore | null): () => void {
  let styleEl = document.getElementById(STYLE_ID)
  if (styleEl === null) {
    styleEl = document.createElement('style')
    styleEl.id = STYLE_ID
    styleEl.textContent = STYLE_CSS
    document.head.appendChild(styleEl)
  }

  let glowEl = document.getElementById(GLOW_ROOT_ID)
  if (glowEl === null) {
    glowEl = document.createElement('div')
    glowEl.id = GLOW_ROOT_ID
    document.body.appendChild(glowEl)
  }

  const el = glowEl
  let prevKeys = new Set<string>()
  let firstRun = true
  let flashTimer: ReturnType<typeof setTimeout> | null = null
  let steadyPending = false

  function setShadow(color: string): void {
    el.style.boxShadow = `inset 0 0 24px 3px ${color}`
  }

  function applySteady(): void {
    el.style.transition = 'box-shadow .6s ease'
    setShadow(steadyPending ? STEADY_PENDING : 'transparent')
  }

  function flash(color: string): void {
    el.style.transition = 'box-shadow .12s ease'
    setShadow(color)
    if (flashTimer !== null) clearTimeout(flashTimer)
    flashTimer = setTimeout(() => {
      flashTimer = null
      applySteady()
    }, FLASH_MS)
  }

  function update(): void {
    const toasts = toastStore.getSnapshot()
    const dockCount = dockStore?.getSnapshot().rows.length ?? 0

    const currentKeys = new Set<string>()
    for (const toast of toasts) {
      currentKeys.add(toast.key)
      if (!firstRun && !prevKeys.has(toast.key)) {
        if (toast.variant === 'done') flash(FLASH_GREEN)
        else if (toast.variant === 'error' || toast.variant === 'warning') flash(FLASH_RED)
      }
    }
    prevKeys = currentKeys
    firstRun = false

    const nextSteady = dockCount > 0
    if (nextSteady !== steadyPending) {
      steadyPending = nextSteady
      if (flashTimer === null) applySteady()
    }
  }

  const unsubToast = toastStore.subscribe(update)
  const unsubDock = dockStore?.subscribe(update) ?? (() => {})
  update()

  return () => {
    unsubToast()
    unsubDock()
    if (flashTimer !== null) clearTimeout(flashTimer)
    el.style.boxShadow = 'inset 0 0 24px 3px transparent'
    el.remove()
    styleEl.remove()
  }
}
