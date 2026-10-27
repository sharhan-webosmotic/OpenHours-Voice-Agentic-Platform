# ADF install notes (OpenHours)

ADF (App Development Framework) v4.32.0 was installed into `.claude/` on 2026-10-27 in
**merge mode**, not via its documented `git clone … .claude` + `setup.sh` flow.

This file records every deviation. Read it before running `git pull` in `.claude/`.

## Why merge mode

ADF's documented install makes `.claude/` its own git clone and adds `.claude/` to the
project `.gitignore`. For this repository that would have:

1. **Cut the deny list from 14 rules to 2.** ADF's `settings.template.json` denies only
   `Read(./.env)` and `Read(./.env.*)` — root level only, so `apps/api/.env` would become
   readable. Ours additionally denies `Read(./**/.env*)`, force-push, `git reset --hard`,
   `rm -rf`, `prisma migrate reset/deploy`, `prisma db push`, `psql` and `curl … | sh`.
2. **Removed `hooks/guard.mjs` and `hooks/format.mjs`.** `upgrade.sh` resets the `hooks`
   object in `settings.json` to the template on every pull. `guard.mjs` is what blocks
   writing real `.env` files, `pnpm-lock.yaml` and applied Prisma migrations.
3. **Un-tracked `.claude/` from this repo**, contradicting `SETUP.md` ("Commit it:
   `.claude/` … Review these files in the first PR like code").

This project stores patient health data. Those controls are the point, so they were kept.

## What was changed relative to a stock ADF install

| Deviation | Reason |
| --- | --- |
| `.claude/` is **part of this repository**, not a nested git clone | `SETUP.md` requires `.claude/` to be committed and reviewed. There is no `.claude/.git`, so `git pull` inside `.claude/` does not work — see "Upgrading" below. |
| ADF's `.gitignore` was **not** copied | It contains `.*` and `settings.json`, which would untrack our reviewed security config and every dotfile. Targeted runtime entries were added to the project `.gitignore` instead. |
| ADF's `CLAUDE.md` vendored as **`ADF-FRAMEWORK.md`** | It declares itself an active session directive and mandates "`/do` single interface — absolute". That contradicts the root `CLAUDE.md` (plan-then-approve, per-task skills, no-guessing rules). Kept verbatim for reference, under a name Claude Code does not auto-load. |
| `setup.sh` / `setup.ps1` were **not run** | Their side effects were declined: no `pip install markitdown[all]`, no `~/.adf/` registry or SQLite state DB, no mirroring into `~/.claude/skills` (which would affect every project on the machine), no `core.hooksPath` change, no pre-commit hook installed into this repo. |
| `settings.json` **not yet merged** | See below. The active file is still the project's original. |
| `AI_DOCS/` scaffolded by hand | Mirrors what `setup.sh` creates, minus the machine-level steps. |

## The 11 project skills are unaffected

ADF's 99 skills and this project's 11 have **zero name collisions**, so nothing was
overwritten. The project skills named in the root `CLAUDE.md` all still resolve:
`backend-api-standards`, `tenant-security-phi`, `database-prisma-postgres`,
`testing-quality-gates`, `frontend-react-standards`, `ui-design-system`,
`performance-optimisation`, `sarvam-voice-integration`, `android-kotlin-forwarding`,
`release-readiness`, `code-review-checklist`.

**On any conflict, the root `CLAUDE.md` and these 11 skills win over ADF guidance.**

## Pending: activating ADF's hooks and gates

ADF's governance hooks, telemetry and `plansDirectory` live in `settings.json`, which was
not modified. A merged file is staged at **`.claude/settings.json.adf-merged`**: ADF's
template plus the union of both permission lists (all 14 deny rules kept) with
`guard.mjs` and `format.mjs` placed first in `PreToolUse` / `PostToolUse`.

Review the diff, then apply:

```sh
cd .claude
diff <(python3 -m json.tool settings.json) <(python3 -m json.tool settings.json.adf-merged) | less
cp settings.json settings.json.pre-adf.bak
mv settings.json.adf-merged settings.json
```

Until then: **ADF's 99 skills and 51 agents work** (Claude Code discovers those from the
directory), but ADF's hook-enforced gates do not fire.

## Upgrading

`git pull` inside `.claude/` does **not** work here: this directory is tracked by the
project repository, not by ADF's. To take a new ADF release:

1. Clone it somewhere else: `git clone https://github.com/bhavesh-webosmotic/claude-skills /tmp/adf`
2. Copy framework directories over `.claude/`, leaving the project's files alone:
   `skills/ agents/ rules/ hooks/ docs/ skill-lab/ scripts/ templates/ cron/ state/ plugins/ workflows/ vendor/`
   plus `.adf-version settings.template.json setup.sh setup.ps1 upgrade.sh CLAUDE.template.md UPGRADING.md DEVELOPER.md README.md`
3. Do **not** copy ADF's `.gitignore` or `CLAUDE.md`.
4. Do **not** let `settings.json` be overwritten — re-merge it as above.
5. Keep `hooks/guard.mjs` and `hooks/format.mjs`.
6. Review the diff as code, per `SETUP.md`.

A short script for steps 1-5 is worth writing before the first upgrade.
