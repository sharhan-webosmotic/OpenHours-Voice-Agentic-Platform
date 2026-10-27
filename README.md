# OpenHours Voice Agentic Platform

Multi-tenant SaaS for clinics: an AI voice receptionist (Sarvam) that books, reschedules and
cancels appointments and answers clinic information questions, plus the dashboards clinic
staff and OpenHours staff use to run it.

The platform stores patient health data. Every change is production code in a regulated
domain — read [`CLAUDE.md`](CLAUDE.md) before contributing, and the per-app `CLAUDE.md`
for the app you are touching.

> **Status: foundation only.** This repository currently contains the monorepo skeleton,
> tooling and an API health/readiness endpoint. There are no product features, no database
> schema and no authentication yet.

## Repository layout

| Path                  | What it is                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| `apps/api`            | Express 5 + TypeScript API, background jobs and webhooks. Prisma + PostgreSQL arrive in a later prompt. |
| `apps/clinic-web`     | React dashboard for clinic staff. Placeholder — not scaffolded yet.                                     |
| `apps/admin-web`      | React internal admin console. Placeholder — not scaffolded yet.                                         |
| `apps/android`        | Call-forwarding app. **Built last**, after the API and both web apps are signed off.                    |
| `packages/shared`     | zod schemas, enums and the permission matrix shared by API and web.                                     |
| `packages/api-client` | Typed client generated from the OpenAPI document. Placeholder.                                          |
| `infra`               | Terraform (AWS ap-south-1) and local docker compose support files.                                      |
| `docs`                | ADRs, [`docs/STACK.md`](docs/STACK.md) (pinned versions and the verification log), runbooks.            |

## Prerequisites

- **Node.js 22.12 or newer.** `.nvmrc` pins 24; `nvm use` picks it up.
- **corepack 0.36.0 or newer**, then `corepack enable`. pnpm is pinned to 12.15.0 via the
  `packageManager` field and corepack installs it for you.

  > The corepack bundled with Node 22.21.1 is 0.34.0 and **cannot run pnpm 12** — it fails
  > with `Cannot find module .../bin/pnpm.cjs` because pnpm 12 ships `bin/pnpm.mjs`.
  > If you hit that, run `npm install -g corepack@latest` and then `corepack enable`.

- **Docker** with Compose v2, for PostgreSQL and the S3-compatible object store.

## First-time setup

```sh
corepack enable            # once per machine
nvm use                    # or otherwise select Node >= 22.12
pnpm install

cp .env.example .env       # docker compose settings (ports, local credentials)
docker compose up -d       # PostgreSQL 16 + SeaweedFS, with a private bucket created on start

cp apps/api/.env.example apps/api/.env
pnpm check                 # must pass before you call anything done
pnpm dev                   # API on http://localhost:3000
```

If PostgreSQL 5432 is already in use on your machine, change `POSTGRES_PORT` in `.env`
and the port in `DATABASE_URL` in `apps/api/.env` to match.

Verify the API is up:

```sh
curl -i http://localhost:3000/health   # 200 whenever the process is running
curl -i http://localhost:3000/ready    # 200 only when PostgreSQL answers, else 503
```

`.env` files are git-ignored and must never be committed. Only `.env.example` files are
tracked, and they contain placeholders — never real credentials.

## Commands

Run these from the repository root.

| Command           | What it does                                                                            |
| ----------------- | --------------------------------------------------------------------------------------- |
| `pnpm dev`        | Starts every app that has a `dev` script (currently the API, with reload).              |
| `pnpm check`      | **The gate**: typecheck + lint + test + OpenAPI drift. Must pass before you say "done". |
| `pnpm test`       | Vitest across `apps/api` and `packages/shared`.                                         |
| `pnpm typecheck`  | `tsc --noEmit` per package, including test files.                                       |
| `pnpm lint`       | ESLint 10 flat config across the workspace.                                             |
| `pnpm build`      | Emits `dist/` per package (source only, no tests).                                      |
| `pnpm format`     | Prettier over the repository.                                                           |
| `pnpm openapi`    | **Stub.** Will generate the OpenAPI document from zod schemas.                          |
| `pnpm db:migrate` | **Stub.** Will run Prisma migrations.                                                   |
| `pnpm db:seed`    | **Stub.** Will seed synthetic data.                                                     |

The three stubs print `not yet implemented` and exit 0, so a green `pnpm check` is never
mistaken for a real OpenAPI or database gate. They are replaced in later prompts.

## Local services

`docker compose up -d` starts:

- **PostgreSQL 16** (`postgres:16.15-alpine`) on `POSTGRES_PORT`.
- **SeaweedFS** S3-compatible object storage on `S3_PORT`, plus a one-shot `s3-init`
  container that creates the recordings bucket and exits.

The bucket is **private**: the S3 gateway is configured with exactly one credentialed
identity and no anonymous identity, so unauthenticated requests get `403 AccessDenied`.
Production uses real AWS S3; `docs/STACK.md` explains why this is SeaweedFS and not MinIO
or LocalStack.

## How CI works

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every pull request, in two
parallel jobs. Its steps are deliberately the same pnpm commands you run locally, so a
green local `pnpm check` should mean a green CI.

**`verify`** — with a PostgreSQL 16 service container:

1. `corepack enable`, then `pnpm install --frozen-lockfile` (a stale lockfile fails the build)
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test`
5. `pnpm openapi:check` — the OpenAPI drift gate (currently the stub)
6. `pnpm build`

**`audit`** — `pnpm audit --audit-level high`, which **fails the build on any high or
critical advisory**.

Two supply-chain controls are configured in `pnpm-workspace.yaml` and apply locally and in
CI alike:

- `minimumReleaseAge: 1440` rejects dependency versions published less than 24 hours ago.
- `allowBuilds` lists the only dependencies permitted to run install scripts.

## Commit conventions

Conventional commits are enforced by commitlint via a husky `commit-msg` hook, and
`lint-staged` runs Prettier and ESLint on staged files before each commit.

```sh
git commit -m "feat: add appointment cancellation endpoint"   # accepted
git commit -m "updated some stuff"                            # rejected
```

Branch per task, small pull requests. Never push to `main` and never force-push.
