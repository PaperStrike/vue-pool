import eslint from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import tseslint from 'typescript-eslint'

/**
 * Unnecessarily explicit type annotation until the upstream issue is resolved.
 * @see https://github.com/typescript-eslint/typescript-eslint/issues/10893
 * @type {import('typescript-eslint').ConfigArray}
 */
const configs = tseslint.config(
  eslint.configs.recommended,
  stylistic.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // Disable rules that are only meaningful when TypeScript becomes smart enough
  {
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  // @playwright/test likes empty object patterns. (It ASTs the test fns internally.)
  {
    files: ['test/**/*.ts'],
    rules: {
      'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }],
    },
  },
)

export default configs
