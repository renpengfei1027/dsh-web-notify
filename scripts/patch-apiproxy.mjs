/**
 * apiproxy allowlist patches for the `dsh-notifications` plugin.
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
 * A backup of each pristine file is left as <file>.orig-dsh-notifications.
 *
 * Also upgrades older `approval-alerter` allowlist entries to the current
 * `notifications` namespace (replace-in-place) — so a profile previously
 * patched with an earlier release keeps working after a code rename.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const NAMESPACE_TARGETS = [
  'C:/Users/<user>/AppData/Local/npm-cache/_npx/1e7f6d9597241db0/node_modules/@deepseek-ai/dsh-host-apiproxy/lib/index.js',
  'C:/Users/<user>/AppData/Local/npm-cache/_npx/1e7f6d9597241db0/node_modules/@deepseek-ai/dsh-host-apiproxy/lib/types/api-proxy.js',
]

/**
 * Two possible starting states for WEB_SETTINGS_NAMESPACES:
 *   A) pristine  -> last entry is `"web-search-deepseek"` (insert before `];`)
 *   B) previously patched with old `approval-alerter` release
 *             -> last entry is `"approval-alerter"` (replace in-place with
 *                `"notifications"`)
 * Multi-line (tab-indented) form lives in lib/index.js; one-line form lives in
 * lib/types/api-proxy.js. We try A then B, and whichever sticks wins.
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
  // === old-patch upgrade, multi-line: \t"approval-alerter"\n]; -> \t"notifications"\n];
  (text) => text.replace(
    '\t"approval-alerter"\n];',
    '\t"notifications"\n];',
  ),
  // === old-patch upgrade, one-line: 'approval-alerter',\n]; -> 'notifications',\n];
  (text) => text.replace(
    "'approval-alerter',\n];",
    "'notifications',\n];",
  ),
]

const EVENTS_TARGET = 'C:/Users/<user>/AppData/Local/npm-cache/_npx/1e7f6d9597241db0/node_modules/@deepseek-ai/dsh-api-remotes/lib/index.js'
/**
 * Same two starting states for API_REMOTE_FORWARDED_EVENTS (this array has
 * always been tab-indented multi-line only):
 *   A) pristine          -> last entry `\t"settings/document-updated"\n];`
 *   B) old approval-alerter -> last entry `\t"approval-alerter/evt"\n];`
 */
const EVENTS_REWRITERS = [
  (text) => text.replace(
    '\t"settings/document-updated"\n];',
    '\t"settings/document-updated",\n\t"notifications/evt"\n];',
  ),
  (text) => text.replace(
    '\t"approval-alerter/evt"\n];',
    '\t"notifications/evt"\n];',
  ),
]

function patchOne(path, marker, rewriteAll) {
  if (!existsSync(path)) {
    console.log(`SKIP (missing) ${path}`)
    return
  }
  let text = readFileSync(path, 'utf8')
  if (text.includes(marker)) {
    console.log(`OK (already patched) ${path}`)
    return
  }
  let out = text
  for (const rewrite of rewriteAll) {
    const next = rewrite(out)
    if (next !== out) { out = next; break }
  }
  if (out !== text) {
    const backup = path + '.orig-dsh-notifications'
    if (!existsSync(backup)) writeFileSync(backup, text)
    writeFileSync(path, out)
    console.log(`PATCHED ${path}`)
  } else {
    console.log(`WARN (pattern not matched) ${path}`)
  }
}

for (const path of NAMESPACE_TARGETS) {
  patchOne(path, '"notifications"', NAMESPACE_REWRITERS)
}
patchOne(EVENTS_TARGET, 'notifications/evt', EVENTS_REWRITERS)
console.log('done')
