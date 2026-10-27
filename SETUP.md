# Installing the Claude Code setup

1. Copy everything in this folder into the repository root (keep the folder structure). Commit it: `CLAUDE.md`, `apps/*/CLAUDE.md`, `.claude/`, `docs/STACK.md`.
2. Each developer runs Claude Code from the repo root (not from inside an app) so the root rules load. Rules in an app's `CLAUDE.md` load when Claude works in that folder.
3. Skills live in `.claude/skills/<name>/SKILL.md` and are loaded when a task matches their description. Name them in your prompt to force them, for example: "Use the tenant-security-phi and backend-api-standards skills".
4. Hooks need Node 22+. `guard.mjs` blocks edits to real `.env` files, `pnpm-lock.yaml` and already-applied Prisma migrations. `format.mjs` runs Prettier on files Claude edits (needs Prettier installed by Prompt 1).
5. `.claude/settings.json` allows `pnpm`, safe git commands and `docker compose`, and denies force-push, hard reset, `rm -rf`, `prisma migrate reset/deploy/db push`, direct `psql`, and reading `.env` files. Add personal overrides in `.claude/settings.local.json` (git-ignored).
6. Add `.claude/settings.local.json` and `.env*` (except `.env.example`) to `.gitignore`.
7. Prompt 1 from the plan must create `pnpm check` exactly as defined in the root `CLAUDE.md`.
8. Review these files in the first PR like code. Change a rule here, not in a chat message, so all three developers get it.
