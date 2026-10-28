# Stack (fixed for Phase 1)

Versions checked against the npm registry on 2026-10-27. Pin exact versions in `package.json` and commit the lockfile. Anything marked VERIFY must be confirmed in the first session that uses it, and the result written here.

| Layer                | Choice                                                                        | Version                                                  | Notes                                                                                                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime              | Node.js LTS                                                                   | 24 LTS (22.12+ also works)                               | All chosen packages support Node >= 22.12. Set in `.nvmrc` and `engines`.                                                                                                                          |
| Package manager      | pnpm + Turborepo                                                              | pnpm 12.x, turbo 2.11                                    | Use `packageManager` field with corepack.                                                                                                                                                          |
| Language             | TypeScript strict                                                             | **6.0.3**                                                | Do NOT use 7.x yet: typescript-eslint 8.72 supports `>=4.8.4 <6.1.0`. Revisit when it supports 7.                                                                                                  |
| API framework        | Express                                                                       | 5.3                                                      | Async errors propagate natively in v5.                                                                                                                                                             |
| Validation           | zod                                                                           | 4.6                                                      | Shared in `packages/shared`.                                                                                                                                                                       |
| OpenAPI              | @asteasolutions/zod-to-openapi, openapi-typescript, openapi-fetch             | 9.1 / 7.13 / 0.17                                        | VERIFY zod 4 compatibility on Day 1.                                                                                                                                                               |
| ORM / DB             | Prisma + PostgreSQL 16                                                        | **prisma, @prisma/client and @prisma/adapter-pg 7.10.1** | `latest` is an 8.0 release candidate; pin stable 7.10.1. VERIFIED 2026-10-27: driver adapter plus `set_config` inside interactive transactions works, see "Prisma 7 and row-level security" below. |
| Jobs                 | pg-boss                                                                       | 12.38                                                    | Runs on the same PostgreSQL; no Redis.                                                                                                                                                             |
| Auth                 | Self-managed: jose, argon2                                                    | 6.2 / 0.45                                               | argon2id; 15-min JWT; rotating refresh tokens; device tokens for Android.                                                                                                                          |
| Logging / errors     | pino, @sentry/node                                                            | 10.4 / 11.9                                              | Redaction list is mandatory.                                                                                                                                                                       |
| HTTP hardening       | helmet + express-rate-limit + cors                                            | **8.3.0 / 8.7.1 / 2.8.6**                                | VERIFIED 2026-10-27 against Express 5.3.0, see "HTTP hardening verified" below. `cors` added in M1-02.                                                                                             |
| Phones               | libphonenumber-js                                                             | 1.13                                                     | E.164 everywhere.                                                                                                                                                                                  |
| Storage              | AWS S3 (ap-south-1), @aws-sdk/client-s3                                       | 3.x                                                      | Private, SSE, signed URLs. Local dev uses SeaweedFS, not MinIO - see "Local object storage" below.                                                                                                 |
| Web apps             | React, Vite, Tailwind CSS                                                     | 19.3 / 8.3 / 4.3                                         | Tailwind via `@tailwindcss/vite`.                                                                                                                                                                  |
| Web libs             | React Router 8, TanStack Query 5, TanStack Table, React Hook Form 7, date-fns | 8.5 / 5.105 / latest / 7.91 / latest                     | Radix primitives with shadcn/ui pattern.                                                                                                                                                           |
| Web tests            | Vitest 5, Testing Library, MSW 3, Playwright                                  | 5.0 / latest / 3.0 / 1.64                                |                                                                                                                                                                                                    |
| API tests            | Vitest, Supertest, Testcontainers (PostgreSQL)                                | 5.0 / 7.3 / 12.2                                         | Connect as restricted `app_user` role.                                                                                                                                                             |
| Android (last phase) | Provisional: Kotlin, Jetpack Compose, Hilt, Room, WorkManager, FCM            | decided when Android starts                              | Built after API, admin-web and clinic-web. The scope document says React Native; confirm then.                                                                                                     |
| Voice                | Sarvam Voice Agents                                                           | per `docs/voice/sarvam-contract.md`                      | Thin `VoiceProvider` interface, one implementation.                                                                                                                                                |
| Cloud                | AWS ap-south-1 (Mumbai)                                                       |                                                          | RDS PostgreSQL, ECS Fargate, S3, Secrets Manager, CloudWatch, CloudFront. Terraform.                                                                                                               |
| CI/CD                | GitHub Actions                                                                |                                                          | See `release-readiness` skill.                                                                                                                                                                     |
| Quality              | ESLint 10 + typescript-eslint, Prettier, husky + lint-staged, commitlint      | 10.13 / 8.72                                             | `pnpm check` is the gate.                                                                                                                                                                          |

## Open items

- Android stack (React Native per scope document vs Kotlin) is decided when the Android phase starts.
- Telephony/number provider not yet named.
- Email provider for invites and resets (SES or Resend) or temporary-password flow.
- Recording retention default to be confirmed with legal.

## Local object storage (decided 2026-10-27)

**Decision: SeaweedFS (`chrislusf/seaweedfs:3.97`) is the S3-compatible service in `docker-compose.yml`.** Production is unchanged: real AWS S3 in ap-south-1.

Why not MinIO, which earlier drafts assumed: MinIO stopped free Docker image distribution in Oct 2025. `minio/minio:latest`, `quay.io/minio/minio:latest` and dated `RELEASE.*` tags all fail to resolve, and any tag that could still be pulled would be unpatched. It is not a safe dependency for a new project.

Why not LocalStack, which was the first replacement tried: LocalStack community serves S3 to **unsigned anonymous requests**. It accepts `put-public-access-block` and reports the bucket as private, but an anonymous `GET` of an object still returned `HTTP 200` with the object body, even with `S3_SKIP_SIGNATURE_VALIDATION=0` and `ENFORCE_IAM=1`. A private-bucket guarantee that cannot be tested is worse than no guarantee, so it was rejected.

Why SeaweedFS: its S3 gateway enforces credentials. The bucket is private by construction - the generated identity file defines exactly one credentialed identity and no anonymous identity. Verified in this session: authenticated `PUT`/`GET` succeed, while anonymous object `GET`, bucket listing and service-level bucket listing all return `403 AccessDenied`.

Trade-off accepted: SeaweedFS does not implement the S3 _management_ APIs (`put-public-access-block`, `put-bucket-versioning`, `put-bucket-encryption`). Those are production bucket settings configured in Terraform, and they are not what local development exercises. Real credential enforcement was judged more valuable locally than accepting management calls that have no effect.

## Verification log

### 2026-10-27, foundation setup session

Confirmed against the npm registry and by installing:

- **TypeScript 6.0.3** - installed and in use. The warning above is correct: registry `latest` is **7.0.2**, and typescript-eslint 8.72.x still declares `typescript: >=4.8.4 <6.1.0`. Do not move to 7.x yet.
- **Prisma: `latest` really is a prerelease** - `prisma@latest` resolves to **8.0.0-rc.27**, while `@prisma/client@latest` is 7.10.1. `prisma@7.10.1` exists and is the version to pin. NOT INSTALLED in this session (no Prisma yet), so the driver-adapter and `set_config` RLS items remain **UNVERIFIED**.
- **pnpm 12.15.0** - works, but requires **corepack >= 0.36.0**. The Node 22.21.1 bundled corepack (0.34.0) fails with `Cannot find module .../bin/pnpm.cjs`, because pnpm 12 ships `bin/pnpm.mjs`. `npm i -g corepack@latest` fixes it. Recorded in README prerequisites.
- **typescript-eslint pinned to 8.72.0, not 8.72.1.** pnpm 12 enforces a `minimumReleaseAge` supply-chain policy; 8.72.1 was published 2026-10-26 and is inside the 24h window. 8.72.0 (2026-10-19) passes and declares identical peer ranges (`eslint ^10`, `typescript >=4.8.4 <6.1.0`). STACK.md pins the minor (8.72), so this stays in spec. The policy was kept rather than relaxed.
- **PostgreSQL 16** - `postgres:16.15-alpine` pulled and running; `select version()` reports `PostgreSQL 16.15 on x86_64-pc-linux-musl`.
- **Express 5.3.0, zod 4.6.7, ESLint 10.13.0, Prettier 3.9.10, Vitest 5.0.5, Supertest 7.3.1, turbo 2.11.10, pino 10.4.0** - all installed; `pnpm check` green.

Still **UNVERIFIED** (nothing in this session exercised them):

- OpenAPI toolchain zod-4 compatibility (`@asteasolutions/zod-to-openapi` 9.1, `openapi-typescript` 7.13, `openapi-fetch` 0.17). None of the three is installed, and the `pnpm openapi` stub that stood in for them was removed along with the drift gate it fed (see `docs/BACKLOG.md`, M1-03). The "VERIFY zod 4 compatibility on Day 1" item above is still open.
- Prisma driver adapter and `set_config` inside interactive transactions for row-level security.
- pg-boss, jose, argon2, Testcontainers, and every web-app dependency. (`express-rate-limit`, `helmet` and `cors` were closed in M1-02, below.)

## HTTP hardening verified (M1-02, 2026-10-27)

**express-rate-limit 8.7.1 works with Express 5.3.0. This closes the STACK.md VERIFY item.**

Not inferred from the peer range (`express: ">= 4.11"`), which would only show the pin is
permitted. Proven by test: `apps/api/src/common/hardening.test.ts` builds a limiter with
`limit: 1`, sends two requests, and asserts the second returns `429` with an
`application/problem+json` body. Also asserted: `draft-8` `RateLimit` headers are emitted,
the legacy `X-RateLimit-*` set is not, and a custom `keyGenerator` buckets independently.

- **helmet 8.3.0** - baseline headers verified (`X-Content-Type-Options: nosniff`,
  `X-Frame-Options` present, no `X-Powered-By`).
- **cors 2.8.6** - new dependency, approved in M1-02. Chosen over a hand-rolled middleware
  because preflight handling (OPTIONS, `Vary`, allowed headers and methods) is easy to get
  subtly wrong. Configured with a function origin, so no code path can emit `*`.

### Two operational limits to carry forward

1. **The rate-limit store is in-memory, so it is single-instance only.** Counters live in
   the process, so with N API tasks the effective limit is `limit x N`. A shared store
   (Redis, or `rate-limit-postgresql` on the existing database) is required before the API
   is scaled past one instance, and before the limits on auth and webhook routes can be
   treated as a real control. Tracked for M7.
2. **`TRUST_PROXY` must never be `true`.** Express's `trust proxy: true` trusts the whole
   `X-Forwarded-For` chain, so any client can spoof its address and win a fresh rate-limit
   bucket per request; express-rate-limit rejects the setting for the same reason. Config
   accepts only `false` or a hop count and refuses `"true"` at boot. Behind one ALB in
   ap-south-1 the value is `1`.

### Logging: pino cannot redact at arbitrary depth

This matters for CLAUDE.md rule 4, which sets no depth limit. `pino`'s `redact.paths` is
backed by fast-redact, whose `*` wildcard matches exactly ONE level: `*.phone` scrubs
`{patient:{phone}}` but NOT `{data:{patient:{phone}}}`, which was observed leaking a
real-format phone number into output. Redaction is therefore done by a recursive walker in
`apps/api/src/common/redaction.ts`, wired as pino's `formatters.log`.

Two pino behaviours were established empirically and are now relied on:

- **`formatters.log` runs BEFORE serializers.** The formatter receives live `Error`
  instances whose `name`, `message` and `stack` are non-enumerable, so it copies them out
  explicitly; a plain key walk or `JSON.stringify` would drop all three.
- **pino's default `err` serializer folds a cause's message into its parent's**
  (`"outer: inner"`). Messages are deliberately never redacted, so that fold is a route for
  unreviewed cause text to reach a message field. It is disabled with an identity `err`
  serializer on both the base logger and pino-http, and the `cause` chain is kept nested so
  each level is redacted on its own.

Consequence for every later ticket: **error messages must never contain patient data or
secrets.** Redaction cannot protect a message without making it useless, so throw with
identifiers only.

## Prisma 7 and row-level security (M1-04, 2026-10-27)

**VERIFIED by spike: `set_config` inside a Prisma interactive transaction works, so per-request
RLS is viable. This closes the STACK.md VERIFY item.** Measured against `postgres:16.15-alpine`
in Testcontainers, connected as a non-owner `app_user` with `NOBYPASSRLS`, through
`@prisma/adapter-pg` 7.10.1.

| Question                                                                                   | Result                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Does `set_config('app.org_id', 'org-a', true)` hold for the whole interactive transaction? | **Yes.** `current_setting` returned `org-a` and `widget.findMany()` through the model API returned only org-a's row (count 1). Prisma keeps one connection for the life of an interactive transaction. |
| Does the setting leak after commit?                                                        | **No.** `current_setting` was empty and a query outside the transaction returned 0 rows, because `true` scopes it to the transaction.                                                                  |
| Can `app_user` insert into another organisation?                                           | **No.** The policy's `WITH CHECK` rejected it.                                                                                                                                                         |
| Do sequential transactions bleed into each other?                                          | **No.** `org-a`, `org-b`, `org-a` each saw only their own row.                                                                                                                                         |

Consequences for the implementation:

- `withTenant` must use an **interactive transaction**. The setting is transaction-local, so a
  non-transactional query, or a second transaction, sees nothing.
- A query issued outside `withTenant` returns **zero rows** rather than failing loudly. Safe by
  default but silent, so the client extension still throws when there is no tenant context, to
  turn a silent empty result into a visible error.

### The request transaction commits before the response is sent (M1-12 fix, 2026-10-28)

`tenantMiddleware` keeps ONE interactive transaction open for the whole request, so a
handler that writes in two steps cannot leave half of it committed. That design once ended
the transaction on the response's `finish` event, which put `COMMIT` **after** the client
already held its 201. Two consequences, both observed: a client that wrote and immediately
read back took a different pooled connection and did not see its own row, and a `COMMIT`
that failed could no longer change a response that had gone out.

**The fix buffers the response.** The handler's bytes are collected in the middleware and
sent only once `COMMIT` has resolved. Three rules follow from that, and they are
constraints on every route, not implementation detail:

1. **No route may stream a response.** A progressive response would be withheld until the
   handler ended it, and a large one would accumulate in memory. Every handler ends with a
   single `res.json()` today, and the middleware throws rather than silently drop bytes if
   it is handed a chunk type it cannot buffer.
2. **Call recordings and other large media are served as presigned S3 URLs**, never proxied
   or streamed through the API. The API returns a URL; the bytes never enter a request
   transaction.
3. **The longer-term fix is per-operation transactions**, not a request-wide one. A service
   that opens a transaction around its own unit of work, commits it, and then lets the
   controller write the response needs no buffer and no streaming ban. That is a larger
   change to every repository signature, so it is deferred rather than done; until it
   lands, the buffer is what keeps the commit ahead of the response.

### Three Prisma 7 breaking changes that shape the code

1. **`url` is no longer allowed in the `datasource` block** (fails validation with P1012).
   Connection config moves to `prisma.config.ts` (`datasource.url`) and `PrismaClient` requires
   an `adapter`. Driver adapters are mandatory, not optional.
2. **The `prisma-client` generator emits TypeScript, not JavaScript**, into a path you choose
   rather than into `node_modules`. It is therefore compiled by our own `tsc`. The output
   (`apps/api/src/generated/`) is **gitignored** and rebuilt by `pnpm generate`, which the
   `build`, `typecheck` and `test` turbo tasks depend on, so a clean clone works without
   committing machine-written code. It is excluded from lint and from Prettier.
3. **Prisma ships its engine through a postinstall script**, so `prisma` and `@prisma/engines`
   need `allowBuilds` entries in `pnpm-workspace.yaml`. Testcontainers' optional
   Docker-over-SSH extras (`ssh2`, `cpu-features`, `protobufjs`) are explicitly **denied** there
   instead, since the local Docker socket is used.

## Creating a migration (M1-13, resolved 2026-10-28)

**`prisma migrate dev` must not be used on this project.** It compares the database
against migration history, and the hand-written SQL in `apps/api/prisma/sql` (policies,
roles, constraints, grants) is not in that history. Prisma therefore reports drift and
offers to RESET the database. Accepting that drops every policy and role, and on a shared
database it drops the data.

Use instead:

```sh
pnpm db:migrate:create <snake_case_name>   # writes the migration, touches no database
pnpm db:migrate                            # prisma migrate deploy, applies it
pnpm db:sql                                # re-applies the hand-written SQL
pnpm db:check-policies                     # fails if a tenant table lost its policy
```

`db:migrate:create` takes the diff between the MIGRATIONS directory and the schema, using
a throwaway Testcontainers PostgreSQL as the shadow database. Nothing persistent is read
or written, so it is safe to run against a working dev environment. Prisma 7 has no
`--shadow-database-url` flag: the shadow database is read from `prisma.config.ts`, which
picks it up from `SHADOW_DATABASE_URL`, and the script sets that to its container.

Verified 2026-10-28 both ways: with the schema unchanged it reports "No schema changes to
migrate", and with a column added it emitted the correct `ALTER TABLE` without touching a
real database. The same check confirms the hand-written `support_sessions` migration is
correct, since a diff from the migrations to the schema reports no difference.

**A new tenant table needs one more step.** Add a file to `prisma/sql/` that re-runs the
policy loop, because `apply.ts` does not re-run a file it has already recorded.
`pnpm db:check-policies` fails until that exists, which is the guard rather than a
convention.
