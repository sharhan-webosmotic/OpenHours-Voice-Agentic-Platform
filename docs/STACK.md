# Stack (fixed for Phase 1)

Versions checked against the npm registry on 2026-10-27. Pin exact versions in `package.json` and commit the lockfile. Anything marked VERIFY must be confirmed in the first session that uses it, and the result written here.

| Layer | Choice | Version | Notes |
| --- | --- | --- | --- |
| Runtime | Node.js LTS | 24 LTS (22.12+ also works) | All chosen packages support Node >= 22.12. Set in `.nvmrc` and `engines`. |
| Package manager | pnpm + Turborepo | pnpm 12.x, turbo 2.11 | Use `packageManager` field with corepack. |
| Language | TypeScript strict | **6.0.3** | Do NOT use 7.x yet: typescript-eslint 8.72 supports `>=4.8.4 <6.1.0`. Revisit when it supports 7. |
| API framework | Express | 5.3 | Async errors propagate natively in v5. |
| Validation | zod | 4.6 | Shared in `packages/shared`. |
| OpenAPI | @asteasolutions/zod-to-openapi, openapi-typescript, openapi-fetch | 9.1 / 7.13 / 0.17 | VERIFY zod 4 compatibility on Day 1. |
| ORM / DB | Prisma + PostgreSQL 16 | **prisma and @prisma/client 7.10.1** | The npm `latest` tag for `prisma` currently points to an 8.0 release candidate. Pin the stable 7.10.1 for BOTH packages; do not use `latest`. VERIFY: driver adapter and `set_config` inside interactive transactions for row-level security. |
| Jobs | pg-boss | 12.38 | Runs on the same PostgreSQL; no Redis. |
| Auth | Self-managed: jose, argon2 | 6.2 / 0.45 | argon2id; 15-min JWT; rotating refresh tokens; device tokens for Android. |
| Logging / errors | pino, @sentry/node | 10.4 / 11.9 | Redaction list is mandatory. |
| HTTP hardening | helmet + express-rate-limit | 8.3 / latest 8.x | VERIFY rate-limit version on install. |
| Phones | libphonenumber-js | 1.13 | E.164 everywhere. |
| Storage | AWS S3 (ap-south-1), @aws-sdk/client-s3 | 3.x | Private, SSE, signed URLs. |
| Web apps | React, Vite, Tailwind CSS | 19.3 / 8.3 / 4.3 | Tailwind via `@tailwindcss/vite`. |
| Web libs | React Router 8, TanStack Query 5, TanStack Table, React Hook Form 7, date-fns | 8.5 / 5.105 / latest / 7.91 / latest | Radix primitives with shadcn/ui pattern. |
| Web tests | Vitest 5, Testing Library, MSW 3, Playwright | 5.0 / latest / 3.0 / 1.64 | |
| API tests | Vitest, Supertest, Testcontainers (PostgreSQL) | 5.0 / 7.3 / 12.2 | Connect as restricted `app_user` role. |
| Android (last phase) | Provisional: Kotlin, Jetpack Compose, Hilt, Room, WorkManager, FCM | decided when Android starts | Built after API, admin-web and clinic-web. The scope document says React Native; confirm then. |
| Voice | Sarvam Voice Agents | per `docs/voice/sarvam-contract.md` | Thin `VoiceProvider` interface, one implementation. |
| Cloud | AWS ap-south-1 (Mumbai) | | RDS PostgreSQL, ECS Fargate, S3, Secrets Manager, CloudWatch, CloudFront. Terraform. |
| CI/CD | GitHub Actions | | See `release-readiness` skill. |
| Quality | ESLint 10 + typescript-eslint, Prettier, husky + lint-staged, commitlint | 10.13 / 8.72 | `pnpm check` is the gate. |

## Open items
- Android stack (React Native per scope document vs Kotlin) is decided when the Android phase starts.
- Telephony/number provider not yet named.
- Email provider for invites and resets (SES or Resend) or temporary-password flow.
- Recording retention default to be confirmed with legal.
