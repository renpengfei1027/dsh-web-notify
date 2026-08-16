/**
 * Release pipeline for dsh-web-notify.
 *
 * Usage:  node scripts/release.mjs [--dry-run]
 *
 * --dry-run  every step except the final `npm publish` (renders the exact
 *              command + verifies pack/install again). Default off: performs
 *              the actual publish when the machine is authenticated
 *              (`npm whoami`).
 *
 * Chain:
 *   1. build (esbuild, lib/index.js + lib/client.js)
 *   2. smoke (9 scenarios against the generated bundles)
 *   3. npm pack + isolated install + `import('dsh-web-notify')` load check
 *   4. npm publish (skipped on --dry-run)
 *   5. npm view verify on the published version
 */
import { execFileSync } from 'node:child_process'
import { rmSync, mkdtempSync, copyFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
// On Windows hermes/fnm, npm ships as a .cmd shim that execFileSync cannot
// spawn directly without shell=true (EINVAL). Shell is enabled only for npm
// invocations; node scripts stay on shell-less spawns.
const NPM_CMD = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const dry = process.argv.includes('--dry-run')

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], ...opts }).toString()

const runNpm = (args, opts = {}) =>
  execFileSync(NPM_CMD, args, {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    ...opts,
  }).toString()

const step = (i, name) => console.log(`\n-- [${i}] ${name} --`)
const NL = '\n'

step(1, 'build')
run(process.execPath, ['scripts/build.mjs'])
run(process.execPath, ['--check', 'lib/index.js'])
run(process.execPath, ['--check', 'lib/client.js'])
console.log('lib built + syntax OK')

step(2, 'smoke (generated bundles)')
const smokeOut = run(process.execPath, ['scripts/smoke.mjs'])
console.log(smokeOut.split(NL).filter((l) => /ALL SCENARIOS|FAIL/.test(l)).join(NL) || smokeOut)

// Swap in the concise npm README for the tarball.
// Backup goes to a temp path (not README*) so npm never packs it.
const README_PATH = join(ROOT, 'README.md')
const README_BAK = join(tmpdir(), 'dsh-web-notify-readme-bak.md')
const README_NPM = join(ROOT, '.npm-readme.md')
const swapped = existsSync(README_NPM)
if (swapped) {
  copyFileSync(README_PATH, README_BAK)
  copyFileSync(README_NPM, README_PATH)
  console.log('swapped in npm README')
}

try {

step(3, 'pack + isolated install + host-half load')
const tarball = runNpm(['pack', '--silent']).split(NL).filter(Boolean).pop().trim()
const sandbox = mkdtempSync(join(tmpdir(), 'dsh-web-notify-release-'))
try {
  runNpm(['init', '-y'], { cwd: sandbox })
  runNpm(['install', join(ROOT, tarball)], { cwd: sandbox })
  const loaded = run(process.execPath, ['--input-type=module', '-e', "const m = await import('dsh-web-notify'); process.stdout.write(Object.keys(m).join(','))"], { cwd: sandbox })
  if (!/apply/.test(loaded)) throw new Error('host half did not expose apply()')
  console.log('installed + loaded OK:', loaded.trim().slice(0, 80), '…')
} finally {
  rmSync(sandbox, { recursive: true, force: true })
  rmSync(join(ROOT, tarball), { force: true })
}

if (dry) {
  console.log('\n[DRY-RUN] publish command that would run:\n  npm publish')
  console.log('[DRY-RUN] every pre-publish gate passed')
} else {

step(4, 'whoami gate')
let who = ''
try {
  who = runNpm(['whoami']).trim()
  console.log('publishing as:', who)
} catch {
  console.error('not logged in run `npm login` first, or re-run with --dry-run')
  process.exit(1)
}

step(5, 'npm publish')
console.log(runNpm(['publish']).split(NL).filter(Boolean).slice(-2).join(NL))

step(6, 'verify on registry')
const v = runNpm(['view', 'dsh-web-notify', 'version']).trim()
console.log('registry now shows:', v)
console.log('\nRELEASE COMPLETE published as', who)

}

} finally {
  if (swapped) {
    copyFileSync(README_BAK, README_PATH)
    rmSync(README_BAK, { force: true })
    console.log('restored full README')
  }
}
