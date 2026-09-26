// Bundles the Electron main and preload scripts into single files.
//
// A bundle starts much faster than hundreds of separate node_modules files
// (especially on Windows, where every file opened is scanned), and it means
// only the native better-sqlite3 module has to ship in node_modules.
//
// Usage: node scripts/build-electron.mjs [--watch]
import { context, build } from 'esbuild';
import dotenv from 'dotenv';
import fs from 'fs';

const watch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: {
    // Loaded by the generated electron/main.js entry below
    'electron/app': 'electron/main.ts',
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

// package.json "main" points at this tiny entry. It turns on Node's on-disk
// compile cache before loading the large bundle, so later launches skip
// recompiling it. Written after the first build so dev's `wait-on` doesn't
// start Electron before app.js exists.
const writeEntry = () =>
  fs.writeFileSync(
    'dist-electron/electron/main.js',
    `'use strict';
require('node:module').enableCompileCache?.();
require('./app.js');
`
  );

// Only these keys are read by the packaged app. Anything else in .env
// (e.g. SENTRY_AUTH_TOKEN, used to upload source maps at build time) must
// not ship inside the installer, so the build writes a filtered copy that
// electron-builder packages as resources/.env.
const RUNTIME_ENV_KEYS = [
  'SENTRY_DSN',
  'SENTRY_ENVIRONMENT',
  'SYNC_TO_SUPABASE',
  'SUPABASE_URL',
  'SUPABASE_KEY',
];

const writeRuntimeEnv = () => {
  if (!fs.existsSync('.env')) return;
  const env = dotenv.parse(fs.readFileSync('.env'));
  const lines = RUNTIME_ENV_KEYS.filter((key) => key in env).map((key) =>
    env[key].includes("'") ? `${key}=${env[key]}` : `${key}='${env[key]}'`
  );
  fs.writeFileSync('dist-electron/.env', lines.join('\n') + '\n');
};

if (watch) {
  const ctx = await context(options);
  await ctx.rebuild();
  writeEntry();
  await ctx.watch();
} else {
  await build(options);
  writeEntry();
  writeRuntimeEnv();
}
