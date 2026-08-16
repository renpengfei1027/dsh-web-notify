/**
 * Release pipeline for dsh-notifications.
 *
 * Usage:  node scripts/release.mjs [--dry-run]
 *
 * --dry-run  — every step except the final `npm publish` (renders the exact
 *              command + verifies pack/install again). Default off: performs
 *              the actual publish when the machine is authenticated
 *              (`npm whoami`).
 *
 * Chain:
 *   1. build (esbuild, lib/index.js + lib/client.js)
 *   2. smoke (10 scenarios against the generated bundles)
 *   3. npm pack + isolated install + `import('dsh-notifications')` load check
 *   4. npm publish (skipped on --dry-run)
 *   5. npm view verify on the published version
 */
import { execFileSync } from 'node:child_process'
import { rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const dry = process.argv.includes('--dry-run')

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], ...opts }).toString()

const step = (i, name) => console.log(`\n-- [${i}] ${name} --`)

step(1, 'build')
run(process.execPath, ['scripts/build.mjs'])
run(process.execPath, ['--check', 'lib/index.js'])
run(process.execPath, ['--check', 'lib/client.js'])
console.log('lib built + syntax OK')

step(2, 'smoke (generated bundles)')
const smokeOut = run(process.execPath, ['scripts/smoke.mjs'])
console.log(smokeOut.split('\n').filter((l) => /ALL SCENARIOS|FAIL/.test(l)).join('\n') || smokeOut)

step(3, 'pack + isolated install + host-half load')
const tarball = run(NPM, ['pack', '--silent']).split('\n').filter(Boolean).pop().trim()
const sandbox = mkdtempSync(join(tmpdir(), 'dsh-notifications-release-'))
try {
  run(NPM, ['init', '-y'], { cwd: sandbox })
  run(NPM, ['install', join(ROOT, tarball)], { cwd: sandbox })
  const loaded = run(process.execPath, ['--input-type=module', '-e', "const m = await import('dsh-notifications'); process.stdout.write(Object.keys(m).join(','))"], { cwd: sandbox })
  if (!/apply/.test(loaded)) throw new Error('host half did not expose apply()')
  console.log('installed + loaded OK:', loaded.trim().slice(0, 80), '…')
} finally {
  rmSync(sandbox, { recursive: true, force: true })
  rmSync(join(ROOT, tarball), { force: true })
}

if (dry) {
  console.log('\n[DRY-RUN] publish command that would run:\n  npm publish')
  console.log('[DRY-RUN] every pre-publish gate passed')
  process.exit(0)
}

step(4, 'whoami gate')
let who = ''
try {
  who = run(NPM, ['whoami']).trim()
  console.log('publishing as:', who)
} catch {
  console.error('not logged in — run `npm login` first, or re-run with --dry-run')
  process.exit(1)
}

step(5, 'npm publish')
console.log(run(NPM, ['publish']).split('\n').filter(Boolean).slice(-2).join('\n'))

step(6, 'verify on registry')
const v = run(NPM, ['view', 'dsh-notifications', 'version']).trim()
console.log('registry now shows:', v)
console.log('\nRELEASE COMPLETE ✓ published as', who)