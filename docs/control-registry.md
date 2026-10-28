# Control registry

Checks promoted from defects. Each control names the defect that created it, so it is never
removed by someone who does not know what it prevents. Read it during code review: the
`code-review-checklist` skill points here.

## CR-001 — Long-lived resource handles must handle their failure events at construction

**From**: defect #1 (`pg.Pool` idle-error crashed the API process).

Any handle that outlives a single request must have its error and close events handled where it is
created, not only on the call path: connection pools, queue consumers and producers, websockets,
file watchers, schedulers, cache clients, provider SDK clients holding sockets.

In Node, an `EventEmitter` that emits `'error'` with no listener terminates the process. A database
restart or failover is routine, so an unhandled pool error turns routine maintenance into an outage.

**How it is checked**: review asks "what happens to this handle when the remote end dies?", and the
change ships a test asserting a listener is attached and that emitting the event does not throw.
See `apps/api/src/health/health.service.test.ts`.

## CR-002 — A security control is verified by attempting what it forbids

**From**: defect #2 (LocalStack reported a private bucket while serving it publicly).

A configuring API call returning success is not evidence the control has effect. Verification means
performing the forbidden action and observing refusal.

| Control          | Not acceptable as proof                | Required proof                                        |
| ---------------- | -------------------------------------- | ----------------------------------------------------- |
| Private bucket   | `put-public-access-block` returned 200 | Anonymous `GET` of an object returns 403              |
| Tenant isolation | Query includes `organisation_id`       | Org A reading org B's row gets 404                    |
| Permission check | `requirePermission` is called          | A denied role receives 403 in a test                  |
| Log redaction    | Field is in the redaction list         | Emitted log line is asserted not to contain the value |
| Auth required    | Middleware is registered               | Unauthenticated request returns 401                   |

This is already the shape of the mandatory test types in `.claude/skills/testing-quality-gates`;
CR-002 states the general rule so it also covers infrastructure and local-stack configuration.

## CR-003 — Registry presence is not installability

**From**: defect-adjacent friction (pnpm 12 vs corepack 0.34.0; `typescript-eslint@8.72.1` rejected
by `minimumReleaseAge`).

Confirming a version exists in a package registry does not establish that the pinned set installs
and runs together on a real machine. Run the install before publishing a version table or promising
a toolchain, and report the toolchain prerequisites the install revealed (here: corepack >= 0.36.0,
recorded in `README.md`).

## CR-004 — When a batch of checks fails uniformly, suspect the harness first

**From**: the incorrect "Docker registry is rate-limited" diagnosis, actually
`command not found: timeout` on macOS.

Before concluding anything from a failed batch, confirm the command exists and that a known-good
case passes. A uniform failure across unrelated targets is evidence about the test method, not the
targets.
