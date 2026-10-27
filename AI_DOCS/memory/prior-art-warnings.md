# Prior-Art Warnings

Extracted from retrospectives. `/brainstorm` and `/milestone-planning` read this to avoid repeating
known pitfalls. One line each; detail lives in the source retro.

## From Foundation retro (2026-10-27)

- ⚠ Verify a security control by attempting what it forbids; a 200 from the configuring call proves nothing.
- ⚠ Handle error and close events on every long-lived resource handle at construction, or a database restart becomes an outage.
- ⚠ Registry presence is not installability: install the pinned toolchain before publishing a version table.
- ⚠ pnpm 12 enforces `minimumReleaseAge` (~24h) and moved settings to `pnpm-workspace.yaml`; `onlyBuiltDependencies` is now `allowBuilds`.
- ⚠ pnpm 12 needs corepack >= 0.36.0; the corepack bundled with Node 22 cannot load `bin/pnpm.mjs`.
- ⚠ `prisma@latest` is an 8.0 release candidate; pin 7.10.1 for both `prisma` and `@prisma/client`.
- ⚠ MinIO images are no longer freely distributable (Oct 2025); any "use MinIO locally" guidance is stale.
- ⚠ When a batch of checks fails uniformly, suspect the harness before the target.
- ⚠ Constrain a formatter's scope when introducing it, or it will rewrite protected files.
- ⚠ ADF's governance model and this project's `CLAUDE.md` plan-then-approve rule are not yet reconciled; `CLAUDE.md` wins.
