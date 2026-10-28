# Deferred retro actions

Lower-priority items from retrospectives. Promoted into a milestone when relevant.

## From Foundation retro (2026-10-27)

- Add `pnpm format:check` to CI (`pnpm check` deliberately matches `CLAUDE.md`'s definition and omits it).
- Add migrations-on-empty-DB and the policy-coverage script to CI, per `.claude/skills/release-readiness`.
- Record estimate-vs-actual hours for a milestone, somewhere under `docs/`.

Dropped: the ADF upgrade script. The framework was removed in `chore/strip-adf-framework`,
so there is nothing left to upgrade.
