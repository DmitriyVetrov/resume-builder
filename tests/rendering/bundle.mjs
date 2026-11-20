// `conditions: []` with platform neutral takes the packages' browser builds, also when Node runs the bundle.
import { build } from 'esbuild';
import { resolve } from 'node:path';

const here = import.meta.dirname;
const result = await build({
  entryPoints: [resolve(here, 'entry.ts')],
  outfile: resolve(here, 'build/engine.mjs'),
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  mainFields: ['module', 'main'],
  conditions: ['browser', 'module', 'import', 'default'],
  target: 'es2022',
  minify: true,
  metafile: true,
  legalComments: 'none',
  nodePaths: [resolve(here, '../../frontend/node_modules')],
  define: { 'process.env.NODE_ENV': '"production"' },
});
console.log(`engine bundle: ${Object.values(result.metafile.outputs)[0].bytes} bytes`);
