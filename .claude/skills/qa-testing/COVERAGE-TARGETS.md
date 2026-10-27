# QA Coverage Targets, Project-Type Matrices & Automation Examples

> Extracted from [SKILL.md](SKILL.md) — detailed testing standards, defect management templates, and test automation examples.

> [!IMPORTANT]
> **Coverage means lines AND branches AND functions** (testing-rules Rule 7a). The floor is a flat minimum 98% on all three for EVERY project type including POC, measured on code touched in the current milestone and configured as failing thresholds (`coverageThreshold: { statements: 98, branches: 98, functions: 98, lines: 98 }` for Jest/Vitest, `--cov-branch --cov-fail-under=98` plus the function-coverage helper for pytest, the `-func` total plus per-function check for Go). A module that meets the line number with untested error branches or uncalled functions does not pass Gate 4C.

---

## Testing Standards by Project Type

> [!NOTE]
> **Testing depth adapts based on project type.**

### POC (Proof of Concept)

**Testing Approach**: Automated unit tests to the framework floor, plus manual exploratory

| Test Type | Coverage | Approach |
|-----------|----------|----------|
| **Unit Tests** | 98%+ (lines, branches, functions) | Automated (Jest, pytest) |
| **Functional** | Happy path plus critical negatives | Manual exploratory + automated |
| **Security** | Basic (no sensitive data) | Manual review |
| **Performance** | Skip | N/A |

**Exit Criteria**:
- ✅ 98%+ unit test coverage (lines, branches, functions)
- ✅ Core functionality works
- ✅ No blockers

---

### MVP (Minimum Viable Product)

**Testing Approach**: Mix of manual and automated

| Test Type | Coverage | Approach |
|-----------|----------|----------|
| **Unit Tests** | 98%+ (lines, branches, functions) | Automated (Jest, pytest) |
| **Integration Tests** | Critical APIs | Automated (Supertest) |
| **E2E Tests** | Critical flows | Automated (Playwright, Cypress) |
| **Security** | Basic | Automated (Snyk dependency scan) |
| **Performance** | Basic load test | Manual or k6 |

**Exit Criteria**:
- ✅ 98%+ unit test coverage (lines, branches, functions)
- ✅ Critical APIs tested
- ✅ Critical user flows pass E2E tests
- ✅ Zero critical/blocker defects
- ✅ 95% uptime SLA validated

---

### Production-Grade

**Testing Approach**: Comprehensive automated testing

**Standard Production**:

| Test Type | Coverage | Approach |
|-----------|----------|----------|
| **Unit Tests** | 98%+ (lines, branches, functions) | Automated (Jest, pytest, JUnit) |
| **Integration Tests** | 100% APIs | Automated (Supertest, TestContainers) |
| **E2E Tests** | Top 20 flows | Automated (Playwright, Cypress) |
| **Load Tests** | NFR targets | Automated (k6, Artillery) |
| **Security Tests** | All vulnerabilities | Automated (OWASP ZAP, Snyk, pen test) |

**Exit Criteria**:
- ✅ 98%+ unit test coverage (lines, branches, functions)
- ✅ 100% API integration test coverage
- ✅ Top 20 user flows pass E2E tests
- ✅ Zero critical/blocker defects
- ✅ Load testing passes at 2x expected load
- ✅ Zero critical/high security vulnerabilities
- ✅ 99.5% uptime SLA validated

---

**Enterprise Production** (includes all Standard + additional):

| Test Type | Coverage | Approach |
|-----------|----------|----------|
| **Unit Tests** | 98%+ (lines, branches, functions) | Automated |
| **Chaos Engineering** | Failure scenarios | Automated (Chaos Monkey, Gremlin) |
| **Compliance Tests** | SOC 2, HIPAA, GDPR | Manual + Automated |
| **Disaster Recovery** | RTO/RPO validation | Manual drills |

**Exit Criteria** (includes all Standard + additional):
- ✅ 98%+ unit test coverage (lines, branches, functions)
- ✅ Chaos engineering tests pass (system resilient to failures)
- ✅ Compliance requirements met (SOC 2, HIPAA, etc.)
- ✅ Disaster recovery tested (RTO < 4hrs, RPO < 1hr)
- ✅ 99.9%+ uptime SLA validated

---

## Defect Management

### Defect Severity Classification

> **STRICT ADHERENCE**: Refer to `AI_DOCS/project-guardrails.md` (Rule QA-002) for the authoritative Defect Severity Matrix.

**Summary**:
- **Critical/Blocker**: System unstable, data loss, security hole. (FIX IMMEDIATE)
- **Major**: Feature broken, no workaround. (FIX BEFORE RELEASE)
- **Minor/Trivial**: Cosmetic, workaround exists. (DEFERRABLE)

### Defect Logging Template

```markdown
## Defect ID: DEF-001
- **Severity**: Critical
- **Priority**: P0
- **FR ID**: FR-AUTH-001 (User Login)
- **Test Case ID**: TC-AUTH-001
- **Environment**: QA (staging)

### Description
User cannot login with valid credentials.

### Steps to Reproduce
1. Navigate to /login
2. Enter valid email: user@example.com
3. Enter valid password: SecurePass123!
4. Click "Login" button

### Expected Result
User should be redirected to /dashboard.

### Actual Result
Errorpage "500 Internal Server Error" displayed.

### Attachments
- Screenshot: error-screenshot.png
- Console logs: console-error.txt
- Network logs: network-trace.har

### Additional Context
- Occurs 100% of the time
- Affects all users
- Regression introduced in commit abc123
```

---

## Test Automation Requirements

### Test Automation Framework (Node.js 22.x Compatible)

> **STRICT ADHERENCE**: Refer to `AI_DOCS/project-guardrails.md` (Section 7: Testing Requirements) for the project-specific test stack and configuration.

**Standard Requirements (TEST-XXX)**:
- Unit Testing (e.g., Jest/Pytest)
- E2E Testing (e.g., Playwright/Selenium)
- API Testing (e.g., Supertest/Requests)
- Security Scanning (e.g., OWASP ZAP)

### Test Code Quality Standards

**All test code must:**
- ✅ Follow AAA pattern (Arrange-Act-Assert)
- ✅ Have descriptive test names
- ✅ Be independent (no test dependencies)
- ✅ Be repeatable (same result every time)
- ✅ Be fast (unit tests < 1s, integration < 10s, E2E < 60s)

**Example (AAA Pattern)**:
```typescript
describe('UserService', () => {
  it('should create user with valid data', async () => {
    // Arrange
    const userData = {
      email: 'test@example.com',
      name: 'Test User',
      role: 'USER',
    };
    const mockRepository = {
      create: jest.fn().mockResolvedValue({ id: '123', ...userData }),
    };
    const userService = new UserService(mockRepository);

    // Act
    const result = await userService.createUser(userData);

    // Assert
    expect(result).toEqual({ id: '123', ...userData });
    expect(mockRepository.create).toHaveBeenCalledWith(userData);
  });
});
```
