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
      // Prisma's generated client: machine-written, regenerated on every schema change.
      '**/src/generated/**',
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
    rules: {
      // Express identifies an error handler by its arity, so the 4th parameter must be
      // declared even when unused. The leading-underscore convention marks it, matching
      // the `_req` / `_res` usage already throughout the codebase.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Config and script files are plain ESM, linted without type information.
    files: ['**/*.mjs', '**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    /**
     * Prisma may only be imported where tenancy is enforced: src/db (which builds the
     * scoped client) and repositories. Anywhere else, a direct import would bypass the
     * application isolation lock entirely (apps/api/CLAUDE.md).
     */
    files: ['apps/api/src/**/*.ts'],
    ignores: [
      'apps/api/src/db/**',
      'apps/api/src/**/repositories/**',
      'apps/api/src/**/*.repository.ts',
      'apps/api/src/generated/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@prisma/client',
              message:
                'Import Prisma only in src/db or a repository. Elsewhere, take the scoped client from the request context.',
            },
            {
              name: '@prisma/adapter-pg',
              message: 'Database connection setup belongs in src/db.',
            },
          ],
          patterns: [
            {
              group: ['**/generated/prisma/**'],
              message:
                'Import the generated Prisma client only in src/db or a repository. Elsewhere, take the scoped client from the request context.',
            },
          ],
        },
      ],
    },
  },
  {
    // Config files legitimately use default exports (tooling requires them).
    files: ['**/*.config.{ts,mjs}', 'commitlint.config.mjs', 'eslint.config.mjs'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  prettier,
);
