---
name: audit
description: "Single pre-ship verification skill. Consolidates security-audit + accessibility-audit + audit-logs + secrets-policy. Greps for hardcoded secrets, runs dependency CVE check, runs a11y scan, runs OWASP grep checklist (compliance projects), verifies audit-log code paths exist for sensitive endpoints. Outputs ONE file: AI_DOCS/audit/audit-report.md (overwritten each run) with verdict PASS|FAIL|CONCERNS. /ship refuses to run unless last verdict is PASS or user explicitly overrides via /ask."
skill_id: SK-132
version: 2.10.1
context_budget:
  load_kb: 35
  scope: milestone
dependencies:
  required: []
  optional: [ask, security-auditor]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
  category: quality
  user_facing: false
---

# /audit — one-shot pre-ship verification

> Replaces /security-audit, /accessibility-audit, /audit-logs, secrets-policy. Reads `stack.md`'s `compliance:` flags and runs only the relevant checks. Produces one report, overwrites it next run.

## Inputs
- `AI_DOCS/memory/stack.md` — `compliance:` array drives which extra checks fire.
- `AI_DOCS/memory/project-context.md` — for the deployment-target (decides a11y check method).
- `AI_DOCS/architecture/api-contract.md` — endpoint list (sensitive endpoints get audit-log verification).
- The codebase.

## Checks (in order)

### 1. Secrets scan (always)
Grep the working tree (excluding `.git`, `node_modules`, `.next`, `dist`, `build`, `__pycache__`, `.venv`):

| Pattern | Severity |
|---------|----------|
| `(?i)api[_-]?key\s*[=:]\s*['"][A-Za-z0-9_\-]{16,}['"]` | FAIL |
| `(?i)secret\s*[=:]\s*['"][A-Za-z0-9_\-]{16,}['"]` | FAIL |
| `(?i)password\s*[=:]\s*['"][^'"]{6,}['"]` | FAIL (allowlist test fixtures) |
| AWS access-key pattern `AKIA[0-9A-Z]{16}` | FAIL |
| `(?i)bearer\s+[A-Za-z0-9_\-\.]{20,}` | CONCERNS |
| Private key headers (`-----BEGIN .* PRIVATE KEY-----`) | FAIL |

Secret patterns and the scan scope, test allowlist and hard-fail vs concern tiers are defined in `rules/secrets-patterns.md` (Compliance controls section).

The secrets scan includes `.mcp.json`. Any credential in it MUST be a `${ENV_VAR}` reference. A literal token/key/connection string in `.mcp.json` is a FAIL (per `mcp-rules.md` Rule 5).

### 1b. MCP config integrity (when `.mcp.json` exists)
- Every Gated (credentialed) server in `.mcp.json` has a `${ENV_VAR}` for its secret, never a literal → else FAIL.
- The `.mcp.json` server list matches the `## MCP Servers` table in `stack.md` → else CONCERNS (drift).
- No `filesystem`/`git` MCP added without record of an explicit user request → CONCERNS.

### 2. Dependency CVEs (always)
- Node: `pnpm audit --prod --json` (fall back to `npm audit`)
- Python: `pip-audit` if available, else `pip list --outdated`
- Severity: high or critical → FAIL. Moderate → CONCERNS.

### 3. Accessibility (web projects only)
- If Playwright is installed: `npx playwright test --grep @a11y` with axe-core integration.
- Else: static grep checks: `<img>` without `alt`, `<button>` with no text content, missing `aria-label` on icon buttons, color-only state indicators (best-effort).
- Critical violations → FAIL. Serious → CONCERNS.

### 4. OWASP Top-10 grep (compliance projects only)
Trigger when `stack.md`'s `compliance:` is non-empty (any declared regime implies the app-security baseline: `hipaa|soc2|gdpr|ccpa|pci|pci-dss|iso-27001|fedramp|nis2|lgpd|pipeda|dpdp|au-privacy|coppa|glba|ferpa|fda`). Per the conditional-loading discipline (`rules/compliance/README.md`), load only the declared regime checklist(s) plus this OWASP baseline, never the whole folder.

| Pattern | Concern |
|---------|---------|
| `eval\(`, `Function\(` (excluding test files) | Code injection |
| Raw SQL string concatenation in queries | SQL injection |
| Unsanitized HTML rendering (`dangerouslySetInnerHTML`, `v-html`, `innerHTML =`) | XSS |
| `cors\(` with `origin: ['"]?\*['"]?` | CORS misconfig |
| Auth-checking middleware referenced but no test file | Auth gap |
| Cookies set without `HttpOnly` and `Secure` | Session hijack risk |
| Missing rate-limit middleware on auth/billing endpoints | Brute force |

### 5. Audit-log path verification (always — baseline standard)
Per `docs/audit-log-standard.md`, every project carries a baseline audit trail, not only compliance ones. For each endpoint in `api-contract.md` flagged `auth` (i.e., not `public`) that is sensitive (auth, payment, export, admin, PII access):
- Grep the handler file for an audit-log call (`auditLog\(|logger\.audit\(|AuditLog\.create|audit_event\(|@audited`).
- Missing on a sensitive endpoint → CONCERNS (baseline, every project). For a declared compliance regime: CONCERNS for HIPAA/SOC2, FAIL for stricter regimes (pci/fedramp).

### 6. (Optional) Spawn `security-auditor` agent
For compliance projects, after the grep passes, dispatch the existing `agents/security-auditor.md` agent for a deeper LLM review of authn/authz, encryption-at-rest config, and PHI-handling paths. Aggregate its findings into the report.

### 7. SAST — static analysis beyond grep (always)
Run what is installed, flag what is missing. Tool availability is graded, not assumed:

- **Python code present** (`pyproject.toml` / `requirements.txt`): run `python3.12 -m bandit -r src/ -ll -q` (medium severity and up). HIGH finding → FAIL. MEDIUM → CONCERNS. bandit not installed → CONCERNS with the fix line (`python3.12 -m pip install bandit`).
- **TS/JS code present**: verify `eslint-plugin-security` is in devDependencies AND referenced by the ESLint config. Absent → CONCERNS ("run /guardrails to add it"). When present, its findings surface through the normal lint run, so no extra invocation here.
- **semgrep** (optional, macOS/Linux/CI only — no native Windows support): if `command -v semgrep`, run `semgrep --config p/owasp-top-ten --error --quiet`. ERROR-severity rule hit → FAIL, WARNING → CONCERNS. Not installed → skip silently, never penalize.

### 8. License deny-list + SBOM (always)
- **License deny-list**: scan PRODUCTION dependencies for `AGPL`, `SSPL`, `GPL-3.0` (copyleft incompatible with proprietary client delivery). Node: `npx license-checker --production --summary` (fallback `pnpm licenses list --prod`). Python: `pip-licenses` if installed, else skip with a note. Match → CONCERNS naming the package and license; FAIL when `stack.md` declares `license_policy: strict`. An approved exception must be in `decision-log.md` (then report it as noted, not flagged).
- **SBOM freshness** (production deploy targets only): an SBOM artifact must exist at `AI_DOCS/deployment/sbom-<version>.json`, generated by `/deployment-planning`. Missing or older than the current release version → CONCERNS.

### 9. Planning completeness + orphan-API check (always, when `AI_DOCS/planning/` exists)
Verifies the plan and the code did not drift apart. Skipped on `planning_depth: poc`.

- **Contract drift Phase A (BLOCKING):** a route handler in the code that is NOT in `api-contract.md` is a FAIL, not advisory ("contract drift: `<METHOD /path>` is built but absent from the locked api-contract. Add it via /change-request, or remove the route"). This is the same Phase A `drift-detector.sh` reports at session start (24h-rate-limited and advisory there); at `/audit` it blocks. An undocumented endpoint is an unreviewed, untested surface.
- **Orphan API:** read `AI_DOCS/planning/spec/21-traceability.md`. For every endpoint in `api-contract.md`, confirm it appears in the traceability matrix mapped to a screen OR tagged `backend-only`. An endpoint with neither → CONCERNS ("orphan API: built without a UI consumer or a backend-only tag").
- **Orphan screen:** any screen in `AI_DOCS/design/screens/` not referenced by the traceability matrix → CONCERNS.
- **Planning presence:** if the project is non-POC, confirm the Gate-1 planning artifacts exist (tech-spec S1-S23, `design/sitemap.md` + `navigation.md` for UI, `infra/infra-plan.md`). Missing → CONCERNS.
- **Stale markers:** any unresolved `<!-- STALE -->` marker in a planning artifact → CONCERNS ("planning doc out of sync; run /change-request").

### 10. Compliance requirements matrix (compliance projects only)
When `stack.md`'s `compliance:` is non-empty, write/refresh `AI_DOCS/planning/compliance-matrix.md`: one row per required control for each declared regime (load the checklist from `rules/compliance/<regime>.md`), mapped to the feature/endpoint that satisfies it and its status.

| Regime | Control | Where required | Satisfied by | Status |
|---|---|---|---|---|
| gdpr | data export endpoint | Art. 20 | GET /me/export | met |
| gdpr | data deletion | Art. 17 | DELETE /me | missing |
| soc2 | audit logs ≥1yr | CC7 | AuditLog + retention | partial |

Any `missing` control on a declared regime → FAIL. `partial` → CONCERNS. The matrix is re-validated at each milestone close (the gate reads it), so compliance is verified incrementally, not in a single end-of-project scramble.

### 11. Observability readiness (web/service projects heading to production)

A production app that cannot be observed cannot be operated. Per `docs/app-observability-standard.md`, grep the app code for the three minimums:
- **Error tracking:** `Sentry\.init`, `@sentry/`, or the configured tracker's `init(`. Absent → finding.
- **Health endpoint:** `/health`, `/healthz`, `healthCheck`, `actuator/health`. Absent → finding.
- **Structured logger:** `pino|winston|structlog|bunyan` present AND no `console\.log(` in app code (outside scripts/tests). A logger absent or `console.log` in app code → finding.

Missing any of the three on a non-POC project → CONCERNS, escalated to FAIL when a compliance regime is declared (regulated systems must be observable). POC projects are exempt. This check is advisory at a normal `/audit` and a HARD Gate 5 condition (see `gate-enforcement` Gate 5). Dashboard + alert wiring + retention are confirmed by `/operations` at go-live, not by grep.

### 12. Dependency hygiene — unused packages + processing location (always)

Installed = used. Unused = removed. This is `tech-stack-selection-rules.md` Rule 9 made mechanical (the per-task half lives in /build's dependency gate; this is the whole-tree scan):

- **Unused production dependencies:** Node: `npx knip` (fallback `npx depcheck`). Python: `deptry .` when available (else CONCERNS with the install line `python3.12 -m pip install deptry`). Go: `go mod tidy` then `git diff --exit-code go.mod go.sum`. An unused PRODUCTION dependency → CONCERNS, escalated to FAIL at `/ship` unless a `decision-log.md` exception names the package and the reason. Dev-only unused deps → note, never block.
- **Processing-location check (compliance projects):** for each dependency that processes user documents/data (parsers, OCR, transcription, AI/LLM SDKs, email/file processors), confirm an ADR records its processing location (in-region / self-hosted / external API) per Step 1.9's regime. A data-processing dependency that calls an EXTERNAL service on a gdpr/hipaa/dpdp project with no processing-location ADR → CONCERNS: regulated data may be leaving the region. Known-external signatures to grep: hosted OCR/parse APIs, cloud transcription SDKs, LLM SDKs pointing at non-approved hosts.
- **Runtime-fit note (deploy targets with a fixed base image):** a dependency with a native binary on a Lambda/container target must have its base-image requirement (glibc/musl version) recorded in the ADR. Absent → note in findings (the field failure: a parser binary needing glibc 2.36 on an Amazon Linux 2.34 base).

### 13. Deep security audit summary (always, when `AI_DOCS/audit/security-summary.md` exists)

Read the committed summary written by `deep-security-audit` (SK-169). Never read or copy its gitignored run directory into this report.

- Any open confirmed `critical` or `high` finding for the current HEAD scope → **FAIL**, listed by fingerprint, area and fix task.
- Open confirmed `medium`, or the last run is `incomplete` → **CONCERNS**.
- The summary's source ref is older than HEAD and its scope paths changed since → **CONCERNS (stale)**, and offer a re-run in the `deep-security-audit` offer format.
- No summary at all → not a finding. On a project heading to its first production release, add one line offering the `standard` profile run.
- `needs_validation` items are listed for the owner, never scored.

## Output: `AI_DOCS/audit/audit-report.md` + `AI_DOCS/quality/mavs/security.json`

**Machine report (MAVS, BLOCKING at milestone close):** in addition to the human report below, write `AI_DOCS/quality/mavs/security.json` per `docs/mavs-report-schema.md`. `status` = `PASS` when no FAIL-severity finding exists (secrets, high/critical CVEs, OWASP A0x, missing audit-log on a sensitive endpoint, or any `missing` compliance control), `FAIL` otherwise, `MISSING_TOOL` if a scanner is unavailable (never a silent PASS). For a compliance project this report reflects the `team-security` result (security-auditor + api-validator + code-reviewer), not the inline greps. Set `failed` = count of FAIL findings, stamp `source_commit = git rev-parse HEAD`, list findings. `hooks/mavs-gate.sh` blocks the milestone merge on a `security` FAIL or staleness.

**Human report:** `AI_DOCS/audit/audit-report.md`. Always overwrites previous report. Format:

```markdown
# Audit Report

**Date:** YYYY-MM-DD HH:MM
**Verdict:** PASS | CONCERNS | FAIL
**Compliance flags:** <hipaa, soc2, … | none>

## Summary
- Secrets: <PASS | N findings>
- Dependencies: <PASS | N high, M moderate>
- Accessibility: <PASS | N critical, M serious>
- OWASP grep: <PASS | N issues> (compliance only)
- Audit logs: <PASS | N missing> (baseline, all projects)
- SAST: <PASS | N high, M medium | tool missing: bandit/eslint-plugin-security>
- Licenses/SBOM: <PASS | deny-list: pkg (license) | SBOM missing>
- Deep review: <PASS | findings link> (compliance only)
- Planning sync: <PASS | N orphan APIs, M orphan screens, K stale markers> (non-POC only)
- Compliance matrix: <PASS | N missing, M partial> (compliance only)
- Dependency hygiene: <PASS | N unused prod deps, M unlocated processors | tool missing: knip/deptry>

## Findings

### [severity] <title>
**File:** `<path>:<line>`
**Pattern:** `<matched pattern>`
**Fix:** <one-line suggested remediation>

### …
```

## Verdict logic
- Any FAIL severity → **FAIL**.
- No FAIL but ≥1 CONCERNS → **CONCERNS** (ship may proceed with explicit /ask override).
- Otherwise → **PASS**.

## When to invoke
- Manually before `/ship`.
- Automatically by `/do` at milestone-close if `compliance:` is non-empty.
- After any task that touches auth, payment, PHI/PII, or data export.

## Boundaries
- Read-only on the codebase. Never edits source files (suggest fixes, don't apply them).
- Writes only to `AI_DOCS/audit/audit-report.md`.
- Does not commit or deploy.

## Verification (of /audit itself)
- `audit-report.md` exists after a run, with a verdict line.
- For a clean project: verdict = PASS in <60s.
- For a project with a known leaked key in test fixtures (allowlisted): verdict = PASS, key not flagged.
- For a project with a real `API_KEY=sk_live_...` in a non-test file: verdict = FAIL.

<!-- v2.10.0 (2026-10-22): Check 13 reads AI_DOCS/audit/security-summary.md from deep-security-audit (SK-169): open confirmed critical/high = FAIL, medium or incomplete run = CONCERNS, stale summary = CONCERNS plus a re-run offer. The gitignored run detail is never copied into this report. -->
<!-- v2.9.0 (2026-07-09): Execution-quality upgrade (PLAN-execution-quality Track B). Check 12 dependency hygiene: whole-tree unused-prod-dep scan (knip/depcheck, deptry, go mod tidy) CONCERNS→FAIL-at-ship, compliance processing-location check for data-processing SDKs (external-API parser on a gdpr project without an ADR = CONCERNS), native-binary base-image note for Lambda/container targets. Summary gains a Dependency hygiene line. -->
<!-- v2.8.0 (2026-06-29): Track E. Check 11 observability-readiness (error tracker + health route + structured logger per docs/app-observability-standard.md); CONCERNS non-POC, FAIL on compliance, HARD Gate 5 condition. v2.7.0: emit mavs/security.json. -->
<!-- v2.6.0 (2026-06-29): MAVS Wave 2 API. Contract drift Phase A (code route absent from the locked api-contract) is now a FAIL at /audit, not advisory. -->

<!-- Version: 2.10.1 | 2026-10-22 | repointed rule references after code-rules.md and compliance/secrets.md merges (v4.32.0) -->
