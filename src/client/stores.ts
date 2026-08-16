/**
 * Two tiny uSES-friendly external stores: the toast stack (one-shot events)
 * and the Approval Hub dock (live rows + arrival pulse).
 */
import type { DockRow, ToastItem } from './types.ts'

export interface ToastStore {
  subscribe(fn: () => void): () => void
  getSnapshot(): readonly ToastItem[]
  push(item: ToastItem): void
  remove(key: string): void
  clearSession(sessionId: string | undefined): void
}

/** Tiny external store the toast portal React tree subscribes to (uSES). */
export function createToastStore(): ToastStore {
  let items: ToastItem[] = []
  const listeners = new Set<() => void>()
  const emit = () => { for (const fn of [...listeners]) try { fn() } catch {} }
  return {
    subscribe(fn) {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
    getSnapshot() { return items },
    push(item) {
      items = [...items, item]
      emit()
    },
    remove(key) {
      if (!items.some((item) => item.key === key)) return
      items = items.filter((item) => item.key !== key)
      emit()
    },
    clearSession(sessionId: string | undefined) {
      const next = items.filter((item) => item.sessionId !== sessionId)
      if (next.length === items.length) return
      items = next
      emit()
    },
  }
}

export interface DockStoreState {
  rows: DockRow[]
  pulse: number
}

export interface DockStore {
  subscribe(fn: () => void): () => void
  getSnapshot(): DockStoreState
  replace(rows: DockRow[]): void
  pulse(): void
}

/** Live rows + arrival pulse for the persistent Approval Hub. */
export function createDockStore(): DockStore {
  let state: DockStoreState = { rows: [], pulse: 0 }
  const listeners = new Set<() => void>()
  const emit = () => { for (const fn of [...listeners]) try { fn() } catch {} }
  return {
    subscribe(fn) {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
    getSnapshot() { return state },
    replace(rows) {
      state = { rows, pulse: state.pulse }
      emit()
    },
    pulse() {
      state = { ...state, pulse: state.pulse + 1 }
      emit()
    },
  }
}