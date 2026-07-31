// Shared ESLint building blocks, imported by every workspace's own eslint.config.mjs.
// Each package composes these with its own runtime-specific pieces (Node globals for
// apps/api, eslint-config-expo for apps/mobile) — see ARCHITECTURE.md §2.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export const ignores = {
  ignores: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.expo/**',
    '**/coverage/**',
    '**/android/**',
    '**/ios/**',
    '**/generated/**',
  ],
};

export const base = tseslint.config(
  ignores,
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'warn',
    },
  },
);

// Must be spread last in every consumer's config — it only disables stylistic
// rules that would otherwise conflict with Prettier.
export const prettierConfig = prettier;
