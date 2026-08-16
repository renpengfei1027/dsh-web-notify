/**
 * Mounts the toast portal into document.body; returns its unmounter.
 */
import { createRoot } from 'react-dom/client'
import { jsx } from 'react/jsx-runtime'
import { ToastStack, TOAST_ROOT_ID } from './toast-ui.tsx'
import type { ToastActions, ToastItem } from './types.ts'
import type { ToastStore } from './stores.ts'

export function mountToasts(store: ToastStore, actions: ToastActions): () => void {
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
  }
}

export type { ToastActions, ToastItem, ToastStore }