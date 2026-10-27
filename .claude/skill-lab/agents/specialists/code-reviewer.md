# Agent Test Spec — code-reviewer

**Agent**: `code-reviewer`
**Tier**: specialists
**Agent path**: `.claude/agents/code-reviewer.md`
**Gate verdicts**: None (advisory findings — QA gate managed by qa-lead)
**maxTurns**: 10
**disallowedTools**: Bash, Edit, Write
**Spec date**: 2026-04-14
**Priority**: 2 — highest quality bar

---

## What This Agent Does

Reviews code against 6 rule categories (development, security, API contract, component registry, frontend, UI engineering). Produces a structured findings report with CRITICAL/HIGH/MEDIUM/LOW severity ratings. Read-only — never edits code.

## Assertions That Apply to All Test Cases

- [ ] Agent is READ-ONLY — never edits or writes files (disallowedTools: Bash, Edit, Write)
- [ ] Findings organized by severity: CRITICAL → HIGH → MEDIUM → LOW
- [ ] Each finding includes: file path, line number (or range), rule violated, specific fix suggestion
- [ ] CRITICAL and HIGH findings are explicitly labeled BLOCKING
- [ ] Agent does NOT make "judgement calls" outside documented rules — references rule files

---

## Test Case 1: Clean Code — All Checks Pass

**Context provided**:
```
Changed files: src/auth/login.service.ts, src/auth/login.controller.ts
Code follows all documented rules: no console.log, no any types, proper error handling, no hardcoded values
```

**Expected behavior**:
Agent reviews all changed files against 6 rule categories, finds no violations, outputs APPROVE with a clean report.

**Assertions**:
- [ ] Output contains `APPROVE` or `CLEAN — no findings`
- [ ] Each rule category checked is listed (even if PASS)
- [ ] Specific files reviewed are named
- [ ] No phantom findings — agent does not invent issues that don't exist

---

## Test Case 2: CRITICAL Finding — Hardcoded API Key

**Context provided**:
```
Changed file: src/integrations/stripe.service.ts
Code contains: const stripeKey = "sk_live_abc123...";
```

**Expected behavior**:
Agent finds hardcoded production API key, reports CRITICAL finding, marks as BLOCKING, stops further processing of lower-priority issues until this is noted.

**Assertions**:
- [ ] `CRITICAL` finding listed first
- [ ] Specific line identified: "stripe.service.ts line 12: hardcoded Stripe live key"
- [ ] Labeled `BLOCKING — must fix before merge`
- [ ] Fix suggestion: "Move to environment variable: process.env.STRIPE_SECRET_KEY"
- [ ] Agent does NOT edit the file to fix it

---

## Test Case 3: Multiple Severity Levels

**Context provided**:
```
Changed files across 3 modules.
Issues: 1 missing auth guard on endpoint, 2 console.log in production code, 1 TypeScript any type, 1 minor naming inconsistency
```

**Expected behavior**:
Agent produces a structured findings report with all issues categorized by severity.

**Assertions**:
- [ ] Missing auth guard → HIGH (security)
- [ ] console.log in production → MEDIUM (development rules)
- [ ] TypeScript any → MEDIUM (development rules)
- [ ] Naming inconsistency → LOW (style)
- [ ] Issues sorted HIGH → MEDIUM → LOW in output
- [ ] Summary counts: "1 HIGH, 2 MEDIUM, 1 LOW"

---

## Test Case 4: API Contract Drift

**Context provided**:
```
Changed file: src/users/users.controller.ts
New endpoint: GET /users/profile/:id
api-contract.md: GET /users/:id is the documented endpoint for user profiles
```

**Expected behavior**:
Agent detects API drift — implementation uses `/users/profile/:id` but contract says `/users/:id`. Reports HIGH finding.

**Assertions**:
- [ ] Finding categorized under "API Contract" rule category
- [ ] Severity: HIGH (API contract violations break clients)
- [ ] Specific mismatch described: "Endpoint path drift — implementation uses /users/profile/:id, contract specifies /users/:id"
- [ ] Recommendation: align with api-contract.md or update contract via /change-request
- [ ] Agent does NOT update api-contract.md (read-only)

---

## Test Case 5: No Files Changed (Empty Review)

**Context provided**:
```
Agent spawned but no changed files provided.
Or: only configuration files changed (jest.config.ts, .env.example)
```

**Expected behavior**:
Agent detects no reviewable code changes, produces a note rather than an empty findings report.

**Assertions**:
- [ ] Agent does NOT produce empty findings table
- [ ] Agent states: "No source code changes detected for review" OR "Only configuration files changed — no code review applicable"
- [ ] Agent does NOT APPROVE or REJECT when there is nothing to review
- [ ] Agent suggests what to provide if a review was intended
