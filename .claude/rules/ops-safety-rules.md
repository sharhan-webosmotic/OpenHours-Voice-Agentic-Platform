---
description: "Ops safety rules — requires explicit user confirmation before any external-touching, cost-incurring, or irreversible operation. Local development is always smooth. External connections, CI/CD, deployment, and server ops require a warning + approval first."
globs:
  - ".github/workflows/**"
  - "**/Dockerfile*"
  - "**/docker-compose*.yml"
  - "**/.env*"
  - "**/deploy/**"
  - "**/infrastructure/**"
  - "**/terraform/**"
---

# Ops Safety Rules

These rules protect you from surprise costs, unintended deployments, and external side effects.
**Local development is always smooth — no warnings needed for local work.**
**Anything that touches external systems requires a warning + your explicit approval first.**

---

## The Two Categories

### Category A — Always Safe (No Warning Needed)
These are local, reversible, and free:
- Writing/editing source code files (`src/`, `app/`, `lib/`, `components/`)
- Writing test files
- Writing docs and specs (`docs/`)
- Running local dev server (`npm run dev`, `python main.py`)
- Running local tests (`npm test`, `pytest`)
- Git operations (status, diff, log, add, commit, branch, checkout, stash)
- Package installs for development (`npm install`, `pip install`)
- Building locally (`npm run build`)
- Linting and formatting

### Category B — Requires Warning + Approval (External / Cost-Incurring / Irreversible)

**CI/CD & GitHub**:
- Creating or modifying `.github/workflows/` files → warns about CI minutes cost
- Pushing to trigger CI pipeline → warns about CI execution
- Creating/merging PRs that trigger CI → warns
- Setting up GitHub Actions secrets → warns (irreversible if set wrong)

**Deployment**:
- Any `deploy` command, deployment script, or cloud CLI command
- Pushing Docker images to a registry
- Triggering a production, staging, or any cloud deployment
- Kubernetes apply, Helm upgrade, Terraform apply
- Any command that modifies live infrastructure

**LLM/AI APIs**:
- Any Anthropic, OpenAI, Google AI API call from code being tested
- Any embedding generation against a live model
- Any RAG pipeline call

**Database (Production/Staging)**:
- Running migrations against staging or production database
- Direct database queries against non-local databases
- Seed scripts against non-local databases

**External APIs / Third-Party**:
- Any call to a payment processor (Stripe, etc.)
- Any call to email/SMS provider (SendGrid, Twilio, etc.)
- Any call to cloud storage (S3, GCS, Azure Blob)
- Any call to external auth providers (Auth0, Clerk, Firebase)
- Any webhook registration or configuration

**Server Operations**:
- SSH into any server
- Restart, stop, or scale any cloud service
- Modify DNS records
- Certificate provisioning
- Cloud resource provisioning (EC2, RDS, Cloud Run, etc.)

---

## Required Warning Format

Before performing any Category B operation, show this warning:

```
⚠️  EXTERNAL OPERATION — APPROVAL REQUIRED
────────────────────────────────────────────
Action: [specific action about to be taken]
Type: [CI/CD | Deployment | API Call | Database | External Service | Server Op]
Cost impact: [estimated cost or "unknown — check billing"]
Reversible: [Yes / No / Partially]
What happens if something goes wrong: [brief description of risk]

Do you want to proceed? (yes / no)
────────────────────────────────────────────
```

**Never proceed with a Category B operation without receiving a "yes" response.**

---

## CI/CD Specific Rules

1. **Do not create `.github/workflows/` files by default** — always ask first
   - "I can set up GitHub Actions CI for this project. This will use your GitHub Actions minutes (free tier: 2,000 min/month for private repos). Would you like me to create the workflow?"

2. **Show the workflow before creating it** — show the YAML, get approval, then write the file

3. **Warn about GitHub Actions costs** before creating any workflow:
   - Public repos: Free
   - Private repos: 2,000 free minutes/month, then ~$0.008/minute (Linux), ~$0.016/minute (Windows)
   - Large runners cost more

4. **Never auto-push to trigger CI** — always ask before `git push`

---

## Deployment Specific Rules

1. **Always show the deployment runbook** before executing any deployment step

2. **Always confirm the target environment** — staging vs production must be explicitly confirmed:
   - "This will deploy to **PRODUCTION**. Type 'deploy to production' to confirm."

3. **Never run `terraform apply`** without showing `terraform plan` output first and getting confirmation

4. **Never run database migrations in production** without:
   - Showing the migration content
   - Confirming staging was tested
   - Getting explicit "run migration" confirmation

5. **Graduated deployment autonomy** — autonomy is tiered by blast radius, not blanket-forbidden. The old rule forbade the AI from even reading prod health, which is too conservative for the within-milestone autonomy model.

   | Tier | Examples | Autonomy |
   |---|---|---|
   | Read-only verification | health checks, smoke tests, log/metric/uptime reads, `terraform plan`, `kubectl get`, status queries | **AI may run autonomously** (reversible, no mutation) |
   | Ephemeral / dev / preview deploy | a PR preview env, a dev deploy, a throwaway stack | **AI may run autonomously** (no shared-state impact) |
   | Staging / production mutation | deploy, migration, scale, DNS, secret change, `terraform apply`, registry push | **Human-approved** (show the command, get explicit confirmation) |
   | Rollback decision | any rollback in staging/prod | **Human-approved** (the AI may recommend and prepare, the human decides) |

   The line: read freely, mutate shared environments only with a human in the loop. The
   `release-readiness` skill follows these tiers.

---

## LLM API Call Rules in Development

When testing LLM integrations locally:

1. **Warn before making a real API call** in a test or dev run:
   - "This will make a real Anthropic API call. Estimated cost: ~$[X]. Proceed?"

2. **Default to mock mode** for tests — real API calls in tests require opt-in

3. **Never call production LLM APIs in a loop** during testing without a cost cap

---

## Third-Party Integration Rules

When setting up any third-party service connection:

1. **Show what credentials/config will be used** before connecting
2. **Warn about webhook registrations** — they create permanent external state
3. **Warn about Stripe/payment configurations** — mistakes here affect real money
4. **Always use test/sandbox credentials** for development — never production payment credentials in dev

---

## Local Development is Always Smooth

To be clear: these rules do NOT apply to local development. The following always run without warnings:
- `npm run dev`, `npm start`, `vite dev`, `next dev`
- `python main.py`, `uvicorn app:main --reload`
- `flutter run`, `expo start`
- `docker-compose up` (local only)
- `npm test`, `pytest`, `flutter test`
- Any hot-reload, watch mode, or local build
- Reading and writing to local files

<!-- Version: 1.1.0 — 2026-06-29 — Track E T-E.10: added graduated deployment-autonomy tiers (read-only + dev/preview autonomous; staging/prod mutation + rollback human-approved). -->

