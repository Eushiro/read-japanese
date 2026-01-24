import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import i18next from 'eslint-plugin-i18next'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'convex/_generated']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Import sorting - auto-fixable
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',

      // Stricter TypeScript
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      // No console.log (allow warn/error for legitimate logging)
      'no-console': ['error', { allow: ['warn', 'error'] }],

      // Prevent common mistakes
      'no-debugger': 'error',
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  // i18n linting - warn on hardcoded strings in JSX (excludes admin pages)
  {
    files: ['src/**/*.tsx'],
    ignores: ['src/**/admin/**', 'src/components/admin/**', 'src/pages/admin/**'],
    plugins: {
      i18next: i18next,
    },
    rules: {
      'i18next/no-literal-string': ['warn', {
        mode: 'jsx-text-only',
        words: {
          exclude: [
            // Single characters and symbols that don't need translation
            '/', '|', '-', '•', '→', '←', '×', '+', '&', '@', ':', ',', '.', '!', '?',
            // Technical values
            'N/A', 'px', 'em', 'rem', '%',
          ],
        },
      }],
    },
  },
  // Allow console.log in Convex backend files (server-side logging)
  {
    files: ['convex/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  // Allow console.log in scripts (CLI tools)
  {
    files: ['scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  // Disable react-refresh for non-component files (hooks, contexts, utilities)
  // Also allow exporting types/constants alongside components
  {
    files: [
      'src/hooks/**/*.ts',
      'src/contexts/**/*.tsx',
      'src/lib/**/*.ts',
      'src/components/ui/**/*.tsx',
      'src/components/library/**/*.tsx',
      'src/components/ThemeProvider.tsx',
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
