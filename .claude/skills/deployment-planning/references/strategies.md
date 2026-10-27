# Deployment Strategies by Project Type

> Extracted from [SKILL.md](SKILL.md) — deployment standards per project type and deployment strategy patterns.

---

## Project Type Awareness

### POC Deployment Standards

**Deployment Targets**:
- **Localhost**: Run on developer machine (e.g., `npm run dev`, `python manage.py runserver`)
- **Shared Dev Server**: Deploy to shared development server accessible by team
- **Cloud POC**: Quick cloud deployment (Heroku, Vercel, Netlify, Railway)

**Infrastructure**:
- Manual deployment acceptable (no automation required)
- Single instance only (no load balancing)
- No CI/CD pipeline required
- Environment variables can be in `.env` file (not encrypted)

**Pre-Deployment Checklist** (Minimal):
- [ ] Code runs without errors locally
- [ ] Environment variables documented in README
- [ ] Database migrations applied (if any)

**Deployment Steps** (Example for Node.js + Heroku):
```bash
# 1. Ensure Heroku CLI installed
heroku --version

# 2. Create Heroku app (first time only)
heroku create [app-name]

# 3. Set environment variables
heroku config:set DATABASE_URL=[url] API_KEY=[key]

# 4. Deploy
git push heroku main

# 5. Run migrations (if needed)
heroku run npm run migrate

# 6. Open app
heroku open
```

**Testing**:
- Manual smoke tests only (open app, click around)
- No automated health checks required
- Verify critical flow works (e.g., login, basic CRUD)

**Monitoring**:
- Application logs sufficient (`heroku logs --tail` or `docker logs`)
- No APM/metrics required
- No uptime monitoring needed

**Rollback**:
- **Git-based rollback** (for Heroku/Vercel/Netlify):
  ```bash
  # Rollback to previous version
  heroku rollback
  # or
  git revert [commit-hash]
  git push heroku main
  ```
- **Localhost**: `git checkout [previous-commit]` and restart
- Manual rollback acceptable (estimated time: 5-10 minutes)
- No automated rollback needed

**When to Skip Deployment Entirely**:
- POC is for internal demo only → Run on localhost, share screen
- Throwaway code → No deployment needed

---

### MVP Deployment Standards

**Infrastructure**:
- Staging → Production workflow
- Basic CI/CD pipeline (GitHub Actions, GitLab CI)
- Docker containers recommended

**Testing**:
- Automated smoke tests required
- Health check endpoints required

**Monitoring**:
- Uptime monitoring required (Uptime Robot, Pingdom)
- Application logs + basic metrics

**Rollback**:
- Documented rollback procedure
- Estimated rollback time: <10 minutes

---

### Production-Grade Deployment Standards

**Infrastructure**:
- Full CI/CD pipeline with automated gates
- Kubernetes or managed container service
- Blue-Green or Canary deployment
- Infrastructure as Code (Terraform, CloudFormation)

**Testing**:
- Full automated test suite (unit, integration, E2E)
- Load testing before production
- Security scanning in pipeline

**Monitoring**:
- Full observability stack (logs, metrics, traces)
- APM tool required (New Relic, Datadog, Dynatrace)
- Custom dashboards for business metrics

**Rollback**:
- Automated rollback triggers
- Rollback time: <5 minutes
- Tested rollback procedure

---

## Deployment Strategy Patterns

### Direct Deployment (POC Only)

**When**: POC projects, non-critical environments

**Process**:
1. Stop old version
2. Deploy new version
3. Start new version
4. Manual smoke test

**Downtime**: Yes (acceptable for POC)

---

### Rolling Deployment (MVP)

**When**: MVP projects with multiple instances

**Process**:
1. Deploy to instance 1, wait for health check
2. Deploy to instance 2, wait for health check
3. Continue until all instances updated

**Downtime**: No (but mixed versions temporarily)

---

### Blue-Green Deployment (Production)

**When**: Production projects requiring instant rollback

**Process**:
1. Deploy new version to "Green" environment
2. Run smoke tests on Green
3. Switch load balancer from Blue → Green
4. Monitor for 30 minutes
5. If stable, decommission Blue (or keep for rollback)

**Downtime**: Zero

**Rollback**: Switch load balancer back to Blue (<1 minute)

---

### Canary Deployment (Production - High Risk)

**When**: Production with high-risk changes

**Process** (each stage gates on metrics, not just a timer):
1. Deploy the new version to 5% of traffic
2. Bake 15 min, then promote to 25%, bake, 50%, bake, 100%

**Promotion gate at every stage (auto-abort if breached):**

| Metric | Abort threshold (canary vs baseline) |
|---|---|
| Error rate (5xx) | canary 5xx rate > baseline + 1 percentage point, or > 2x baseline |
| p95 latency | canary p95 > baseline p95 x 1.2 |
| p99 latency | canary p99 > baseline p99 x 1.5 |
| Crash / restart rate | any increase over baseline |
| Business KPI (where instrumented) | conversion/success rate drops > 5% relative |

- **Bake time per stage:** at least 15 min AND enough traffic for the metric to be statistically meaningful (do not promote off 12 requests).
- **Auto-abort:** if any threshold is breached during a stage, automatically route 100% back to the old version and hold. Auto-abort is a SYSTEM action (the canary controller), distinct from a human rollback decision: the system may abort a canary to baseline autonomously, a full prod rollback of an already-promoted release is human-approved (ops-safety graduated autonomy).
- **Tooling:** Argo Rollouts, Flagger, or the provider's weighted routing (ALB/App Mesh, GCP traffic splitting) drives the shift + metric checks.

**Downtime**: Zero

**Rollback**: Route all traffic back to the old version (auto on threshold breach during canary; human-approved for a fully-promoted release)

---

### Feature flags (dark launch + decouple deploy from release)

Flags let you SHIP code dark and RELEASE it separately, which is what makes expand/contract migrations and risky features safe:

- **Dark launch:** deploy the code behind an off flag, enable for internal users, then a percentage, then all. The deploy and the release are two events.
- **Expand/contract migrations** (per `data-migration-rules`): the new read path sits behind a flag so you can flip back instantly if the backfill is wrong, without a redeploy.
- **Kill switch:** every risky feature ships with a flag that disables it without a deploy, so an incident mitigation is a toggle, not a rollback.
- **Hygiene:** flags are debt. Each flag has an owner and a removal date; stale flags are cleaned up in `/operations` maintenance.
- **Tooling:** LaunchDarkly / Unleash / Flagsmith, or a simple config-backed flag service for smaller projects.
