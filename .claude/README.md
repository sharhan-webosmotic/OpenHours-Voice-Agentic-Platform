# Claude Code setup

What is here, and nothing else:

- `settings.json` : the permission allow and deny lists, and the two hooks below. Reviewed like code. Personal overrides go in `settings.local.json`, which is git-ignored.
- `hooks/guard.mjs` : blocks edits to real `.env` files, to `pnpm-lock.yaml` and to already-applied Prisma migrations.
- `hooks/format.mjs` : runs Prettier on files Claude edits.
- `skills/` : twelve project skills, named in the root `CLAUDE.md`. Each is one page of conventions for one kind of work in this repository.
- `rules/` : three always-on rules for how Claude writes and what it must ask before doing. Not product rules: those live in `CLAUDE.md`.

The authoritative rules for this codebase are the root `CLAUDE.md` and each app's own
`CLAUDE.md`. A skill is guidance for a kind of task; `CLAUDE.md` wins wherever they differ.

A generated framework of 823 files and 110 skills used to live here. It was removed in
`chore/strip-adf-framework`: most of it never ran, and the parts that loaded every session
(a 110-skill catalogue and the whole `rules/compliance/` folder, roughly 34,000 tokens)
crowded out the code being worked on. See that commit for the measurements.
