/**
 * Production build for dsh-notifications.
 *
 * Emits the same runtime artifacts the repo pipeline would:
 *  - lib/index.js   — host half, plain ESM (imports @deepseek-ai/dsh-settings,
 *                     schemastery — resolved at load time from the profile/core tree)
 *  - lib/client.js  — browser half, loader format:
 *                     window.__ModuleLoader__.load({ id, factory: (require) => {...} })
 *                     single-file CJS bundle with react / react-dom / @deepseek-ai/* as
 *                     require-externals (resolved from the web shell's frozen module table).
 *
 * The tsdown.config.ts / tsconfig.build.json in this package are ready for a
 * future tsc + tsdown swap; local build uses esbuild (already on this machine
 * via Vue's node_modules) so the package builds offline.
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const LOADER_ID = 'dsh-notifications';
const ROOT = fileURLToPath(new URL('..', import.meta.url));

const common = {
  absWorkingDir: ROOT,
  bundle: true,
  sourcemap: true,
  legalComments: 'inline',
  logLevel: 'info',
};

await build({
  ...common,
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  format: 'esm',
  target: 'es2022',
  external: ['@deepseek-ai/*', 'schemastery', 'zod'],
});

const banner = `window.__ModuleLoader__.load({\n\tid: ${JSON.stringify(LOADER_ID)},\n\tfactory: (require) => {\n\t\tvar module = { exports: {} };\n\t\tvar exports = module.exports;\n\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });\n`;
const footer = `\n\t\treturn module.exports;\n\t}\n});\n`;
await build({
  ...common,
  entryPoints: ['src/client/index.ts'],
  outfile: 'lib/client.js',
  format: 'cjs',
  target: 'es2020',
  jsx: 'automatic',
  banner: { js: banner },
  footer: { js: footer },
  external: ['react', 'react/*', 'react-dom', 'react-dom/*', '@deepseek-ai/*'],
});
console.log('lib/client.js built (loader-wrapped by banner/footer)');

console.log('build done');