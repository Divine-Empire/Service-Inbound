import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import react from 'eslint-plugin-react';

// `npm run lint`. Errors fail the build; the long-standing patterns below are
// warnings so they stay visible without blocking (same policy as Engineer-Dashboard).
export default [
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, __BUILD_ID__: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh, react },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Core no-undef / no-unused-vars cannot see JSX usage; these two close that gap
      // (an unimported <Icon /> otherwise only fails at runtime).
      'react/jsx-no-undef': 'error',
      'react/jsx-uses-vars': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // `_`-prefixed names are intentional.
      'no-unused-vars': ['warn', { varsIgnorePattern: '^_|^React$', argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  {
    files: ['vite.config.js', 'tailwind.config.js', 'postcss.config.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals.node },
    rules: { 'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] },
  },
];
