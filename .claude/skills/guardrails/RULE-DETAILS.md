# Guardrail Rule Details

> Extracted from [SKILL.md](SKILL.md) — Detailed rule definitions and implementation examples for all rule categories.

---

## 1. Security Rules (SEC-XXX)

### SEC-001: Input Validation

**Priority**: Critical  
**Applies To**: All API endpoints accepting user input

**Rule**: All user inputs MUST be validated using the project's validation library before processing.

**Implementation** ([Tech Stack Validation Library]):
```[language]
// Provide tech-stack-specific example
// e.g., if Zod: Use z.object() schema
// e.g., if Pydantic: Use BaseModel
// e.g., if Joi: Use Joi.object() schema
```

**Common Violations**:
- ❌ Direct use of `req.body` / `request.json()` without validation
- ❌ Manual validation with if statements instead of schema
- ❌ Trusting client-side validation only

**Testing**: Write unit tests validating edge cases (TEST-015)  
**Related Rules**: SEC-002 (Injection Prevention), QA-005 (Security Testing)

---

### SEC-002: SQL/NoSQL Injection Prevention

**Priority**: Critical  
**Applies To**: All database operations

**Rule**: Use parameterized queries or ORM methods ONLY. Never concatenate user input into queries.

**Implementation** ([Tech Stack ORM]):
```[language]
// Provide tech-stack-specific example
// e.g., if Prisma: Use prisma.user.findMany({ where: { ... } })
// e.g., if Mongoose: Use Model.find({ ... })
// e.g., if SQLAlchemy: Use session.query(User).filter(...)
```

**Common Violations**:
- ❌ String concatenation in queries: `SELECT * FROM users WHERE id = ${userId}`
- ❌ Template literals with user input: `db.query(\`SELECT * FROM ...\`)`

**Testing**: SQL injection test cases (TEST-020)  
**Related Rules**: SEC-001 (Input Validation), PERF-001 (Query Optimization)

---

[Continue with all security rules: SEC-003 to SEC-012]
- SEC-003: No Hardcoded Secrets (Must use AWS Secrets Manager / HashiCorp Vault for Production/Enterprise)
- SEC-004: HTTPS/TLS Enforcement
- SEC-005: Authentication & Authorization
- SEC-006: CSRF Protection
- SEC-007: XSS Prevention
- SEC-008: Rate Limiting
- SEC-009: CORS Configuration
- SEC-010: Secure Headers
- SEC-011: SSRF Prevention — Validate and allowlist all backend-to-backend/external HTTP calls
- SEC-012: Pseudorandom Number Generator — NEVER use `Math.random()` for security-sensitive values (tokens, session IDs, CSRF nonces, invite codes).
  - **Backend (Node.js)**: Use `crypto.randomUUID()` or `crypto.getRandomValues()`.
  - **Frontend / Next.js**: Use the `uuid` npm package (`import { v4 as uuidv4 } from 'uuid'`). Avoid direct `crypto` usage in client-side/edge contexts.

---

## 2. Caching Strategy (CACHE-XXX)

### CACHE-001: Cache Layer Setup

**Priority**: High  
**Applies To**: API responses, database queries, static assets

**Rule**: Implement caching for frequently accessed data using [Tech Stack Caching Layer].

**Implementation** ([Tech Stack Cache]):
```[language]
// Provide tech-stack-specific example
// e.g., if Redis: Use redis.set(key, value, 'EX', ttl)
// e.g., if Memcached: Use client.set(key, value, ttl)
// e.g., if In-Memory: Use Map() with TTL wrapper
```

**Cache Key Naming Convention**:
```
[entity]:[identifier]:[version]
Examples:
- user:123:v1
- product:456:v2
- session:abc-def:v1
```

**Testing**: Cache hit/miss tests (TEST-025)  
**Related Rules**: CACHE-002 (TTL Strategy), PERF-005 (Response Time)

---

### CACHE-002: Cache Invalidation & TTL

**Priority**: High  
**Applies To**: All cached data

**Rule**: Set appropriate TTL on ALL cache entries. Implement invalidation on data mutations.

**TTL Guidelines**:
| Data Type | TTL | Invalidation Trigger |
|-----------|-----|----------------------|
| User session | 24 hours | Logout, password change |
| Static data (configs) | 1 hour | Admin update |
| Dynamic data (user profile) | 5 minutes | User update |
| API responses | 30 seconds | Underlying data change |

**Implementation**:
```[language]
// Provide invalidation pattern for tech stack
```

**Related Rules**: CACHE-001 (Setup), PERF-010 (Stale Data Prevention)

---

[Continue with caching rules: CACHE-003 to CACHE-010]
- CACHE-003: Cache-Aside Pattern
- CACHE-004: Cache Stampede Prevention
- CACHE-005: Cache Warming Strategy
- CACHE-006: Distributed Cache Consistency
- CACHE-007: Cache Monitoring
- CACHE-008: Cache Eviction Policy
- CACHE-009: Read-Through vs Write-Through
- CACHE-010: CDN Caching (Frontend Assets)

---

## 3. Permission & RBAC (PERM-XXX)

### PERM-001: RBAC Implementation

**Priority**: Critical  
**Applies To**: All authenticated routes and actions

**Rule**: Implement role-based access control with permission middleware/guards.

**Implementation** ([Tech Stack Auth]):
```[language]
// Provide tech-stack-specific RBAC example
// e.g., if Express: Middleware function checkPermission(permission)
// e.g., if Next.js: Server action with permission check
// e.g., if FastAPI: Dependency with Depends(require_permission)
```

**Permission Naming Convention**:
```
[resource].[action]
Examples:
- user.read
- user.write
- project.delete
- admin.manage
```

**Testing**: Permission boundary tests (TEST-030)  
**Related Rules**: PERM-002 (Frontend Guards), SEC-005 (Authentication)

---

### PERM-002: Frontend Action Guards

**Priority**: Critical  
**Applies To**: All interactive UI elements (buttons, forms, links)

**Rule**: Wrap write/delete actions in permission guard components.

**Implementation** ([Tech Stack Frontend]):
```[language]
// Provide tech-stack-specific guard component
// e.g., if React: <PermissionGate permission="user.delete">...</PermissionGate>
// e.g., if Vue: v-if="hasPermission('user.delete')"
```

**Common Violations**:
- ❌ Showing delete button to all users
- ❌ Relying only on backend permission (UX issue)

**Related Rules**: PERM-001 (Backend RBAC), QA-015 (Access Control Testing)

---

[Continue with permission rules: PERM-003 to PERM-010]
- PERM-003: Resource Ownership Validation
- PERM-004: Permission Hierarchy
- PERM-005: Role Assignment
- PERM-006: Permission Caching
- PERM-007: Audit Logging for Permission Changes
- PERM-008: Dynamic Permission Loading
- PERM-009: Permission-Based Menu Filtering
- PERM-010: Multi-Tenancy Isolation

---

## 4. Performance Optimization (PERF-XXX)

### PERF-001: Database Query Optimization

**Priority**: High  
**Applies To**: All database queries

**Rule**: Create indexes on frequently queried fields. Analyze and optimize N+1 queries.

**Implementation** ([Tech Stack Database]):
```[language]
// Provide index creation example
// e.g., if Prisma: @@index([email, status])
// e.g., if MongoDB: db.users.createIndex({ email: 1, status: 1 })
```

**Index Guidelines**:
- Foreign keys
- Frequently filtered fields (WHERE clauses)
- Frequently sorted fields (ORDER BY)
- Unique constraints

**Testing**: Query performance tests with EXPLAIN (TEST-035)  
**Related Rules**: PERF-002 (Connection Pooling), CACHE-001 (Query Caching)

---

[Continue with performance rules: PERF-002 to PERF-020]
- PERF-002: Connection Pooling
- PERF-003: Async/Await Best Practices
- PERF-004: Lazy Loading
- PERF-005: Response Compression
- PERF-006: Image Optimization
- PERF-007: Code Splitting (Frontend)
- PERF-008: Bundle Size Optimization
- PERF-009: Server-Side Rendering (if applicable)
- PERF-010: Pagination Implementation
- PERF-011: Debouncing/Throttling
- PERF-012: Background Job Processing
- PERF-013: Database Transaction Management
- PERF-014: Memory Leak Prevention
- PERF-015: API Response Pagination
- PERF-016: Static Asset Optimization
- PERF-017: Preloading Critical Resources
- PERF-018: Web Vitals Optimization (LCP, FID, CLS)
- PERF-019: Tree Shaking
- PERF-020: Lazy Component Loading

---

## 5. Code Quality & Best Practices (QUAL-XXX)

### QUAL-001: Linting Configuration

**Priority**: Medium  
**Applies To**: All code files

**Rule**: Configure and enforce linting rules for the project's language.

**Implementation** ([Tech Stack Linter]):
```[language]
// Provide linter config example
// e.g., if ESLint: .eslintrc.json with recommended rules
// e.g., if Pylint: .pylintrc with PEP 8
```

**Required Rules**:
- No unused variables
- No console.log in production
- Consistent code formatting
- Import order

**Testing**: Lint checks in CI/CD pipeline  
**Related Rules**: QUAL-002 (Code Formatting), QA-001 (Code Review)

---

[Continue with quality rules: QUAL-002 to QUAL-020]
- QUAL-002: Code Formatting (Prettier, Black, etc.)
- QUAL-003: Naming Conventions (PascalCase for components/classes, camelCase for functions/variables, SCREAMING_SNAKE_CASE for constants)
- QUAL-004: File Organization (co-locate tests with source, index barrel files per feature folder)
- QUAL-005: Function Length Limit (40 lines max per function)
- QUAL-006: Cyclomatic Complexity < 10
- QUAL-007: No Magic Numbers (use named constants)
- QUAL-008: DRY Principle (shared logic must be extracted into lib/utils)
- QUAL-009: SOLID Principles
- QUAL-010: Error Handling Patterns (structured error classes, never swallow errors)
- QUAL-011: No Dead Code (remove unused variables, functions, imports, types)
- QUAL-012: **Strict Typing Check** (MANDATORY)
  - ❌ NEVER use `any` type (or `typing.Any` in Python) in any condition
  - ✅ Use `unknown` + type guards for TS. Use specific unions/generics for others.
  - ✅ Update interface definitions and check backend/shared types if needed
  - ✅ For third-party libs without types, create a declaration file or wrapper
- QUAL-013: **No `console.log` in Production Code** (MANDATORY)
  - ❌ NEVER use `console.log`, `print()`, `console.warn` directly in production code
  - ✅ Use the project's structured logger (e.g., `logger.info()`, `logger.error()`)
  - ✅ Raw prints/logs are only permitted in one-time seed scripts or CLI tools
- QUAL-014: **No Business Logic in Controllers or Route Handlers** (MANDATORY)
  - ❌ NEVER put complex business logic directly in API routes, Express handlers, FastAPI endpoints, or Spring controllers
  - ✅ Controllers must only: validate input → call service → return response
  - ✅ All business logic must live in a dedicated Service layer (`services/`, `use_cases/`)
  - ✅ All direct database access must live in a Repository layer (`repositories/`, `data_access/`)
- QUAL-015: Comment Standards (JSDoc for public APIs, inline comments for non-obvious logic)
- QUAL-016: API Documentation (OpenAPI/Swagger for all routes)
- QUAL-017: Dependency Management (audit on install, no deprecated packages)
- QUAL-018: Remove unused imports and variables before committing
- QUAL-019: No direct DB access from route handlers (Repository pattern required)
- QUAL-020: All async functions must have explicit error handling (try/catch or `.catch()`)

---

## 5.5 UI Consistency Rules (UI-CON-XXX)

> **Applies To**: All frontend components in Next.js/React apps.
> These rules are NON-NEGOTIABLE for Production-Grade projects.

### UI-CON-001: Mandatory Field Markers
**Priority**: High
**Rule**: All required form fields MUST display a red asterisk `*` after the label.
```tsx
// ✅ GOOD
<label>Email Address <span className="text-red-500">*</span></label>
// ❌ BAD
<label>Email Address</label>
```

### UI-CON-002: Input Icon Placement
**Priority**: Medium
**Rule**: All text/number input fields that have an associated icon MUST place the icon on the **left side** inside the input.
```tsx
// ✅ GOOD - Icon on left
<div className="relative">
  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2" />
  <input className="pl-10" ... />
</div>
```

### UI-CON-003: Standard Spacing Tokens
**Priority**: High
**Rule**: Use standardized spacing. Do NOT use arbitrary padding/margin values.
| Token | Value | Usage |
|-------|-------|-------|
| `padding-card` | 16px (`p-4`) | Card, panel padding |
| `gap-section` | 12px (`gap-3`) | Gap between form fields / list items |
| `margin-section` | 12px (`mb-3`) | Margin between form sections |
| `padding-button` | `px-4 py-2` | Standard button padding |

### UI-CON-004: Component & File Naming
**Priority**: Medium
**Rule**: All framework component files MUST follow the standard convention for that framework (e.g., PascalCase for React/Next.js/Angular, kebab-case for Vue). All utility/hook files MUST use camelCase or snake_case depending on the ecosystem.
```
// React/Next.js Example
✅ components/UserCard.tsx
✅ hooks/useUserData.ts

// Vue/Angular Example
✅ components/user-card.vue
✅ utils/format-date.ts
```

### UI-CON-005: Lazy Loading for Non-Critical Components
**Priority**: High
**Rule**: All page-level components and non-critical UI blocks MUST use the framework's native lazy loading capability block (e.g., React `lazy()`, Next.js `dynamic()`, Vue `defineAsyncComponent`, Angular lazy routes).
```
// General Principle
✅ Wait to load heavy charts, modals, or below-the-fold content until requested or scrolled.
❌ Do not statically import massive components on the initial page load.
```

---

## 6. Observability & Monitoring (OBS-XXX)

### OBS-001: Structured Logging

**Priority**: High  
**Applies To**: All application logs

**Rule**: Use structured logging with JSON format and contextual metadata.

**Implementation** ([Tech Stack Logger]):
```[language]
// Provide structured logging example
// e.g., if Winston: logger.info('User created', { userId, email, timestamp })
// e.g., if Pino: log.info({ userId, email }, 'User created')
```

**Required Fields**:
- Timestamp (ISO 8601)
- Log level (info, warn, error)
- Message
- Context (userId, requestId, etc.)
- Stack trace (for errors)

**Common Violations**:
- ❌ console.log() in production
- ❌ String concatenation in logs

**Testing**: Log output validation tests  
**Related Rules**: OBS-002 (Error Tracking), QA-010 (Debugging)

---

[Continue with observability rules: OBS-002 to OBS-010]
- OBS-002: Error Tracking & Reporting
- OBS-003: Performance Monitoring (APM)
- OBS-004: Health Check Endpoints
- OBS-005: Metrics Collection
- OBS-006: Distributed Tracing
- OBS-007: Log Aggregation
- OBS-008: Alert Configuration
- OBS-009: Dashboard Setup
- OBS-010: Audit Trail Logging

---

## 7. Testing Requirements (TEST-XXX)

### TEST-001: Unit Test Coverage

**Priority**: High  
**Applies To**: All business logic functions

**Rule**: Maintain minimum 98% unit test coverage on lines, branches, and functions (functions where the toolchain measures them, per `testing-rules.md` Rule 7a). Test all branches (if/else/catch) and ensure every function is exercised.

**Implementation** ([Tech Stack Test Framework]):
```[language]
// Provide unit test example
// e.g., if Jest: describe(), it(), expect()
// e.g., if pytest: def test_*, assert
```

**Coverage Requirements**:
| Project Type | Min Coverage |
|--------------|--------------|
| POC | Not required |
| MVP | 60% |
| Production | 80% |
| Enterprise | 90% |

**Testing**: Run coverage report in CI/CD  
**Related Rules**: TEST-002 (Integration Tests), QA-005 (Test Strategy)

---

[Continue with testing rules: TEST-002 to TEST-020]
- TEST-002: Integration Test Patterns
- TEST-003: E2E Test Setup
- TEST-004: Test Data Management
- TEST-005: Mocking Strategies
- TEST-006: Test Isolation
- TEST-007: Test Naming Conventions
- TEST-008: AAA Pattern (Arrange-Act-Assert)
- TEST-009: Test Performance (< 1s per unit test)
- TEST-010: Regression Test Suite
- TEST-011: API Contract Testing
- TEST-012: Database Transaction Rollback in Tests
- TEST-013: Snapshot Testing (UI components)
- TEST-014: Visual Regression Testing
- TEST-015: Input Validation Tests
- TEST-016: Error Scenario Tests
- TEST-017: Security Test Cases
- TEST-018: Load Testing
- TEST-019: Accessibility Testing
- TEST-020: SQL Injection Test Cases

---

## 8. QA Standards (QA-XXX)

### QA-001: Code Review Checklist

**Priority**: High  
**Applies To**: All pull requests

**Rule**: Every PR must be reviewed against this checklist before merging.

**Checklist**:
- [ ] All tests passing (TEST-001)
- [ ] No linting errors (QUAL-001)
- [ ] Security rules followed (SEC-XXX)
- [ ] Performance considerations addressed (PERF-XXX)
- [ ] Permissions implemented (PERM-XXX)
- [ ] Logging added for key actions (OBS-001)
- [ ] Documentation updated
- [ ] No hardcoded secrets (SEC-003)
- [ ] Cache invalidation considered (CACHE-002)

**Related Rules**: QA-002 (Defect Severity), QA-005 (Acceptance Criteria)

---

[Continue with QA rules: QA-002 to QA-015]
- QA-002: Defect Severity Matrix
- QA-003: Pre-Deployment Checklist
- QA-004: Acceptance Criteria Format (Given-When-Then)
- QA-005: Test Strategy Documentation
- QA-006: Regression Testing Requirements
- QA-007: User Acceptance Testing (UAT)
- QA-008: Release Sign-Off Process
- QA-009: Hotfix Process
- QA-010: Debugging Guidelines
- QA-011: Error Reproduction Steps
- QA-012: Environment Parity (Dev/Staging/Prod)
- QA-013: Data Migration Testing
- QA-014: Rollback Procedures
- QA-015: Access Control Testing

---

## 9. Compliance Standards (COMP-XXX)

### COMP-001: PII Data Protection

**Priority**: Critical
**Applies To**: All data schemas and storage

**Rule**: Personally Identifiable Information (PII) must be encrypted at rest and in transit.

**Implementation**:
```[language]
// Tech stack specific encryption
// e.g., Mongoose field encryption
// e.g., Column-level encryption in PostgreSQL
```

**Related Rules**: SEC-004 (HTTPS), SEC-002 (Encryption)

---

### COMP-002: Audit Logging (SOC2)

**Priority**: Critical
**Applies To**: All write/delete operations

**Rule**: All state-changing operations must produce an immutable audit log entry.

**Testing**: Verify audit record creation (TEST-040)

---

## Cross-References & Integration

**Security ↔ Testing**:
- SEC-001 (Input Validation) → TEST-015 (Input Validation Tests)
- SEC-002 (Injection Prevention) → TEST-020 (Injection Test Cases)

**Caching ↔ Performance**:
- CACHE-001 (Cache Setup) → PERF-005 (Response Time)
- CACHE-002 (TTL Strategy) → PERF-010 (Stale Data Prevention)

**Permissions ↔ QA**:
- PERM-001 (RBAC Implementation) → QA-015 (Access Control Testing)
- PERM-002 (Frontend Guards) → TEST-030 (Permission Boundary Tests)

**Performance ↔ Observability**:
- PERF-001 (Query Optimization) → OBS-003 (Performance Monitoring)
- PERF-008 (Bundle Size) → OBS-005 (Metrics Collection)
