/**
 * Settings card with the family card chrome (collapsible header, description,
 * "unsaved" pill) — same slots, same read as the Shell/Agent loop/Web search
 * cards. Booleans are rendered as switches, numbers as inputs; staged edits
 * commit through the settings scope with cached uSES snapshots as before.
 */
import { useState } from 'react'
import { DEFAULTS, type ScopeLike, type ScopeSnapshotLike } from './types.ts'
import type { LocaleKey, TplVars } from './locales.ts'

type FieldType = 'boolean' | 'number' | 'string'

const CARD_FIELDS: Record<string, FieldType> = {
  sound: 'boolean',
  volume: 'number',
  badge: 'boolean',
  toast: 'boolean',
  notify: 'boolean',
  dock: 'boolean',
  completion: 'boolean',
  completionSound: 'boolean',
  completionNotify: 'boolean',
  connection: 'boolean',
  connectionAlertAfterMs: 'number',
  jobFailure: 'boolean',
  failureNotify: 'boolean',
  agentError: 'boolean',
  cooldownMs: 'number',
  diagnostics: 'boolean',
  glow: 'boolean',
}

interface StagedEdit { text: string; clear: boolean }

export interface CardFieldState {
  field: string
  text: string
  overridden: boolean
  invalid: boolean
}

export interface CardState {
  available: boolean
  exposed: boolean
  writable: boolean
  dirty: boolean
  invalid: boolean
  saving: boolean
  failed: boolean
  fields: CardFieldState[]
}

export interface CardActions {
  edit(field: string, text: string): void
  resetField(field: string): void
  save(): void
  discard(): void
}

export interface SettingsCardController {
  inject(): {
    hooks: { approvalAlerterSettingsCard: { subscribe(fn: () => void): () => void; getSnapshot(): CardState } }
    edit(field: string, text: string): void
    resetField(field: string): void
    save(): void
    discard(): void
  }
}

interface PlannedWrite {
  field: string
  run: (() => Promise<unknown> | unknown) | undefined
}

export function createSettingsCardController(scope: ScopeLike): SettingsCardController {
  const staged = new Map<string, StagedEdit>()
  const listeners = new Set<() => void>()
  let saving = false
  let failed = false

  const snap = (): ScopeSnapshotLike => scope.getSnapshot() ?? {}

  const valueOf = (field: string, layer: 'value' | 'base' | 'user'): unknown => {
    const record = snap()[layer]
    return record !== null && typeof record === 'object' && Object.hasOwn(record, field) ? (record as Record<string, unknown>)[field] : void 0
  }
  const format = (field: string): string => {
    const v = valueOf(field, 'value')
    if (v !== void 0) return String(v)
    const d = (DEFAULTS as Record<string, unknown>)[field]
    return d !== void 0 ? String(d) : ''
  }
  const baseOf = (field: string): string => {
    const v = valueOf(field, 'base')
    if (v !== void 0) return String(v)
    const d = (DEFAULTS as Record<string, unknown>)[field]
    return d !== void 0 ? String(d) : ''
  }
  const stored = (field: string): boolean => {
    const u = snap().user
    return u !== null && typeof u === 'object' && Object.hasOwn(u, field)
  }

  /** Parse a draft into a write; undefined blocks the save (mirrors the host schema). */
  const parse = (field: string, text: string): { kind: 'set'; value: unknown } | { kind: 'clear' } | undefined => {
    const trimmed = text.trim()
    if (trimmed === '') return { kind: 'clear' }
    if (CARD_FIELDS[field] === 'boolean') {
      if (trimmed === 'true') return { kind: 'set', value: true }
      if (trimmed === 'false') return { kind: 'set', value: false }
      return void 0
    }
    if (CARD_FIELDS[field] === 'string') return { kind: 'set', value: trimmed }
    const n = Number(trimmed)
    if (!Number.isFinite(n)) return void 0
    if (field === 'volume' && (n < 0 || n > 1)) return void 0
    if ((field === 'cooldownMs' || field === 'connectionAlertAfterMs') && n < 0) return void 0
    return { kind: 'set', value: n }
  }

  const plan = (): PlannedWrite[] => {
    const out: PlannedWrite[] = []
    for (const [field, edit] of staged) {
      if (edit.clear) {
        if (stored(field)) out.push({ field, run: () => scope.unset(field) })
        continue
      }
      if (edit.text === format(field)) continue
      const write = parse(field, edit.text)
      if (write === void 0) out.push({ field, run: void 0 })
      else if (write.kind === 'clear') out.push({ field, run: () => scope.unset(field) })
      else out.push({ field, run: () => scope.set(field, write.value) })
    }
    return out
  }

  scope.subscribe(() => publish())

  const actions: CardActions = {
    edit: (field, text) => { staged.set(field, { text, clear: false }); failed = false; publish() },
    resetField: (field) => { staged.set(field, { text: baseOf(field), clear: true }); failed = false; publish() },
    discard: () => { if (staged.size === 0 && !failed) return; staged.clear(); failed = false; publish() },
    save: () => {
      void (async () => {
        const p = plan()
        if (p.length === 0 || saving || p.some((item) => item.run === void 0)) return
        saving = true
        failed = false
        publish()
        let landed = true
        for (const item of p) {
          try { await item.run() } catch { landed = false }
        }
        if (landed) for (const item of p) staged.delete(item.field)
        saving = false
        failed = !landed
        publish()
      })()
    },
  }

  const computeState = (): CardState => {
    const snapshot = snap()
    const p = plan()
    return {
      available: snapshot.status !== 'loading',
      exposed: snapshot.status === 'ready',
      writable: snapshot.writable === true,
      dirty: p.length > 0,
      invalid: p.some((item) => item.run === void 0),
      saving,
      failed,
      fields: Object.keys(CARD_FIELDS).map((field) => {
        const edit = staged.get(field)
        const text = edit === void 0 ? format(field) : edit.text
        const write = edit === void 0 ? void 0 : edit.clear ? { kind: 'clear' as const } : parse(field, edit.text)
        return { field, text, overridden: write?.kind === 'set', invalid: edit !== void 0 && write === void 0 }
      }),
    }
  }

  // Cached snapshot: rebuilt ONLY when something changes (publish), so
  // getSnapshot hands back a stable reference between updates. Computing it
  // per-read would give useSyncExternalStore a fresh object on every render
  // and loop forever (React error #185, "Maximum update depth exceeded").
  let current: CardState = computeState()
  const publish = () => {
    current = computeState()
    for (const fn of [...listeners]) try { fn() } catch {}
  }

  return {
    inject() {
      return {
        hooks: {
          approvalAlerterSettingsCard: {
            subscribe: (fn) => { listeners.add(fn); return () => { listeners.delete(fn) } },
            getSnapshot: () => current,
          },
        },
        ...actions,
      }
    },
  }
}

const SETTINGS_CARD_STYLE: Record<string, string> = {
  boxSizing: 'border-box',
  border: '1px solid var(--dsw-alias-border-l2)',
  background: 'var(--dsw-alias-bg-layer-3)',
  borderRadius: '12px',
  listStyle: 'none',
}
const SETTINGS_CARD_OPEN_STYLE: Record<string, string> = {
  background: 'var(--dsw-alias-bg-layer-2)',
  borderColor: 'var(--dsw-alias-label-dimmed)',
}
const SETTINGS_HEADER_STYLE: Record<string, string> = {
  appearance: 'none',
  width: '100%',
  font: 'inherit',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  background: 'transparent',
  border: '0',
  borderRadius: '12px',
  alignItems: 'center',
  gap: '12px',
  padding: '14px 16px',
  display: 'flex',
  boxSizing: 'border-box',
}
const SETTINGS_HEAD_TEXT_STYLE: Record<string, string> = {
  flexDirection: 'column',
  flex: '1',
  gap: '4px',
  minWidth: '0',
  display: 'flex',
}
const SETTINGS_NAME_STYLE: Record<string, string> = {
  color: 'var(--dsw-alias-label-primary)',
  fontSize: '15px',
  fontWeight: '600',
  lineHeight: '1.4',
}
const SETTINGS_DESC_STYLE: Record<string, string> = {
  color: 'var(--dsw-alias-label-tertiary)',
  fontSize: '13px',
  lineHeight: '1.5',
}
const SETTINGS_PENDING_STYLE: Record<string, string> = {
  whiteSpace: 'nowrap',
  background: 'var(--dsw-alias-bg-module-platform)',
  color: 'var(--dsw-alias-label-secondary)',
  borderRadius: '999px',
  flex: 'none',
  padding: '1px 8px',
  fontSize: '11px',
  fontWeight: '500',
  lineHeight: '17px',
}
const SETTINGS_CHEVRON_STYLE: Record<string, string> = {
  color: 'var(--dsw-alias-label-tertiary)',
  flex: 'none',
  transition: 'transform 0.16s',
}
const SETTINGS_BODY_STYLE: Record<string, string> = {
  borderTop: '1px solid var(--dsw-alias-border-l2)',
  margin: '0 16px',
  paddingBottom: '8px',
}
const SETTINGS_NOTE_STYLE: Record<string, string> = {
  color: 'var(--dsw-alias-label-tertiary)',
  margin: '12px 0 0',
  fontSize: '12px',
  lineHeight: '1.5',
}
const SETTINGS_NOT_EXPOSED_STYLE: Record<string, string> = {
  color: 'var(--dsw-alias-state-warn-primary)',
  margin: '12px 0 0',
  fontSize: '12px',
  lineHeight: '1.5',
}
const SETTINGS_FOOTER_STYLE: Record<string, string> = {
  borderTop: '1px solid var(--dsw-alias-border-l2)',
  justifyContent: 'flex-end',
  alignItems: 'center',
  gap: '8px',
  padding: '12px 0 4px',
  display: 'flex',
}
const SETTINGS_FAILED_STYLE: Record<string, string> = {
  minWidth: '0',
  color: 'var(--dsw-alias-label-error)',
  flex: '1',
  margin: '0',
  fontSize: '12px',
  lineHeight: '1.5',
}
const SETTINGS_BUTTON_BASE: Record<string, string> = {
  appearance: 'none',
  font: 'inherit',
  cursor: 'pointer',
  border: '1px solid transparent',
  borderRadius: '8px',
  padding: '5px 14px',
  fontSize: '13px',
  lineHeight: '1.5',
}
const SETTINGS_DISCARD_STYLE: Record<string, string> = {
  ...SETTINGS_BUTTON_BASE,
  borderColor: 'var(--dsw-alias-border-l2)',
  color: 'var(--dsw-alias-label-secondary)',
  background: 'transparent',
}
const SETTINGS_SAVE_STYLE: Record<string, string> = {
  ...SETTINGS_BUTTON_BASE,
  background: 'var(--dsw-alias-label-primary)',
  color: 'var(--dsw-alias-bg-layer-3)',
}
const SETTINGS_DISABLED_STYLE: Record<string, string> = { opacity: '0.4', cursor: 'default' }
const SETTINGS_FIELD_STYLE: Record<string, string> = {
  flexDirection: 'column',
  gap: '6px',
  padding: '12px 0',
  display: 'flex',
}
const SETTINGS_FIELD_TOP_STYLE: Record<string, string> = {
  borderTop: '1px solid var(--dsw-alias-border-l2)',
}
const SETTINGS_HEAD_STYLE: Record<string, string> = { alignItems: 'center', gap: '8px', display: 'flex' }
const SETTINGS_LABEL_STYLE: Record<string, string> = {
  minWidth: '0',
  color: 'var(--dsw-alias-label-primary)',
  flex: '1',
  fontSize: '13px',
  fontWeight: '500',
  lineHeight: '1.5',
}
const SETTINGS_BADGES_STYLE: Record<string, string> = { alignItems: 'center', gap: '8px', display: 'inline-flex' }
const SETTINGS_BADGE_STYLE: Record<string, string> = {
  whiteSpace: 'nowrap',
  background: 'var(--dsw-alias-bg-module-platform)',
  color: 'var(--dsw-alias-label-secondary)',
  borderRadius: '999px',
  padding: '1px 8px',
  fontSize: '11px',
  fontWeight: '500',
  lineHeight: '17px',
}
const SETTINGS_RESET_STYLE: Record<string, string> = {
  font: 'inherit',
  color: 'var(--dsw-alias-label-secondary)',
  cursor: 'pointer',
  background: 'transparent',
  border: 'none',
  padding: '0',
  fontSize: '12px',
  lineHeight: '1.5',
}
const SETTINGS_CONTROL_STYLE: Record<string, string> = {
  border: '1px solid var(--dsw-alias-border-l2)',
  background: 'var(--dsw-alias-bg-layer-3)',
  height: '34px',
  font: 'inherit',
  color: 'var(--dsw-alias-label-primary)',
  borderRadius: '8px',
  padding: '0 12px',
  fontSize: '13px',
  lineHeight: '1.5',
  boxSizing: 'border-box',
}
const SETTINGS_CONTROL_INVALID_STYLE: Record<string, string> = {
  ...SETTINGS_CONTROL_STYLE,
  border: '1px solid var(--dsw-alias-label-error)',
}
/** Boolean switch: 40×22 pill with a sliding knob. */
const SETTINGS_SWITCH_STYLE: Record<string, string> = {
  position: 'relative',
  boxSizing: 'border-box',
  width: '40px',
  height: '22px',
  borderRadius: '999px',
  border: '1px solid var(--dsw-alias-border-l2)',
  background: 'var(--dsw-alias-bg-layer-3)',
  cursor: 'pointer',
  padding: '0',
  flexShrink: '0',
  transition: 'background 0.15s ease, border-color 0.15s ease',
}
const SETTINGS_SWITCH_ON_STYLE: Record<string, string> = {
  ...SETTINGS_SWITCH_STYLE,
  background: 'var(--dsw-alias-brand-primary)',
  borderColor: 'var(--dsw-alias-brand-primary)',
}
const SETTINGS_SWITCH_KNOB_STYLE: Record<string, string> = {
  position: 'absolute',
  top: '2px',
  left: '2px',
  width: '16px',
  height: '16px',
  borderRadius: '999px',
  background: 'var(--dsw-alias-bg-module-platform)',
  transition: 'transform 0.15s ease',
}
const SETTINGS_SWITCH_KNOB_ON_STYLE: Record<string, string> = {
  ...SETTINGS_SWITCH_KNOB_STYLE,
  transform: 'translateX(18px)',
}
/** Volume slider row: native range + readout. */
const SETTINGS_RANGE_ROW_STYLE: Record<string, string> = { alignItems: 'center', gap: '10px', display: 'flex' }
const SETTINGS_RANGE_STYLE: Record<string, string> = {
  flex: '1',
  minWidth: '0',
  margin: '0',
  accentColor: 'var(--dsw-alias-brand-primary)',
}
const SETTINGS_RANGE_VALUE_STYLE: Record<string, string> = {
  minWidth: '34px',
  textAlign: 'right',
  color: 'var(--dsw-alias-label-secondary)',
  fontSize: '12px',
  lineHeight: '1.5',
  fontVariantNumeric: 'tabular-nums',
}
const SETTINGS_HINT_STYLE: Record<string, string> = {
  color: 'var(--dsw-alias-label-tertiary)',
  margin: '0',
  fontSize: '12px',
  lineHeight: '1.5',
}
const SETTINGS_INVALID_STYLE: Record<string, string> = {
  ...SETTINGS_HINT_STYLE,
  color: 'var(--dsw-alias-label-error)',
}

/** Safe 0–1 slider value out of the staged text ('' inherits the default). */
function volumeText(text: string): string {
  const v = parseFloat(text === '' ? '0.15' : text)
  return Number.isFinite(v) ? String(Math.max(0, Math.min(1, v))) : '0.15'
}

/** The settings card registered into the official `settings.plugin.item` slot. */
export function AlerterSettingsCard(props: AlerterSettingsCardFace) {
  const { t: T } = props
  const state = props.useApprovalAlerterSettingsCard((s) => s)
  const [open, setOpen] = useState(false)
  if (!state.available) return null
  const title = T('settings.title')
  const description = T('settings.description')
  const cardStyle = open ? { ...SETTINGS_CARD_STYLE, ...SETTINGS_CARD_OPEN_STYLE } : SETTINGS_CARD_STYLE
  const header = (
    <button
      type="button"
      aria-expanded={open}
      aria-label={`${T(open ? 'settings.collapse' : 'settings.expand')}: ${title}`}
      onClick={() => { setOpen(!open) }}
      style={SETTINGS_HEADER_STYLE}
    >
      <span style={SETTINGS_HEAD_TEXT_STYLE}>
        <span style={SETTINGS_NAME_STYLE} title={title}>{title}</span>
        <span style={SETTINGS_DESC_STYLE} title={description}>{description}</span>
      </span>
      {state.dirty ? <span style={SETTINGS_PENDING_STYLE} title={T('settings.unsaved')}>{T('settings.unsaved')}</span> : null}
      <svg
        width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"
        style={open ? { ...SETTINGS_CHEVRON_STYLE, transform: 'rotate(180deg)' } : SETTINGS_CHEVRON_STYLE}
      >
        <path
          d="M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z"
          fill="currentColor"
        />
      </svg>
    </button>
  )
  if (!state.exposed) {
    return (
      <div style={cardStyle}>
        {header}
        <div style={SETTINGS_BODY_STYLE}>
          <p style={SETTINGS_NOT_EXPOSED_STYLE} role="status">{T('settings.notExposed')}</p>
        </div>
      </div>
    )
  }
  const disabled = !state.writable
  const blocked = !state.dirty || state.invalid || state.saving
  return (
    <div style={cardStyle}>
      {header}
      {open
        ? (
          <div style={SETTINGS_BODY_STYLE}>
            {!state.writable ? <p style={SETTINGS_NOTE_STYLE} role="status">{T('settings.readOnly')}</p> : null}
            {state.fields.map((field, index) => {
          const boolean = CARD_FIELDS[field.field] === 'boolean'
          const label = T(`settings.field.${field.field}` as LocaleKey)
          const hint = T(`settings.field.${field.field}Hint` as LocaleKey)
          const id = `notifications-${field.field}`
          return (
            <div key={field.field} style={index === 0 ? SETTINGS_FIELD_STYLE : { ...SETTINGS_FIELD_STYLE, ...SETTINGS_FIELD_TOP_STYLE }}>
              <div style={SETTINGS_HEAD_STYLE}>
                <label style={SETTINGS_LABEL_STYLE} htmlFor={id}>{label}</label>
                {field.overridden
                  ? (
                    <span style={SETTINGS_BADGES_STYLE}>
                      <span style={SETTINGS_BADGE_STYLE}>{T('settings.overridden')}</span>
                      <button type="button" style={SETTINGS_RESET_STYLE} disabled={disabled} onClick={() => { props.resetField(field.field) }}>{T('settings.reset')}</button>
                    </span>
                  )
                  : null}
              </div>
              {boolean
                ? (
                  <button
                    id={id}
                    type="button"
                    role="switch"
                    aria-checked={field.text === 'true'}
                    aria-label={label}
                    disabled={disabled}
                    title={field.text === 'true' ? T('settings.on') : T('settings.off')}
                    onClick={() => { props.edit(field.field, field.text === 'true' ? 'false' : 'true') }}
                    style={field.text === 'true' ? SETTINGS_SWITCH_ON_STYLE : SETTINGS_SWITCH_STYLE}
                  >
                    <span style={field.text === 'true' ? SETTINGS_SWITCH_KNOB_ON_STYLE : SETTINGS_SWITCH_KNOB_STYLE} />
                  </button>
                )
                : field.field === 'volume'
                  ? (
                    <div style={SETTINGS_RANGE_ROW_STYLE}>
                      <input
                        id={id}
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        aria-invalid={field.invalid || undefined}
                        value={volumeText(field.text)}
                        disabled={disabled}
                        onChange={(event) => { props.edit(field.field, event.target.value) }}
                        style={SETTINGS_RANGE_STYLE}
                      />
                      <span style={SETTINGS_RANGE_VALUE_STYLE}>{volumeText(field.text)}</span>
                    </div>
                  )
                  : (
                    <input
                      id={id}
                      style={field.invalid ? SETTINGS_CONTROL_INVALID_STYLE : SETTINGS_CONTROL_STYLE}
                      type="text"
                      inputMode={CARD_FIELDS[field.field] === 'string' ? 'text' : 'numeric'}
                      aria-invalid={field.invalid || undefined}
                      value={field.text}
                      disabled={disabled}
                      onChange={(event) => { props.edit(field.field, event.target.value) }}
                    />
                  )}
              <p style={field.invalid ? SETTINGS_INVALID_STYLE : SETTINGS_HINT_STYLE}>
                {field.invalid ? T('settings.invalidNumber') : hint}
              </p>
            </div>
          )
        })}
        <div style={SETTINGS_FOOTER_STYLE}>
          {state.failed ? <p style={SETTINGS_FAILED_STYLE} role="status">{T('settings.saveFailed')}</p> : null}
          <button
            type="button"
            style={!state.dirty || state.saving ? { ...SETTINGS_DISCARD_STYLE, ...SETTINGS_DISABLED_STYLE } : SETTINGS_DISCARD_STYLE}
            disabled={!state.dirty || state.saving}
            onClick={() => { props.discard() }}
          >
            {T('settings.discard')}
          </button>
          <button
            type="button"
            style={blocked ? { ...SETTINGS_SAVE_STYLE, ...SETTINGS_DISABLED_STYLE } : SETTINGS_SAVE_STYLE}
            disabled={blocked}
            onClick={() => { props.save() }}
          >
            {T(state.saving ? 'settings.saving' : 'settings.save')}
          </button>
        </div>
        </div>
      )
      : null}
    </div>
  )
}