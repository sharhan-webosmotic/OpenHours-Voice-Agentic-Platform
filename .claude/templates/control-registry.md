# Control Registry

> Scaffolded to `AI_DOCS/quality/control-registry.md`. One row per ENFORCING control in this
> project: anything whose job is to block, gate, lock, or refuse. Reconciled by
> `hooks/drift-detector.sh` Phase I on every 24h scan.
>
> **Why this file exists.** A control can be logically correct and still never run. The failure is
> invisible precisely because a control is silent when it passes, so "enforcing" and "absent" look
> identical from the outside. Recorded instances of the shape: a lock hook whose arming marker was
> never stamped, a merge gate keyed on a command substring that never matched, a settings entry
> still pointing at a superseded implementation while its replacement had zero references, and a
> test suite migrating one database while querying another. Each was patched at the logic level and
> the shape recurred anyway, because none of the patches proved the control FIRES.
>
> **What "proven" means here.** Not that the control's unit test passes. That the control was driven
> from OUTSIDE, through its real trigger, with a known-bad input, and observed to BLOCK it. Both
> directions or it does not count: a control proven only to allow good input cannot be distinguished
> from one that is not installed. Record the date of that observation, and re-prove after any change
> to the control.

## Registry

| Control | Trigger | Wiring file | Control file | Last proven |
|---|---|---|---|---|
| <name> | <the event or command that fires it> | <the SOURCE file that installs it, see below> | <the file that implements it> | <YYYY-MM-DD, or `never`> |
| flow-gate | PreToolUse Edit, Write, or MultiEdit on app code while any DOING task carries an unapproved `flow:` tag | .claude/settings.json (from .claude/settings.template.json) | .claude/hooks/enforce-flow-gate.sh | 2026-10-05 (hooks/tests/enforce-flow-gate.test.sh, both directions) |
| mavs-gate | PreToolUse Bash on a git merge into an integration branch, parsing every mavs report | .claude/settings.json (from .claude/settings.template.json) | .claude/hooks/mavs-gate.sh | 2026-10-05 (hooks/tests/mavs-gate-advisory.test.sh and hooks/tests/bash-gates.test.sh, both directions: FAIL and STALE block, ADVISORY never does) |

**How Phase I reads this table.** It reads only the rows under the `## Registry` heading, so keep
that heading. The wiring and control cells are paths relative to the project root, which is why a
framework file starts with `.claude/`. A trailing note in parentheses is ignored. A registry seeded
from an earlier copy of this template carries `hooks/...` and `settings.json` without the prefix,
and Phase I still resolves those under `.claude/`.

**The wiring column names the SOURCE, never a generated copy.** If the file that actually installs
the control is gitignored, has a tracked `*.template.*` sibling, or is written by any sync,
migration, or scaffold script, then it is GENERATED and the authoritative wiring is its source.
Recording the generated copy here hides a whole failure mode: a control can be fixed, verified in
both directions, committed, and then silently un-installed by the next sync, because only the
generated copy was ever edited. That has happened, four days after the fix, to a lock hook that had
been verified in three directions. Re-check proof dates after any upgrade or sync, not only after a
code change.

## What Phase I checks

| Check | What it catches |
|---|---|
| The wiring file exists and mentions the control file | A control whose wiring was replaced while the registry, and everyone reading it, still believed the old one was live. |
| The proof date is not older than the control file's last change | A control changed after it was last proven. The proof describes code that no longer exists. |
| The proof date is not `never` | A control nobody has ever watched refuse anything. |

The last change is the control file's last commit date when git tracks it and the working copy has
no uncommitted edit, and its mtime otherwise. Git does not preserve mtimes, so on a fresh clone
every file's mtime is newer than any proof date. The comparison is by day: a control changed and
proven on the same day counts as proven.

Phase I is advisory. A stale proof is a prompt to re-prove, never a reason to stop work.

## Rows to seed

Every project starts with the controls its own stack installs. Typical sources:

- PreToolUse and Stop hooks wired in `settings.json`.
- Merge, ship, and cost gates.
- Permission guards and field-level access checks.
- Test-suite wiring that must target a specific database or environment.
- CI steps that are expected to fail a build.

A control that exists in the repo but not in this table is the exact gap this file closes, so seed
generously and mark the unproven ones `never` rather than leaving them out.
