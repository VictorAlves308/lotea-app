import globals from 'globals';

import { base, prettierConfig } from '../../eslint.shared.mjs';

export default [
  // The bundled Vercel function (scripts/bundle-vercel.mjs's output) — generated,
  // not hand-written, and already gitignored alongside src/generated/.
  { ignores: ['api/**'] },
  ...base,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  prettierConfig,
];
