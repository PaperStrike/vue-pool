import path from 'node:path'
import { includeIgnoreFile } from '@eslint/compat'
import eslint from '@eslint/js'
import markdown from '@eslint/markdown'
import stylistic from '@stylistic/eslint-plugin'
import tseslint from 'typescript-eslint'

/**
 * Unnecessarily explicit type annotation until the upstream issue is resolved.
 * @see https://github.com/typescript-eslint/typescript-eslint/issues/10893
 * @type {import('typescript-eslint').ConfigArray}
 */
const configs = tseslint.config(
  includeIgnoreFile(path.resolve(import.meta.dirname, '.gitignore')),
  {
    files: ['**/*.?(m|c){js,ts}'],
    extends: [
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
      // Disable rules that are only useful when TypeScript becomes smart enough.
      {
        rules: {
          '@typescript-eslint/no-non-null-assertion': 'off',
        },
      },
    ],
  },
  // @playwright/test likes empty object patterns. (It ASTs the test fns internally.)
  {
    files: ['test/**/*.ts'],
    rules: {
      'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }],
    },
  },
  // Markdown code blocks
  markdown.configs.processor,
  {
    files: ['*.md/**/*.{js,ts}'],
    extends: [
      // Disable type checks until eslint and typescript can interop better.
      // https://github.com/eslint/markdown/tree/main/examples/typescript
      tseslint.configs.disableTypeChecked,
    ],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
)

export default configs
