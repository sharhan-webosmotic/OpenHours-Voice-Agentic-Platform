# Decision log

> Append-only record of choices made during the build. New entries at top. Used to recover context across sessions and to defend choices later.

## YYYY-MM-DD — <short title>
- **Question:** <what was being decided>
- **Options considered:** <A, B, C>
- **Decision:** <chosen option>
- **Why:** <one or two sentences>
- **Decided by:** <user | llm | both>
- **Affected:** <files/skills/components touched>

---

## Examples (delete before use)

## 2026-04-27 — Pick Tailwind over CSS-in-JS
- **Question:** Styling approach for UI tasks.
- **Options considered:** Tailwind + tokens.ts, styled-components, vanilla-extract.
- **Decision:** Tailwind with `tailwind.config.ts` as the token source of truth.
- **Why:** User preferred utility-class velocity; design tokens are easy to grep-enforce.
- **Decided by:** user
- **Affected:** stack.md, src/design/tokens.ts, all future UI tasks.

## 2026-04-27 — Pin Postgres 16 + Prisma 5
- **Question:** DB + ORM combo.
- **Options considered:** Postgres+Prisma, Postgres+Drizzle, Mongo+Mongoose.
- **Decision:** Postgres 16 + Prisma 5.
- **Why:** Strong types end-to-end with Next.js, mature migration story, no auto-id gotchas.
- **Decided by:** llm
- **Affected:** stack.md, database-schema.md, prisma/.
