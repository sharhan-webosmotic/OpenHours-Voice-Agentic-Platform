# Agent Test Spec — security-auditor

**Agent**: `security-auditor`
**Tier**: specialists
**Agent path**: `.claude/agents/security-auditor.md`
**Gate verdicts**: None (produces findings — gates managed by qa-lead / PHASE-GATE)
**maxTurns**: 20
**disallowedTools**: Edit, Write
**Spec date**: 2026-04-14
**Priority**: 2 — highest quality bar

---

## What This Agent Does

Performs OWASP Top 10 security audit, hardcoded secrets scan, auth implementation review, and dependency vulnerability check. Produces severity-classified findings (CRITICAL/HIGH/MEDIUM/LOW). Read-only except for reporting.

## Assertions That Apply to All Test Cases

- [ ] Agent checks OWASP Top 10 categories — not just the obvious ones
- [ ] Agent scans for hardcoded secrets/keys (pattern matching in code)
- [ ] CRITICAL findings explicitly labeled as BLOCKING any deployment
- [ ] Findings reference specific file paths and line numbers
- [ ] Agent does NOT write to source files (disallowedTools: Edit, Write)

---

## Test Case 1: Clean Codebase — No Findings

**Context provided**:
```
Auth implemented with JWT + refresh tokens, stored in httpOnly cookies
Input validation with Pydantic/Zod on all endpoints
No hardcoded credentials
Dependencies up to date (npm audit clean)
```

**Expected behavior**:
Agent scans OWASP categories, finds no findings, produces a clean report.

**Assertions**:
- [ ] Output contains `PASS — no security findings`
- [ ] Each OWASP category checked is listed (not just "reviewed the code")
- [ ] npm audit / dependency check result included
- [ ] Specific patterns checked named (e.g., "Checked for hardcoded API keys — CLEAN")

---

## Test Case 2: CRITICAL Finding — SQL Injection

**Context provided**:
```
Backend code: db.query(`SELECT * FROM users WHERE email = '${email}'`)
User-supplied email is not sanitized
```

**Expected behavior**:
Agent identifies SQL injection vulnerability, classifies as CRITICAL, marks as BLOCKING all deployment.

**Assertions**:
- [ ] `CRITICAL` on first findings line
- [ ] Specific file and line identified
- [ ] OWASP category named: "A03:2021 — Injection"
- [ ] Fix suggestion: "Use parameterized queries: db.query('SELECT * FROM users WHERE email = $1', [email])"
- [ ] BLOCKING label: "Must fix before any deployment"

---

## Test Case 3: Multiple Auth Vulnerabilities

**Context provided**:
```
JWT secret: "secret123" (weak)
No rate limiting on /auth/login endpoint
Refresh token stored in localStorage (not httpOnly cookie)
Password reset tokens never expire
```

**Expected behavior**:
Agent finds 4 auth-related issues across different severity levels, produces structured report.

**Assertions**:
- [ ] Weak JWT secret → CRITICAL (predictable, brute-forceable)
- [ ] No rate limiting on login → HIGH (brute force attack surface)
- [ ] Refresh token in localStorage → HIGH (XSS accessible)
- [ ] Non-expiring reset tokens → MEDIUM
- [ ] All 4 findings with specific fix recommendations
- [ ] OWASP A07:2021 (Identification and Authentication Failures) referenced

---

## Test Case 4: Dependency Vulnerability Found

**Context provided**:
```
npm audit output: lodash 4.17.15 — Prototype Pollution (HIGH severity)
jsonwebtoken 8.5.1 — Algorithm confusion vulnerability (CRITICAL)
```

**Expected behavior**:
Agent surfaces dependency vulnerabilities from npm audit output, classifies by severity, provides upgrade path.

**Assertions**:
- [ ] lodash vulnerability → HIGH finding
- [ ] jsonwebtoken vulnerability → CRITICAL finding
- [ ] BLOCKING label on CRITICAL dependency
- [ ] Specific versions to upgrade to recommended: "Upgrade jsonwebtoken to 9.0.0+"
- [ ] Agent does NOT run npm install (read-only)

---

## Test Case 5: False Positive Avoidance

**Context provided**:
```
Code contains: const API_KEY = process.env.STRIPE_KEY;
And: eval() is used inside a sandboxed worker with no user input
```

**Expected behavior**:
Agent correctly identifies these as NOT security issues — env var usage is correct, eval in isolated sandbox with no user input is acceptable.

**Assertions**:
- [ ] `process.env.STRIPE_KEY` NOT flagged as hardcoded secret
- [ ] `eval()` noted but classified as LOW (advisory) with context: "Sandboxed worker, no user input"
- [ ] Agent does NOT produce false positives for correct security patterns
- [ ] Note added: "Verified: API keys loaded from environment — COMPLIANT"
