// Bundles the Electron main and preload scripts into single files.
//
// A bundle starts much faster than hundreds of separate node_modules files
// (especially on Windows, where every file opened is scanned), and it means
// only the native better-sqlite3 module has to ship in node_modules.
//
// Usage: node scripts/build-electron.mjs [--watch]
import { context, build } from 'esbuild';
import fs from 'fs';

const watch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: {
    'electron/main': 'electron/main.ts',
    'electron/preload': 'electron/preload.ts',
  },
  outdir: 'dist-electron',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  // better-sqlite3 is a native module and must stay in node_modules
  external: ['electron', 'better-sqlite3'],
  sourcemap: watch ? 'linked' : false,
  minify: !watch,
  keepNames: true,
  logLevel: 'info',
};

// Start clean so stale per-file output from older builds isn't packaged.
fs.rmSync('dist-electron', { recursive: true, force: true });

// dist-electron needs its own package.json so Node treats the output as CJS
// (the root package.json is "type": "module").
fs.mkdirSync('dist-electron', { recursive: true });
fs.copyFileSync('electron/package.json', 'dist-electron/package.json');

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
