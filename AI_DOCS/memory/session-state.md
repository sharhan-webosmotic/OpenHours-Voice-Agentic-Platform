# Session state

<!-- Maintained by the ADF framework (.claude/). See .claude/skills/memory-protocol/SKILL.md. -->

## Current focus

Monorepo foundation is complete (pnpm + Turborepo, strict TypeScript, API health/readiness
skeleton, local Postgres 16 + SeaweedFS stack, CI). No product features yet.

## Next

Prompt 2 onward: Prisma schema and the tenant-scoped repository layer, then the OpenAPI
generation that replaces the `pnpm openapi` stub.

## Notes

This project's authoritative rules live in the root `CLAUDE.md` and the 11 project skills
in `.claude/skills/` (backend-api-standards, tenant-security-phi, and so on). ADF's own
operating rules are vendored at `.claude/ADF-FRAMEWORK.md` for reference and are NOT
loaded as a session directive. See `.claude/ADF-INSTALL-NOTES.md`.
