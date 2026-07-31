import expoConfig from 'eslint-config-expo/flat.js';

import { base, prettierConfig } from '../../eslint.shared.mjs';

export default [
  ...base,
  ...expoConfig,
  {
    // Metro/Tailwind's own tooling loads these as plain CommonJS — require() is correct here.
    files: ['metro.config.js', 'tailwind.config.js', 'babel.config.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // i18next's default export also carries a named `use` export by design —
    // this is the documented `i18n.use(...).init(...)` pattern, not a mistake.
    files: ['src/shared/i18n/**/*.ts'],
    rules: {
      'import/no-named-as-default-member': 'off',
    },
  },
  prettierConfig,
];
