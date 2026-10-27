---
name: deep-security-audit
skill_id: SK-169
version: 1.1.0
effort: xhigh
description: "Deep, evidence-led security audit of a codebase using the vendored Cloudflare security-audit workflow: reconnaissance, coverage ledger, isolated hunters, adversarial verification, validated findings.json, target-neutral reports. Source-only (never runs target code). Offered, never forced, at branch merges, auth/payment/tenant features, milestone close and first production release. Feeds /audit check 13."
allowed-tools: "Read Grep Glob Bash Write Agent"
context_budget:
  load_kb: 60
  scope: global
dependencies:
  required: []
  optional: [audit, team-security, assessment-package, change-request]
license: Proprietary
compatibility: "Claude Code 2.x"
outputs_to: AI_DOCS/audit/security-summary.md
metadata:
  author: WebOsmotic Private Limited
  category: quality
  user_facing: false
  upstream: vendor/cloudflare-security-audit (MIT, pinned in UPSTREAM.md)
---

# /deep-security-audit: the deep audit behind /audit

`/audit` is the fast pre-ship gate (secrets, CVEs, OWASP greps, a11y). This skill is the deep audit: it finds real trust-boundary failures, proves each one from source, and has a different agent try to disprove it before it counts. It wraps the Cloudflare workflow in `vendor/cloudflare-security-audit/upstream/` and adds the ADF overlay below. Where the overlay and upstream disagree, the overlay wins. Everywhere else, upstream is the contract.

## When it runs

1. **Explicit request**, routed by `/do`: "security audit", "deep security review", "pen test the code", "find vulnerabilities", "full security review".
2. **Offer points.** The calling skill asks the operator and runs this skill only on a yes:

   | Trigger | Caller | Profile offered |
   |---|---|---|
   | Before merging a branch (feature to milestone, milestone to develop, develop to staging or main) | `github-ops` | `quick`, scoped to the merge diff |
   | A task or feature touching a sensitive area is stamped DONE | `do` Phase 1 | `quick`, scoped to that feature's paths |
   | Milestone close when the milestone diff touches a sensitive area | `do` milestone close | `quick` |
   | First production release (no earlier `Shipped to` production entry in `decision-log.md`) | `ship`, `deployment-planning` | `standard` |
   | Client security assessment engagement | `assessment-package` | `standard` or `deep`, by engagement scope |

   **Sensitive area:** any changed path or symbol matching `auth|login|logout|session|jwt|oauth|sso|saml|password|passwd|mfa|otp|token|permission|rbac|role|acl|policy|tenant|org_id|workspace|payment|billing|checkout|invoice|stripe|razorpay|paypal|webhook|upload|export|admin|secret|crypto|sign`, or a file listed in `AI_DOCS/security/authz-matrix.md`.

   **Offer format** (inline, one question):
   ```
   Security check: <trigger> touched <N> sensitive files (<top 3 paths>).
   Run a deep security audit now? Profile <quick|standard>, about <A> agent calls, scope <paths or whole repo>.
   [yes / no / later]
   ```
   Ask once per trigger per `git rev-parse HEAD`. Log the answer to `AI_DOCS/memory/decision-log.md` as `## Security audit offer <date>: <trigger>, <answer>, <HEAD short>`. Do not ask again when a `security-summary.md` already covers the current HEAD for that scope. A `no` never blocks the caller. Only open confirmed findings block (see /audit check 13).

## Operating modes

Upstream's two modes apply unchanged. **Guidance mode** (a security question, one suspicious function, triage of a reported finding) reads only the relevant upstream companion files and writes nothing. **Full audit mode** runs all six phases. Every trigger above is full audit mode.

## Setup (full audit mode)

1. Read `vendor/cloudflare-security-audit/upstream/SKILL.md` in full, then each phase file as you reach its phase (`RECONNAISSANCE.md`, `HUNTING.md`, `ATTACK-CLASSES.md`, `VALIDATION-AND-REPORTING.md`) and only the domain companions reconnaissance selects. Do not load all twelve companions up front.
2. **Output directory:** `AI_DOCS/.temp/security-audit/run-<N>/` (next unused N). Confirm it is ignored with `git check-ignore -q AI_DOCS/.temp/security-audit`. This is the operator's explicit in-repo selection that upstream requires. If it is not ignored, stop and add `AI_DOCS/.temp/` to `.gitignore` first.
3. Show the cost estimate from upstream's budget rules (reconnaissance, hunters per ledger unit, critics, verifiers) and the profile's default cap before launching the first agent: `quick` 25 agent calls, `standard` 70, `deep` only with an operator-set cap. The operator's yes to the offer covers a run inside the cap. Exceeding the cap needs a new yes.

## ADF overlay (overrides upstream)

### O1. Agent mapping and model policy

| Upstream role | ADF agent | Model | Why |
|---|---|---|---|
| Parent (coordination, ledger, findings.json, reports) | this session | session model | owns shared state and every judgment |
| Reconnaissance `research` agents (1a to 1d, focused) | `sec-hunter` | Sonnet | structured fact gathering |
| Hunters (`general`, every attack class) | `sec-hunter` | Sonnet | executes the hunter prompt over one ledger unit |
| Coverage critics | `sec-hunter` | Sonnet | gap scan against the ledger |
| Phase 3 candidate verifiers | `sec-verifier` | session model (Opus), or Fable on a yes | adversarial disproof decides what is real |
| Phase 5 record verifiers and replacement verifiers | `sec-verifier` | session model (Opus), or Fable on a yes | final source claims |

**Fable for verification (operator choice).** Before Phase 3, ask once: `Run the N verifiers on Fable (about 2.5x the Opus cost per verifier) or on Opus?` On yes, dispatch `sec-verifier` with `model: fable` at dispatch time. Never pin it in the agent file. If a Fable dispatch is refused or the account lacks Fable, re-dispatch the same prompt on Opus and record `verifier_model` per fingerprint in `run-metadata.json`. The `standard` and `deep` profiles default the question to Fable, `quick` defaults it to Opus.

Pass upstream's prompts verbatim (they are written to be copied). Independence rules hold: a verifier never sees the hunter's reasoning beyond the candidate record, and never verifies its own work.

### O2. Source-only execution

ADF provides no OS-enforced sandbox, so target-controlled code never runs: no builds, tests, fixtures, browsers or fuzzers of the audited project. `sec-hunter` and `sec-verifier` carry no Bash. Record `execution_policy: "sandboxed-source-and-local-only"` as upstream requires, plus `"adf_execution": "source-only"`. A candidate whose decisive fact needs runtime behaviour stays `needs_validation` with the blocker `adf_no_os_sandbox` and a safe local validation plan for the team.

### O3. Validators

Run them only through the wrapper, which picks the Windows overlay when needed:

```bash
bash .claude/skills/deep-security-audit/scripts/sec-validate.sh ledger   AI_DOCS/.temp/security-audit/run-N/coverage-ledger.json
bash .claude/skills/deep-security-audit/scripts/sec-validate.sh findings AI_DOCS/.temp/security-audit/run-N/findings.json
```

Record the printed `validator-mode` (`upstream` or `win32-overlay`) in `run-metadata.json` and state it in `REPORT.md`. Both validators passing is a terminal-state requirement, exactly as upstream says.

### O4. Reports stay out of git

`REPORT.md`, `FINDINGS-DETAIL.md`, `NEEDS-VALIDATION.md`, `findings.json` and the ledger live only in the gitignored run directory: they contain working exploit paths. Generated prose follows `rules/writing-style-rules.md` (no em-dash or en-dash, no semicolons in prose). The vendored upstream text is exempt as verbatim third-party content.

### O5. Committed summary: `AI_DOCS/audit/security-summary.md`

Overwrite after every run that reaches a terminal state. It is the only artifact other skills read:

```markdown
# Security summary
Run: run-<N> | Date: <YYYY-MM-DD> | Source ref: <HEAD short> (<clean|dirty>) | Profile: <quick|standard|deep> | Scope: <paths or whole repo>
Run status: <complete|incomplete: reason> | Validator mode: <upstream|win32-overlay> | Execution: source-only

| Severity | Open confirmed |
|---|---|
| critical | N |
| high | N |
| medium | N |
| low | N |
| informational | N |
Needs validation: N | Rejected: N | Coverage: <one line from REPORT.md, never "complete" for quick or scoped runs>

## Open confirmed findings
| Fingerprint | Severity | Area (file or module) | Invariant to enforce | Fix task |
|---|---|---|---|---|

Full detail: AI_DOCS/.temp/security-audit/run-<N>/ (local only, not committed)
```

The table names the area and the invariant, never the reproduction steps or payloads.

### O6. Fixes enter the normal flow

The audit never edits target source. For each confirmed finding: append a row to `AI_DOCS/quality/defect-log.md` (source `audit`), and when a milestone is active add a fix task to its `tasks.md` (critical and high as P0, medium P1, low as backlog) through `/do`. When the fix lands, the next run re-validates the fingerprint through upstream's prior-run rules and the summary row moves out of the open table.

### O7. Verdict for /audit (check 13)

- Any open confirmed `critical` or `high` for the current HEAD scope: **FAIL**.
- Open confirmed `medium`, or `run_status: incomplete`: **CONCERNS**.
- Otherwise **PASS**. `needs_validation` items are listed, never scored.
- A summary whose source ref is older than HEAD and whose scope was touched since: reported as stale, CONCERNS, with the offer to re-run.

### O8. Briefs travel as files, blocks by exact line range

Upstream asks the parent to paste the architecture summary, the selected attack-class blocks, the hunting method and the result contract into every hunter prompt. Pasting the same 5k to 10k tokens into each prompt is paid as parent output every time. Instead, write one shared brief to `run-<N>/hunter-common.md` that names each upstream block by file and exact line range and tells the agent to read those ranges verbatim. Then each dispatch prompt carries only the agent ID and a pointer to the brief. The agent still reads the exact upstream text, so the contract is unchanged. Re-check the line ranges after every pin bump. The same pattern serves verifiers (the candidate record goes in `run-<N>/candidates/<name>.json`) and the critic (it reads the ledger file).

Trial reference (2026-10-22, ADF `scripts/` and `hooks/`, about 65 files, `quick`): 13 agent calls (4 reconnaissance, 6 hunters, 1 critic, 2 verifiers), 2 needs-validation leads, both fixed the same day, one of them reproduced afterwards in a scratch fixture.

## Boundaries

- Read-only on target source. Writes only the run directory, `security-summary.md`, `defect-log.md` rows and fix tasks via `/do`.
- Never probes deployed endpoints, external services or production identities (upstream universal execution safety, unchanged).
- Never edits `vendor/cloudflare-security-audit/upstream/`. Pin bumps go through `scripts/sync-vendor.sh`.

## Verification (of this skill)

- `bash .claude/skills/deep-security-audit/scripts/sec-validate.sh selftest` reports 0 failures on every platform.
- A trial `quick` run on a small repo ends in a terminal state with both validators passing and a `security-summary.md` that contains no reproduction steps.

Skill deep-security-audit complete. Memory updated.
Checkpoint: AI_DOCS/audit/security-summary.md, AI_DOCS/quality/defect-log.md, safe to compact.

Handing off to: /audit (check 13) or the caller that offered the run

<!-- Version: 1.1.0 | 2026-10-22 | O1: verifiers may run on Fable when the operator says yes, passed at dispatch time with an Opus fallback (context-efficiency Rule 8) -->
<!-- Version: 1.0.0 | 2026-10-22 | new skill (ADF v4.29.0): wrapper over vendored cloudflare/security-audit-skill c1c8a8c, overlay O1 to O8 (agent and model mapping, source-only, win32 validator overlay, reports gitignored, committed summary, fix flow, /audit verdict), offer points -->
