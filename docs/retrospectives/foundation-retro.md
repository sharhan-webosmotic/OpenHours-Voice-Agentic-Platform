# Retrospective — Foundation (pre-milestone)

**Date**: 2026-10-27
**Scope**: single session, 2026-10-27. Repository state `2cd6765` (first commit) to the staged foundation change.
**Facilitator**: agent (Claude), reviewed by the operator

> **Evidence basis.** This retro is grounded in git state, command output observed in-session,
> and `docs/STACK.md`. The ADF retro inputs the skill normally reads did not exist when it ran:
> `AI_DOCS/memory/metrics.jsonl`, `AI_DOCS/memory/decision-log.md`,
> `AI_DOCS/quality/defect-log.md` and `AI_DOCS/planning/milestones/` were all absent, because
> `AI_DOCS/` was scaffolded in this same session and no milestone plan has been produced yet.
> Section 6 therefore reports what is measurable and marks the rest unavailable rather than
> estimating it. No transcript pass was run (not requested).

## 1. What we planned

Two pieces of work, both operator-specified:

1. **Monorepo foundation, no product features**: pnpm workspaces + Turborepo, strict TypeScript,
   ESLint 10 + Prettier, Vitest, husky + lint-staged + commitlint, `.env.example`, the seven
   `pnpm` scripts with `pnpm check` as the gate, a docker-compose local stack (PostgreSQL 16 +
   S3-compatible storage with a private bucket), a PR CI workflow with a dependency audit, an
   Express 5 API skeleton with `/health`, `/ready` and graceful shutdown, and a root README.
2. **Install the ADF skill framework** (`bhavesh-webosmotic/claude-skills`) into the workspace,
   replacing existing skills on collision.

No estimate in hours or points was given, so Section 2 reports scope variance only.

## 2. What we shipped

Both items, in full. 875 staged files across 2 logical changes.

| Planned                                         | Shipped                                                 | Variance                                      |
| ----------------------------------------------- | ------------------------------------------------------- | --------------------------------------------- |
| Monorepo + tooling + CI + API skeleton + README | All of it                                               | 0                                             |
| ADF framework installed                         | Installed in **merge mode**, not the documented mode    | Scope _changed_ by operator decision mid-task |
| `pnpm openapi` / `db:migrate` / `db:seed`       | Named stubs that exit 0 and print "not yet implemented" | As specified                                  |

Three additions beyond the literal brief, each approved before implementation: `pino`/`pino-http`
(the no-`console.log` rule needs a logger), `zod` in the API (the validate-env-with-zod rule), and
`pg` (a DB-backed `/ready` without pulling in Prisma early).

## 3. What went well

- **Version claims were verified against the registry rather than assumed.** This caught that
  `prisma@latest` really is `8.0.0-rc.27` and that `typescript@latest` is `7.0.2`, both confirming
  `docs/STACK.md`'s warnings instead of silently trusting them.
- **Dependency injection in the API skeleton paid for itself immediately.** `createApp({ readiness })`
  made the `/ready` 200 and 503 paths unit-testable with no database, and it is what let the
  pool-crash regression test exist at all. 10 tests pass; `apps/api` is at 89.09% lines.
- **The gate was proven from a clean tree, not from the working directory.** `pnpm install
--frozen-lockfile && pnpm check` was run against a `git write-tree` export in a scratchpad, so
  "it works on a fresh clone" is an observation, not a hope.
- **Two blocked actions were respected rather than circumvented.** Writing `.claude/settings.json`
  (classifier: self-modification) and executing ADF's own test script (classifier: external code)
  were both left undone and handed to the operator with exact commands.

## 4. What went wrong

### Issue 1: A crash-on-database-restart bug shipped into the first draft

- **What**: stopping PostgreSQL killed the whole API process instead of turning `/ready` red.
  `curl` returned `HTTP 000`; the log showed `throw er; // Unhandled 'error' event` with
  `terminating connection due to administrator command`.
- **Root cause**: `pg.Pool` emits `'error'` for _idle_ client failures. The code only handled
  errors on the query path, which is the obvious path. The upstream cause is that the readiness
  probe was written against the happy path and the failure mode was never enumerated before coding.
- **Impact**: caught pre-commit, so zero customer impact. It would have been a production incident
  on the first RDS failover or maintenance restart: the orchestrator would have seen container
  exits rather than a readiness blip.
- **Prevent next time**: rule added — see Section 2.5. Any long-lived resource handle
  (connection pool, queue consumer, websocket, file watcher) must have its error/close event
  handled at construction, with a test asserting the listener exists.

### Issue 2: The first S3 choice was wrong, and the justification was the thing that was wrong

- **What**: LocalStack was selected and built into `docker-compose.yml` specifically for
  private-bucket fidelity. On test, an anonymous `GET` of an object returned `HTTP 200` with the
  body, even with `S3_SKIP_SIGNATURE_VALIDATION=0` and `ENFORCE_IAM=1`. It accepted
  `put-public-access-block` and _reported_ the bucket private while serving it to anyone.
- **Root cause**: the control was asserted from the API call succeeding rather than from
  observing the behaviour the control is supposed to produce. A configuration call returning
  200 is not evidence the configuration has effect.
- **Impact**: ~1 compose service rewritten. Had it not been tested, the local stack would have
  taught every developer that "the bucket is private" while it was world-readable.
- **Prevent next time**: rule added — see Section 2.5. A security control is verified by
  attempting the thing it forbids, not by the configuring call's status code.

### Issue 3: Two pinned-toolchain failures only surfaced at install time

- **What**: (a) pnpm 12.15.0 would not run — bundled corepack 0.34.0 looks for `bin/pnpm.cjs`
  while pnpm 12 ships `bin/pnpm.mjs`. (b) `typescript-eslint@8.72.1` was rejected by pnpm 12's
  `minimumReleaseAge` policy, published ~16h before the install.
- **Root cause**: the pre-work verification checked _existence_ of each pinned version in the
  registry, not _installability together on this machine_. Registry presence and a working
  install are different claims.
- **Impact**: ~4 debugging cycles, including one wrong diagnosis (below). No rework of shipped code.
- **Prevent next time**: for a new toolchain pin, run the install before writing the plan's
  version table, not after. Added to Section 7.

### Issue 4: A wrong diagnosis was published to the operator before being corrected

- **What**: Docker probes were reported as rate-limited, concluding the registry was unreliable
  and MinIO tag availability was unknowable. The real cause was that `timeout` does not exist on
  macOS, so every probe in that batch failed with `command not found` rather than from the network.
- **Root cause**: a batch of probes was judged by its pass/fail output without checking that the
  command itself ran. The `(eval):1: command not found: timeout` line was present and skimmed past.
- **Impact**: one plan item ("MinIO tags unverifiable") was wrong and had to be retracted in the
  next message. Operator time spent reading an incorrect conclusion.
- **Prevent next time**: when a batch of checks fails uniformly, suspect the harness before the
  target. Confirm the tool exists and a known-good case passes.

## 5. Surprises

- **pnpm 12 ships supply-chain controls on by default.** `minimumReleaseAge` blocking a
  day-old package was unexpected and is a genuine upgrade in safety posture for a regulated
  project. It was kept and made explicit rather than relaxed. pnpm 12 also moved settings out of
  `package.json` into `pnpm-workspace.yaml`, and `onlyBuiltDependencies` is now `allowBuilds`.
- **MinIO is no longer freely distributable.** Confirmed: `minio/minio:latest`,
  `quay.io/minio/minio:latest` and dated `RELEASE.*` tags all fail to resolve. Any guide that
  says "use MinIO for local S3" is now stale.
- **ADF's and this project's skill sets do not overlap at all.** Zero name collisions across 99
  and 11 skills, so the anticipated conflict ("replace if exists") never arose. The real conflict
  was in `settings.json` and the git-tracking model, which nobody had predicted.
- **The repo's shape changed more than the code did.** The ADF install added ~700 third-party
  files and 14MB against ~90 files of actual project code.

## 6. Metrics

| Metric                      | Value                                                                                            | Trend             |
| --------------------------- | ------------------------------------------------------------------------------------------------ | ----------------- |
| `pnpm check`                | exit 0 (typecheck, lint, 10 tests, openapi stub)                                                 | first measurement |
| Tests                       | 10 passed (9 `apps/api`, 1 `packages/shared`)                                                    | first measurement |
| `apps/api` coverage         | 89.09% lines, 50% branch                                                                         | first measurement |
| Dependency audit            | `No known vulnerabilities found` (high/critical gate)                                            | first measurement |
| Prettier                    | clean across the repo                                                                            | first measurement |
| Clean-clone install + check | exit 0 with `--frozen-lockfile`                                                                  | first measurement |
| Runtime verification        | `/health` 200 up+down, `/ready` 200/503/200 recovery, clean SIGTERM                              | first measurement |
| Defects found pre-commit    | 3 (pool crash, LocalStack privacy, prettier rewriting protected files)                           | first measurement |
| Escaped defects             | 0 (nothing released)                                                                             | first measurement |
| Commits in scope            | 1 staged change on `feat/foundation-setup`                                                       | —                 |
| Skills invoked / abandoned  | **unavailable** — `metrics.jsonl` did not exist during this session                              | —                 |
| Anchor-hook blocks          | **unavailable** — not recorded; 2 classifier denials observed (self-modification, external code) | —                 |
| Gate failures               | **unavailable** — no ADF gates were active (`settings.json` unmerged)                            | —                 |
| Total wall-clock            | **not tracked**                                                                                  | —                 |
| Planned vs actual           | 0 scope variance; 1 operator-directed scope change (ADF merge mode)                              | —                 |

## 2.5 Defect feedback loop

`AI_DOCS/quality/defect-log.md` did not exist, so it was created and the three defects found in
this session were entered with their prevention stamped. Two prevention rules were small enough to
write immediately and were written, not deferred:

| Defect                                                               | Escaped? | Prevention                                                                                                                        | Status                   |
| -------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `pg.Pool` idle-error crashes the process                             | no       | `AI_DOCS/quality/control-registry.md` → "Resource handles" rule + regression test in `apps/api/src/health/health.service.test.ts` | **done this retro**      |
| LocalStack served a "private" bucket anonymously                     | no       | `AI_DOCS/quality/control-registry.md` → "Security controls are verified by violation" rule                                        | **done this retro**      |
| `pnpm format` would rewrite protected `CLAUDE.md` / `.claude/` files | no       | `.prettierignore` entries                                                                                                         | **done during the work** |

## 7. Action items

- [ ] Enforce coverage floors in CI (90% auth/tenancy/permissions/booking/webhooks, 80% elsewhere
      per `CLAUDE.md`); CI runs no coverage today and `apps/api` branch coverage is 50% —
      owner: next API prompt — by: before the first real module merges
- [ ] Decide whether `docs/` or `AI_DOCS/` is authoritative for ADRs and specs, and write it into
      `CLAUDE.md`; two parallel documentation trees now exist — owner: operator — by: before ADF
      skills start writing architecture docs
- [ ] Apply or reject `.claude/settings.json.adf-merged`; ADF's governance gates do not fire until
      it is applied — owner: operator — by: before relying on any ADF gate
- [ ] Verify the CI workflow actually runs (it has never executed; the pinned-corepack step is the
      most likely failure) — owner: whoever opens the first PR — by: first PR
- [ ] For any new toolchain pin, install it before publishing a version table — owner: agent
      convention, recorded in `control-registry.md` — by: immediate

Deferred to `AI_DOCS/backlog/retro-actions.md`: add `format:check` to CI, add migrations-on-empty-DB
and the policy-coverage script to CI, write the ADF upgrade script described in
`.claude/ADF-INSTALL-NOTES.md`.

## 8. Inputs for next milestone

- **Warnings (prior art to avoid)**
  - Verify a security control by attempting what it forbids; a 200 from the configuring call proves nothing.
  - Handle the error/close event on every long-lived resource handle at construction.
  - Registry presence is not installability. Install the pinned set before promising it.
  - When a batch of checks fails uniformly, suspect the harness before the target.
  - `prisma@latest` is an 8.0 release candidate. Pin 7.10.1 for both `prisma` and `@prisma/client`.
- **Patterns that worked (repeat these)**
  - Inject dependencies into the app factory so failure paths are testable without infrastructure.
  - Prove the gate from a clean-tree export, not the working directory.
  - Name stub scripts so a green gate can never be mistaken for a real one.
  - State unverified items explicitly in `docs/STACK.md` instead of letting them look verified.
- **Unknowns to resolve first**
  - OpenAPI toolchain vs zod 4 (`@asteasolutions/zod-to-openapi` 9.1, `openapi-typescript` 7.13,
    `openapi-fetch` 0.17) — still the open `docs/STACK.md` "VERIFY on Day 1" item.
  - Prisma driver adapter and `set_config` inside interactive transactions for row-level security.
  - Whether ADF's `/do` governance model can coexist with `CLAUDE.md`'s plan-then-approve rule,
    or whether one must yield.

## 9. References

- `docs/STACK.md` → "Verification log" and "Local object storage (decided 2026-10-27)"
- `.claude/ADF-INSTALL-NOTES.md` → the four deviations from a stock ADF install
- `AI_DOCS/quality/defect-log.md`, `AI_DOCS/quality/control-registry.md`
- `apps/api/src/health/health.service.ts` → the pool error-handler comment explaining the crash
- Metrics snapshot: not written — `metrics.jsonl` was absent for this session
