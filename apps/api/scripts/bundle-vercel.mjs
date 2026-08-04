import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const apiDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// The generated Prisma client (src/generated/prisma) is real TypeScript —
// import/export syntax, type-only exports — meant for a TS-aware runtime
// (tsx, used by both local dev and the Render deployment). Vercel's own
// Node.js function builder transpiles normal source it traces, but doesn't
// reliably do the same for this generator's output (explicit .ts extensions
// on its *internal* file-to-file imports, which we can't safely hand-edit —
// they're regenerated on every `prisma generate`). Bundling everything
// ourselves with esbuild sidesteps that entirely: it strips all TypeScript
// and resolves every relative import — extension or not — into one plain
// CommonJS file. Real npm packages stay external (`packages: 'external'`),
// resolved normally from node_modules at runtime, same as any Node function.
await build({
  entryPoints: [path.join(apiDir, 'src', 'vercel-handler.ts')],
  outfile: path.join(apiDir, 'api', 'index.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  packages: 'external',
  logLevel: 'info',
});
