/**
 * Toast card + stack UI (top-right portal). Theme tokens only — no color
 * literals (web-styling discipline).
 */
import { useSyncExternalStore } from 'react'
import type { ToastActions, ToastItem } from './types.ts'
import type { ToastStore } from './stores.ts'
import { t } from './locales.ts'

export const TOAST_ROOT_ID = 'dsh-web-notify-root'

/** Theme-aware inline styles (aliases mirror the family's module CSS values). */
export const CARD_STYLE: Record<string, string> = {
  boxSizing: 'border-box',
  pointerEvents: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  padding: '10px 12px',
  borderRadius: '12px',
  border: '1px solid var(--dsw-alias-state-warn-secondary)',
  background: 'var(--dsw-specific-input-major)',
  boxShadow: 'var(--dsw-shadow-lv2)',
  color: 'var(--dsw-alias-label-primary)',
  fontFamily: 'var(--ds-font-family)',
  fontSize: '13px',
  lineHeight: '18px',
}
export const DOT_STYLE: Record<string, string> = {
  background: 'var(--dsw-alias-state-warn-primary)',
  borderRadius: '50%',
  width: '8px',
  height: '8px',
  flexShrink: '0',
}
export const ACTION_BTN_STYLE: Record<string, string> = {
  cursor: 'pointer',
  border: 'none',
  borderRadius: '8px',
  padding: '4px 10px',
  fontFamily: 'inherit',
  fontSize: '12px',
  lineHeight: '18px',
}

export interface ToastCardProps {
  item: ToastItem
  onGo(item: ToastItem): void
  onDismiss(item: ToastItem): void
}

/**
 * Per-variant accent (border + dot + kind label). The lookup is the styling
 * extension point for "different situations, different CSS": add a variant
 * key here (or map a job status onto a variant upstream) and every card of
 * that variant re-styles — the event wiring stays untouched. Theme tokens
 * only, no color literals.
 */
export const VARIANT_ACCENT: Record<string, string> = {
  error: 'var(--dsw-alias-label-error)',
  warning: 'var(--dsw-alias-state-warn-primary)',
  done: 'var(--dsw-alias-state-warn-secondary)',
  info: 'var(--dsw-alias-state-warn-primary)',
}
const ACCENT = (item: ToastItem): string => VARIANT_ACCENT[item.variant ?? 'info'] ?? VARIANT_ACCENT.info

/** One toast card. */
export function ToastCard({ item, onGo, onDismiss }: ToastCardProps) {
  const accent = ACCENT(item)
  return (
    <div style={{ ...CARD_STYLE, borderColor: accent }} role="alert">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ ...DOT_STYLE, background: accent }} />
        <span style={{ color: accent, fontWeight: 600 }}>{item.kindLabel}</span>
      </div>
      <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
      {item.body !== void 0
        ? <div style={{ color: 'var(--dsw-alias-label-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.body}</div>
        : null}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '2px' }}>
        <button type="button" onClick={() => onDismiss(item)} title={t('toast.dismiss')} style={{ ...ACTION_BTN_STYLE, color: 'var(--dsw-alias-label-tertiary)', background: 'transparent' }}>{t('toast.dismiss')}</button>
        <button type="button" onClick={() => onGo(item)} title={t('toast.go')} style={{ ...ACTION_BTN_STYLE, color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-interactive-bg-hover)' }}>{t('toast.go')}</button>
      </div>
    </div>
  )
}

export interface ToastStackProps extends ToastActions {
  store: ToastStore
}

/** The portal stack: fixed top-right, above the shell UI. */
export function ToastStack({ store, onGo, onDismiss }: ToastStackProps) {
  const items = useSyncExternalStore(store.subscribe, store.getSnapshot)
  return (
    <div
      style={{
        position: 'fixed',
        top: '64px',
        right: '16px',
        zIndex: 2147483000,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: 'min(340px, calc(100vw - 32px))',
        pointerEvents: 'none',
      }}
      aria-live="polite"
    >
      {items.map((item) => <ToastCard key={item.key} item={item} onGo={onGo} onDismiss={onDismiss} />)}
    </div>
  )
}