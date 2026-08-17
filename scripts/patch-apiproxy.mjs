/**
 * apiproxy allowlist patches for the `dsh-web-notify` plugin.
 *
 * 1. WEB_SETTINGS_NAMESPACES — expose the `notifications` settings
 *    namespace to the official settings seam (its own comment: "adding a
 *    section to that page is a decision made here … deferred work").
 * 2. API_REMOTE_FORWARDED_EVENTS (dsh-api-remotes) — forward the plugin's
 *    `notifications/evt` host event to every browser tab (its own comment:
 *    "forwarding one more event is an entry here and nothing else"), the lane
 *    the 429/model-error alerts and the host job-status ledger ride on.
 *
 * Idempotent and re-runnable: after a `dsh` upgrade that restores the pristine
 * bundles, run `node scripts/patch-apiproxy.mjs` again, then restart `dsh web`.
 * A backup of each pristine file is left as <file>.orig-dsh-web-notify.
 *
 * Paths are resolved from the current user's home (npm cache lives under
 * <home>/AppData/Local/npm-cache/_npx/<hash>), and the per-machine npx hash
 * directory is discovered by scanning — no hardcoded user names or hashes.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'

const homeCache = `${homedir().replaceAll('\\', '/')}/AppData/Local/npm-cache/_npx`
const npxHash = readdirSync(homeCache)
  .find((dir) => existsSync(`${homeCache}/${dir}/node_modules/@deepseek-ai/dsh-host-apiproxy`))
const NPM_BASE = npxHash
  ? `${homeCache}/${npxHash}/node_modules/@deepseek-ai`
  : `${homeCache}/__missing__/node_modules/@deepseek-ai`

const NAMESPACE_TARGETS = [
  // lib/index.js uses the double-quoted multi-line form
  [`${NPM_BASE}/dsh-host-apiproxy/lib/index.js`, '"notifications"'],
  // lib/types/api-proxy.js uses the single-quoted one-line form
  [`${NPM_BASE}/dsh-host-apiproxy/lib/types/api-proxy.js`, "'notifications'"],
]

/**
 * The pristine starting state of WEB_SETTINGS_NAMESPACES:
 *   last entry is `"web-search-deepseek"` (insert before `];`)
 * Multi-line (tab-indented) form lives in lib/index.js; one-line form lives in
 * lib/types/api-proxy.js. Each form has its own rewrite below.
 */
const NAMESPACE_REWRITERS = [
  // === lib/index.js form: \t"web-search-deepseek"\n]; -> append \t"notifications"
  (text) => text.replace(
    '\t"web-search-deepseek"\n];',
    '\t"web-search-deepseek",\n\t"notifications"\n];',
  ),
  // === lib/types/api-proxy.js form: 'web-search-deepseek',\n]; -> append 'notifications'
  (text) => text.replace(
    "'web-search-deepseek',\n];",
    "'web-search-deepseek', 'notifications',\n];",
  ),
]

const EVENTS_TARGET = [`${NPM_BASE}/dsh-api-remotes/lib/index.js`, 'notifications/evt']
/**
 * The pristine starting state of API_REMOTE_FORWARDED_EVENTS (this array has
 * always been tab-indented multi-line only):
 *   last entry is `\t"settings/document-updated"\n];`
 */
const EVENTS_REWRITERS = [
  (text) => text.replace(
    '\t"settings/document-updated"\n];',
    '\t"settings/document-updated",\n\t"notifications/evt"\n];',
  ),
]

function patchOne(target, rewriteAll) {
  const [path, marker] = Array.isArray(target) ? target : [target, undefined]
  if (!existsSync(path)) {
    console.log(`SKIP (missing) ${path}`)
    return
  }
  let text = readFileSync(path, 'utf8')
  if (marker && text.includes(marker)) {
    console.log(`OK (already patched) ${path}`)
    return
  }
  let out = text
  for (const rewrite of rewriteAll) {
    const next = rewrite(out)
    if (next !== out) { out = next; break }
  }
  if (out !== text) {
    const backup = path + '.orig-dsh-web-notify'
    if (!existsSync(backup)) writeFileSync(backup, text)
    writeFileSync(path, out)
    console.log(`PATCHED ${path}`)
  } else {
    console.log(`WARN (pattern not matched) ${path}`)
  }
}

for (const target of NAMESPACE_TARGETS) {
  patchOne(target, NAMESPACE_REWRITERS)
}
patchOne(EVENTS_TARGET, EVENTS_REWRITERS)
console.log('done')