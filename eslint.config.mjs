import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.turbo/**',
      // Claude Code harness scripts, owned by the .claude/ setup and not product code.
      '.claude/**',
      // Built last, and not a TypeScript project.
      'apps/android/**',
    ],
  },
  js.configs.recommended,
  {
    // Project rules from the root CLAUDE.md that have no off-the-shelf rule.
    rules: {
      'no-console': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportDefaultDeclaration',
          message: 'Named exports only, no default exports (root CLAUDE.md).',
        },
      ],
    },
  },
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
  },
  {
    // Config and script files are plain ESM, linted without type information.
    files: ['**/*.mjs', '**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Config files legitimately use default exports (tooling requires them).
    files: ['**/*.config.{ts,mjs}', 'commitlint.config.mjs', 'eslint.config.mjs'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  prettier,
);
