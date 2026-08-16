/**
 * Persistent Approval Hub: bottom-right FAB (live count + arrival pulse) and
 * an expandable panel listing every pending (kind-filtered) row, newest
 * first. Rendered through a document.body portal.
 */
import { Fragment, useEffect, useState, useSyncExternalStore } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { createRoot } from 'react-dom/client'
import type { AlerterConfig, AlerterKind, DockRow, SessionsLike } from './types.ts'
import type { DockStore } from './stores.ts'
import { ACTION_BTN_STYLE } from './toast-ui.tsx'
import { kindLabel } from './channels.ts'
import { t } from './locales.ts'

export const DOCK_ROOT_ID = 'dsh-notifications-dock-root'

const KIND_DOT: Record<AlerterKind, string> = {
  approval: 'var(--dsw-alias-state-warn-primary)',
  'plan-review': 'var(--dsw-alias-state-business-primary)',
  question: 'var(--dsw-alias-label-tertiary)',
}
const KIND_TEXT: Record<AlerterKind, string> = KIND_DOT

const PANEL_STYLE: Record<string, string> = {
  boxSizing: 'border-box',
  position: 'fixed',
  right: '16px',
  bottom: '78px',
  zIndex: '2147483000',
  display: 'flex',
  flexDirection: 'column',
  width: 'min(360px, calc(100vw - 32px))',
  maxHeight: '60vh',
  borderRadius: '12px',
  border: '1px solid var(--dsw-alias-state-warn-secondary)',
  background: 'var(--dsw-specific-input-major)',
  boxShadow: 'var(--dsw-shadow-lv2)',
  color: 'var(--dsw-alias-label-primary)',
  fontFamily: 'var(--ds-font-family)',
  fontSize: '13px',
  lineHeight: '18px',
  padding: '10px 12px',
  gap: '4px',
}
const FAB_STYLE: Record<string, string> = {
  boxSizing: 'border-box',
  position: 'fixed',
  right: '16px',
  bottom: '20px',
  zIndex: '2147483000',
  cursor: 'pointer',
  border: 'none',
  borderRadius: '999px',
  minWidth: '48px',
  height: '48px',
  padding: '0 14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  background: 'var(--dsw-alias-state-warn-primary)',
  color: 'var(--dsw-alias-state-warn-label)',
  fontFamily: 'var(--ds-font-family)',
  fontSize: '14px',
  lineHeight: '20px',
  fontWeight: '700',
  boxShadow: 'var(--dsw-shadow-lv2)',
}

export interface DockPanelProps {
  store: DockStore
  onGo(item: DockRow): void
}

/** Dock panel + trigger button. Collapses automatically when nothing is pending. */
export function DockPanel({ store, onGo }: DockPanelProps) {
  const { rows, pulse } = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const [expanded, setExpanded] = useState(false)
  const [pulsing, setPulsing] = useState(false)
  useEffect(() => { if (rows.length === 0) setExpanded(false) }, [rows.length])
  // Arrival pulse: each new pending item bumps `pulse`; glow the FAB briefly.
  useEffect(() => {
    if (pulse === 0) return
    setPulsing(true)
    const timer = setTimeout(() => setPulsing(false), 900)
    return () => clearTimeout(timer)
  }, [pulse])
  if (rows.length === 0) return null
  const count = rows.length
  const fabStyle = pulsing
    ? { ...FAB_STYLE, transition: 'box-shadow 0.25s ease', boxShadow: '0 0 0 3px var(--dsw-alias-state-warn-primary), var(--dsw-shadow-lv2)' }
    : FAB_STYLE
  return jsxs(Fragment, {
    children: [
      jsx('button', {
        type: 'button',
        'aria-label': t('dock.title'),
        'aria-expanded': expanded,
        title: t('dock.title'),
        onClick: () => setExpanded(!expanded),
        style: fabStyle,
        children: [jsx('span', { children: '\u26A0\uFE0F' }), jsx('span', { children: count > 99 ? '99+' : String(count) })],
      }),
      expanded
        ? jsxs('div', {
            style: PANEL_STYLE,
            'aria-label': t('dock.title'),
            children: [
              jsxs('div', {
                style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', paddingBottom: '6px', borderBottom: '1px solid var(--dsw-alias-state-warn-secondary)' },
                children: [
                  jsx('span', { style: { fontWeight: 700, fontSize: '14px', lineHeight: '20px' }, children: t('dock.title') }),
                  jsx('span', { style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: '12px', lineHeight: '18px' }, children: t('dock.all', { count }) }),
                ],
              }),
              rows.map((item) => jsxs('div', {
                key: item.key,
                style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' },
                children: [
                  jsx('span', { style: { background: KIND_DOT[item.kind] ?? 'var(--dsw-alias-label-tertiary)', borderRadius: '50%', width: '8px', height: '8px', flexShrink: 0 } }),
                  jsx('div', { style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: item.title }),
                  jsx('span', { style: { color: KIND_TEXT[item.kind] ?? 'var(--dsw-alias-label-tertiary)', fontWeight: 600, flexShrink: 0 }, children: item.kindLabel }),
                  jsx('button', {
                    type: 'button',
                    onClick: () => onGo(item),
                    title: t('toast.go'),
                    style: { ...ACTION_BTN_STYLE, color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-interactive-bg-hover)', flexShrink: 0 },
                    children: t('toast.go'),
                  }),
                ],
              }, item.key)),
            ],
          })
        : null,
    ],
  })
}

// eslint-disable-next-line no-redeclare
// (Fragment comes from the `react` external — present in the shell's frozen table.)

/** Mount the Approval Hub into document.body; returns its unmounter. */
export function mountDock(store: DockStore, actions: { go(item: DockRow): void }): () => void {
  let rootEl = document.getElementById(DOCK_ROOT_ID)
  if (rootEl === null) {
    rootEl = document.createElement('div')
    rootEl.id = DOCK_ROOT_ID
    document.body.appendChild(rootEl)
  }
  const reactRoot = createRoot(rootEl)
  reactRoot.render(jsx(DockPanel, { store, onGo: actions.go }, void 0))
  return () => {
    reactRoot.unmount()
    const el = document.getElementById(DOCK_ROOT_ID)
    if (el !== null && el.childNodes.length === 0) el.remove()
  }
}

/** Live Approval Hub: mirror every pending (kind-filtered) row, newest first. */
export function startDock(dockStore: DockStore, sessions: SessionsLike, cfg: AlerterConfig): () => void {
  const project = () => {
    const snapshot = sessions.list.getSnapshot()
    const rows: DockRow[] = []
    for (const sid of snapshot.ids) {
      const row = snapshot.byId[sid]
      if (row === void 0) continue
      const kind = row.pendingInteraction
      if (kind === void 0 || !cfg.alertKinds.includes(kind)) continue
      rows.push({
        key: `${kind}:${sid}`,
        sessionId: sid,
        title: row.displayTitle ?? row.id,
        kind,
        kindLabel: kindLabel(kind),
        ts: typeof row.updatedAt === 'number' && Number.isFinite(row.updatedAt) ? row.updatedAt : 0,
      })
    }
    rows.sort((a, b) => b.ts - a.ts)
    dockStore.replace(rows)
  }
  const unsubscribe = sessions.list.subscribe(project)
  project()
  const unmount = mountDock(dockStore, {
    go: (item) => {
      try { sessions.open(item.sessionId) } catch (error) { console.warn('[notifications] open session', error) }
    },
  })
  return () => { unsubscribe(); unmount() }
}