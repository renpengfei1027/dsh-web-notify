/**
 * Mounts the toast portal into document.body; returns its unmounter.
 */
import { createRoot } from 'react-dom/client'
import { jsx } from 'react/jsx-runtime'
import { ToastStack, TOAST_ROOT_ID } from './toast-ui.tsx'
import type { ToastActions, ToastItem } from './types.ts'
import type { ToastStore } from './stores.ts'

/**
 * Plugin-owned CSS variables. Each inherits from the host theme token when
 * available, falling back to a self-maintained literal. Components reference
 * only `--notify-*` names — never raw `--dsw-*`.
 */
const STYLE_ID = 'dsh-web-notify-vars'
const STYLE_CSS = `#${TOAST_ROOT_ID}{
--notify-accent-error:var(--dsw-alias-label-error,#e54848);
--notify-accent-warning:var(--dsw-alias-state-warn-primary,#f5a623);
--notify-accent-done:var(--dsw-alias-state-warn-secondary,#f5a623);
--notify-accent-info:var(--dsw-alias-state-warn-primary,#f5a623);
--notify-label-primary:var(--dsw-alias-label-primary,#1a1a1a);
--notify-label-tertiary:var(--dsw-alias-label-tertiary,#888);
--notify-bg-major:var(--dsw-specific-input-major,#fff);
--notify-bg-hover:var(--dsw-alias-interactive-bg-hover,#f0f0f0);
--notify-shadow:var(--dsw-shadow-lv2,0 2px 12px rgba(0,0,0,.12));
--notify-font:var(--ds-font-family,inherit);
}`

export function mountToasts(store: ToastStore, actions: ToastActions): () => void {
  let styleEl = document.getElementById(STYLE_ID)
  if (styleEl === null) {
    styleEl = document.createElement('style')
    styleEl.id = STYLE_ID
    styleEl.textContent = STYLE_CSS
    document.head.appendChild(styleEl)
  }

  let rootEl = document.getElementById(TOAST_ROOT_ID)
  if (rootEl === null) {
    rootEl = document.createElement('div')
    rootEl.id = TOAST_ROOT_ID
    document.body.appendChild(rootEl)
  }
  const reactRoot = createRoot(rootEl)
  reactRoot.render(jsx(ToastStack, { store, onGo: actions.go, onDismiss: actions.dismiss }, void 0))
  return () => {
    reactRoot.unmount()
    const el = document.getElementById(TOAST_ROOT_ID)
    if (el !== null && el.childNodes.length === 0) el.remove()
    const st = document.getElementById(STYLE_ID)
    if (st !== null) st.remove()
  }
}

export type { ToastActions, ToastItem, ToastStore }