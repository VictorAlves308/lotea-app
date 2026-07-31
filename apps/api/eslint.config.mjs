import globals from 'globals';

import { base, prettierConfig } from '../../eslint.shared.mjs';

export default [
  ...base,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  prettierConfig,
];
