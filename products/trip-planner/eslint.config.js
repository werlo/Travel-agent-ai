import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

/**
 * Flat ESLint config for Compass.
 *
 * The `src/domain/**` block is load-bearing: it is what mechanically enforces the
 * purity rule in docs/02-architecture.md §2. Deleting it to make something compile
 * silently kills R13 (determinism). tests/eslint-domain-purity.test.ts runs ESLint
 * against this file and fails if the block stops catching impurity.
 */
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2022 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: '18.3' } },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,

      // §8 of the architecture: XSS posture. Not a convention — an error.
      'react/no-danger': 'error',

      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // Node-side tooling files.
  {
    files: ['*.config.ts', 'vitest.setup.ts', 'e2e/**/*.ts', 'tests/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },

  // ---------------------------------------------------------------------------
  // THE PURITY OVERRIDE (docs/02-architecture.md §2).
  // Nothing under src/domain/ may reach outside itself or touch the ambient world.
  // ---------------------------------------------------------------------------
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['**/ui/**', '**/app/**', '**/storage/**', '**/data/**', 'react*'],
        },
      ],
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'localStorage',
        'fetch',
        'Intl',
        'crypto',
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now' },
        { object: 'Math', property: 'random' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'domain/ is pure: pass dates in as ISO strings',
        },
      ],
    },
  },
)
