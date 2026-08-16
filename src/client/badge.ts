/**
 * Tab-title badge (kept sticky against the shell's DocumentTitle writes) and
 * the installed-PWA taskbar/app-icon badge via the Badging API.
 */
import { t } from './locales.ts'

/** The plugin-owned title prefix, anchored at the front of the title. */
export const BADGE_RE = /^⚠\s*\d+\s*(?:待审批|approval pending)\s*—\s*/i

export interface TitleBadge {
  setCount(count: number): void
  dispose(): void
}

/**
 * One-shot badge owner + observer installed with the sentinel: the shell may
 * rewrite the tab title; the observer re-applies the badge prefix while
 * approvals pend.
 */
export function installTitleBadge(): TitleBadge {
  let pendingCount = 0
  let selfWriteAt = 0
  let observer: MutationObserver | null = null
  let titleEl: HTMLTitleElement | undefined

  const ensureTitle = (): HTMLTitleElement => {
    if (titleEl === void 0 || !document.contains(titleEl)) {
      titleEl = document.querySelector('title') ?? (() => {
        const el = document.createElement('title')
        document.head.appendChild(el)
        return el
      })()
    }
    return titleEl
  }

  const apply = () => {
    const node = ensureTitle()
    const raw = node.textContent ?? ''
    if (pendingCount > 0) {
      const badge = t('title.badge', { count: pendingCount })
      if (!raw.startsWith(badge)) {
        selfWriteAt = Date.now()
        node.textContent = badge + raw.replace(BADGE_RE, '')
      }
    } else if (BADGE_RE.test(raw)) {
      selfWriteAt = Date.now()
      node.textContent = raw.replace(BADGE_RE, '')
    }
  }

  observer = new MutationObserver(() => {
    if (Date.now() - selfWriteAt < 50) return
    if (pendingCount > 0) apply()
    else if (BADGE_RE.test(document.title)) apply()
  })
  observer.observe(document.head, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-t'] })

  return {
    setCount(count: number) {
      pendingCount = count
      apply()
    },
    dispose() {
      observer?.disconnect()
      if (BADGE_RE.test(document.title)) {
        selfWriteAt = Date.now()
        document.title = document.title.replace(BADGE_RE, '')
      }
    },
  }
}

/**
 * Installed-PWA taskbar/app-icon badge via the Badging API
 * (`navigator.setAppBadge`, Chrome/Edge on Windows & ChromeOS for installed
 * apps). No-op where unsupported; count 0 clears the badge.
 */
export function updateAppBadge(count: number): void {
  const nav = typeof navigator === 'undefined' ? void 0 : (navigator as unknown as Record<string, unknown>)
  if (nav === void 0 || typeof nav['setAppBadge'] !== 'function') return
  try {
    if (count > 0) {
      void (nav['setAppBadge'] as (c?: number) => Promise<void>)(count)
    } else if (typeof nav['clearAppBadge'] === 'function') {
      void (nav['clearAppBadge'] as () => Promise<void>)()
    } else {
      void (nav['setAppBadge'] as (c?: number) => Promise<void>)(0)
    }
  } catch {}
}

export interface FaviconBadge {
  setCount(count: number): void
  dispose(): void
}

/**
 * Whether the stub/dom environment provides the surface favicon-badge needs.
 * Smoke/node intentionally stubs only a subset of the DOM; missing APIs here
 * are not fatal — the favicon surface simply no-ops (tab-title + dock + PWA
 * badge still cover the user). Canvas + querySelectorAll are the non-obvious
 * ones that fail under node dom-stubs.
 */
function faviconDomAvailable(): boolean {
  if (typeof document === 'undefined') return false
  if (typeof document.querySelectorAll !== 'function') return false
  if (typeof document.createElement !== 'function') return false
  try {
    const c = document.createElement('canvas')
    if (typeof c.getContext !== 'function' || c.getContext('2d') === null) return false
  } catch { return false }
  return typeof document.head !== 'undefined' && document.head !== null
}

/**
 * Locate or create an icon <link> we own. The browser uses the first <link>
 * rel=icon without a `sizes` attribute as the default tab favicon; if all
 * candidates carry `sizes`, prefer the one mentioning 16 or 32 (actual tab
 * sizes) over 192/512 (manifest splash icons). Only when none match do we
 * create a new link element.
 *
 * Precondition: faviconDomAvailable() === true (caller guards).
 */
function ensureIconLink(): HTMLLinkElement {
  const existing = document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')
  let noSizes: HTMLLinkElement | undefined
  let tabSize: HTMLLinkElement | undefined
  let any: HTMLLinkElement | undefined
  for (let i = 0; i < existing.length; i++) {
    const el = existing.item(i)
    if (el === null) continue
    any = any ?? el
    const sizes = el.getAttribute('sizes') ?? ''
    if (sizes === '') { noSizes = noSizes ?? el; continue }
    if (sizes.includes('16') || sizes.includes('32')) { tabSize = tabSize ?? el; continue }
  }
  const best = noSizes ?? tabSize ?? any
  if (best !== void 0) return best
  const el = document.createElement('link')
  el.rel = 'icon'
  el.type = 'image/png'
  document.head.appendChild(el)
  return el
}

/**
 * Draw a 32x32 favicon badge onto a canvas and return the data URL.
 * Badge layout: a red circle sits in the bottom-right ~60% of the canvas.
 * If count ≤ MAX_DIGIT_COUNT, the number is drawn inside the circle; any
 * larger count renders as a solid dot (text would overflow at this size).
 *
 * Canvas cannot consume `--dsw-*` CSS tokens, so color values are hardcoded
 * literals here (the single exception to the plugin's no-hardcoded-color
 * rule, scoped to this rasterisation surface only).
 *
 * Precondition: faviconDomAvailable() === true (caller guards).
 */
/** Canvas edge length in pixels (favicon standard size). */
const FAVICON_SIZE = 32
/** Max count rendered as a digit; above this a solid dot is drawn instead. */
const FAVICON_MAX_DIGIT = 9
/** Badge circle inset from the bottom-right corner, in pixels. */
const FAVICON_BADGE_INSET = 10
/** Radius of the badge circle when showing a number, in pixels. */
const FAVICON_BADGE_R_NUM = 9
/** Radius of the badge circle when showing a solid dot, in pixels. */
const FAVICON_BADGE_R_DOT = 7
/** Badge outline width, in pixels. */
const FAVICON_BADGE_STROKE = 1
/** Font for the in-circle digit. */
const FAVICON_BADGE_FONT = 'bold 12px system-ui, -apple-system, Segoe UI, sans-serif'
/** Sub-pixel nudge for vertical text centering on canvas. */
const FAVICON_TEXT_NUDGE = 0.5
/** Badge fill color (Material red 600). */
const FAVICON_BADGE_FILL = '#e53935'
/** Badge outline color (translucent white). */
const FAVICON_BADGE_STROKE_COLOR = 'rgba(255,255,255,0.85)'
/** In-circle digit color. */
const FAVICON_BADGE_TEXT_COLOR = '#ffffff'

function drawFavicon(count: number): string {
  const SIZE = FAVICON_SIZE
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, SIZE, SIZE)
  // Badge circle: bottom-right anchor, ~60% coverage
  const cx = SIZE - FAVICON_BADGE_INSET
  const cy = SIZE - FAVICON_BADGE_INSET
  const r = count > FAVICON_MAX_DIGIT ? FAVICON_BADGE_R_DOT : FAVICON_BADGE_R_NUM
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = FAVICON_BADGE_FILL
  ctx.fill()
  ctx.lineWidth = FAVICON_BADGE_STROKE
  ctx.strokeStyle = FAVICON_BADGE_STROKE_COLOR
  ctx.stroke()
  if (count <= FAVICON_MAX_DIGIT) {
    ctx.fillStyle = FAVICON_BADGE_TEXT_COLOR
    ctx.font = FAVICON_BADGE_FONT
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(count), cx, cy + FAVICON_TEXT_NUDGE)
  }
  return canvas.toDataURL('image/png')
}

/**
 * Dynamic favicon badge for plain browser tabs (works everywhere the
 * Badging API does NOT — i.e. the vast majority of non-PWA windows).
 * Replaces the page's <link rel=icon> with a canvas-drawn PNG carrying a
 * red badge. dispose() restores the original href.
 *
 * Gracefully no-ops on node/stub DOMs (missing querySelectorAll or canvas
 * getContext) so the rest of the plugin keeps booting.
 */
export function installFaviconBadge(): FaviconBadge {
  if (!faviconDomAvailable()) {
    return { setCount: () => {}, dispose: () => {} }
  }
  let ownCount = 0
  const link = ensureIconLink()
  const originalHref = link.getAttribute('href') ?? null
  const dataUrlCache = new Map<number, string>()
  const apply = () => {
    try {
      if (ownCount <= 0) {
        if (originalHref !== null) link.setAttribute('href', originalHref)
        else link.removeAttribute('href')
        return
      }
      let url = dataUrlCache.get(ownCount)
      if (url === void 0) {
        url = drawFavicon(ownCount)
        dataUrlCache.set(ownCount, url)
      }
      link.setAttribute('href', url)
    } catch {}
  }
  return {
    setCount(count: number) {
      const c = Math.max(0, Math.floor(count))
      if (c === ownCount) return
      ownCount = c
      apply()
    },
    dispose() {
      try {
        if (originalHref !== null) link.setAttribute('href', originalHref)
        else link.removeAttribute('href')
      } catch {}
      dataUrlCache.clear()
    },
  }
}