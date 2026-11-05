import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';

export default defineConfig(
  globalIgnores([
    'node_modules/**',
    '.svelte-kit/**',
    'build/**',
    'data/**',
    'test-results/**',
    'playwright-report/**',
  ]),
  js.configs.recommended,
  ts.configs.recommended,
  svelte.configs.recommended,
  {
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: { globals: globals.browser, parserOptions: { parser: ts.parser } },
    rules: {
      // Index-based static option/help rows intentionally keep their mounted controls.
      'svelte/require-each-key': 'off',
      // The app's origin-bound API and page routes are deliberately served at /.
      'svelte/no-navigation-without-resolve': 'off',
    },
  },
  {
    files: ['src/lib/components/ItemEditor.svelte'],
    rules: { 'svelte/prefer-writable-derived': 'off' },
  },
  { files: ['scripts/optimize-art.mjs'], languageOptions: { globals: globals.browser } },
  { files: ['tests/**/*.ts'], languageOptions: { globals: globals.browser } },
);
