// Root fallback config. Each workspace (apps/*, packages/*) has its own
// eslint.config.mjs and its own "lint" script — this file only covers loose
// root-level files if ESLint is ever invoked directly from the repo root.
import { base, prettierConfig } from './eslint.shared.mjs';

export default [
  ...base,
  {
    ignores: ['apps/**', 'packages/**'],
  },
  prettierConfig,
];
