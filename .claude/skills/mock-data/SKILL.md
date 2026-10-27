---
name: mock-data
description: "Generate realistic test data, seed data, and JSON fixtures with entity relationships. Use when creating mock data, seed data, test fixtures, or fake data for development. Also triggers on: 'Create mock data', 'Mock service', 'Multi-tenant data'."
next_skill: design-discovery
required_gate: Gate 1 (Tech Spec Approved)
skill_id: SK-011
allowed-tools: Read Write Edit Grep Glob Bash
context_budget:
  load_kb: 30
  scope: task
version: 1.4.2
dependencies:
  required: [tech-specification]
  optional: []
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---

> **Comments & docs:** Docstrings/JSDoc on every function. No inline comments except a one-line *why* for genuinely complex logic (calculations, time conversions, deliberate workarounds). No commented-out code. Put rationale, decisions, and feature context in `AI_DOCS/planning/` + `AI_DOCS/memory/decision-log.md` and keep it updated in the same change. Full policy: `.claude/rules/development-rules.md` -> Code Comments & Documentation.
# 🗃️ Mock Data Skill

> **Output**: JSON data files, mock services, entity relationships, seed scripts, and **Mock API Server integration**
> **Reference**: `mock-data/templates/mock-data-standards.md`

---

## 🚨 Initialization & Memory Logic
> [!NOTE]
> **Gated Approach**: Memory initialization handled by [session-management](../session-management/SKILL.md). Gate status checked before skill handoff.

---

## 1. Core Principle

> [!CRITICAL]
> **Mock data is created ONCE and REUSED everywhere.**
> Same entity appears identically across all screens.
> All data must be realistic, professional, and domain-appropriate.

**Data Quality Standards (NON-NEGOTIABLE)**:
- Use realistic names, emails, companies (e.g., "Sarah Chen", "sarah.chen@company.com")
- No placeholder values: no Lorem ipsum, Test User, john.doe@test.com, 12345
- No emojis in any generated data fields
- Numbers must be realistic for the domain (not 99999 or 1)
- Dates must be recent and plausible
- Status values must reflect real business states

```
`tech-spec.md` Section 7 → Entity Schema → Realistic JSON Data → Mock Services → Design → Seed → DB
                                             ↓
                                   SINGLE SOURCE OF TRUTH
```

---

## 2. Multi-Tenant Patterns

### Tenant Isolation Schema
```typescript
// Every entity MUST have organizationId for multi-tenant apps
interface BaseEntity {
  id: string;
  organizationId: string;  // Tenant isolation key
  createdAt: string;
  updatedAt: string;
}

interface User extends BaseEntity {
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'employee';
}

interface Project extends BaseEntity {
  name: string;
  ownerId: string;  // FK to User.id (same org)
}
```

### Multi-Tenant JSON Structure
```json
// mockdata/organizations.json
{
  "_meta": { "entity": "Organization", "frdRef": "FR-TENANT-001" },
  "data": [
    { "id": "ORG-001", "name": "Acme Corp", "slug": "acme", "plan": "enterprise" },
    { "id": "ORG-002", "name": "Beta Inc", "slug": "beta", "plan": "pro" }
  ]
}

// mockdata/users.json
{
  "_meta": { "entity": "User", "frdRef": "FR-USER-001" },
  "data": [
    { "id": "U001", "organizationId": "ORG-001", "name": "Sarah Chen", "role": "admin" },
    { "id": "U002", "organizationId": "ORG-001", "name": "Mike Lee", "role": "manager" },
    { "id": "U003", "organizationId": "ORG-002", "name": "Anna Brown", "role": "admin" }
  ]
}
```

---

## 3. Entity Relationship Matrix

### Define Relationships First
```markdown
| Parent Entity | Child Entity | Relationship | FK Field | Constraint |
|---------------|--------------|--------------|----------|------------|
| Organization | User | 1:N | organizationId | Same org |
| Organization | Project | 1:N | organizationId | Same org |
| User | Project | 1:N | ownerId | Same org |
| Project | Task | 1:N | projectId | Same org |
| User | Task | 1:N | assigneeId | Same org |
```

### Relationship Validation
```typescript
// helpers/validateRelationships.ts
export function validateMockData(data: MockDataSet): ValidationResult {
  const errors: string[] = [];
  
  // Check FK references exist
  for (const project of data.projects) {
    if (!data.users.find(u => u.id === project.ownerId)) {
      errors.push(`Project ${project.id} references non-existent owner ${project.ownerId}`);
    }
    // Ensure FK is in same organization
    const owner = data.users.find(u => u.id === project.ownerId);
    if (owner && owner.organizationId !== project.organizationId) {
      errors.push(`Project ${project.id} owner is in different organization`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}
```

---

## 4. JSON CRUD Helpers

### Mock Service Template
```typescript
// mockservices/baseService.ts
import { readFileSync, writeFileSync } from 'fs';

export function createMockService<T extends { id: string }>(jsonPath: string) {
  const load = (): T[] => JSON.parse(readFileSync(jsonPath, 'utf8')).data;
  const save = (data: T[]) => {
    const existing = JSON.parse(readFileSync(jsonPath, 'utf8'));
    existing.data = data;
    writeFileSync(jsonPath, JSON.stringify(existing, null, 2));
  };

  return {
    getAll: async (): Promise<T[]> => load(),
    
    getById: async (id: string): Promise<T | undefined> => 
      load().find(item => item.id === id),
    
    getByOrg: async (orgId: string): Promise<T[]> => 
      load().filter((item: T & { organizationId?: string }) => item.organizationId === orgId),
    
    create: async (item: Omit<T, 'id'>): Promise<T> => {
      const data = load();
      const newItem = { ...item, id: `${Date.now()}` } as T;
      data.push(newItem);
      save(data);
      return newItem;
    },
    
    update: async (id: string, updates: Partial<T>): Promise<T> => {
      const data = load();
      const index = data.findIndex(item => item.id === id);
      if (index === -1) throw new Error(`Item ${id} not found`);
      data[index] = { ...data[index], ...updates };
      save(data);
      return data[index];
    },
    
    delete: async (id: string): Promise<boolean> => {
      const data = load();
      const filtered = data.filter(item => item.id !== id);
      save(filtered);
      return true;
    },
  };
}
```

### Usage Example
```typescript
// mockservices/userService.ts
import { createMockService } from './baseService';
import { User } from '../types';

export const userService = createMockService<User>('./mockdata/users.json');

// In component
const users = await userService.getByOrg('ORG-001');
const newUser = await userService.create({ name: 'New User', organizationId: 'ORG-001', role: 'employee' });
```

---

## 5. FRD-to-Mock Derivation

### Step-by-Step Process

```markdown
## Mock Data Generation Checklist

1. [ ] **Read tech-spec.md Section 7** - Extract all entities from Schema definition
2. [ ] **Create Schema** - `mockdata/_schema.md` with relationships
3. [ ] **Create JSON Files** - One per entity with `_meta` header, realistic data only
4. [ ] **Validate Relationships** - Run validation script
5. [ ] **Create Mock Services** - Wrap each JSON file
6. [ ] **Test Access** - Verify getByOrg works correctly
```

### Entity Extraction from `tech-spec.md`
```
Section 7 Says: "User: id, email, role, createdAt"
  → Entity: User
  → Fields: id, email, passwordHash, role
  → Data: Use realistic names like "Sarah Chen", "james.hartwell@company.com"

Section 7 Says: "Project: id, name, ownerId, status"
  → Entity: Project
  → Fields: id, name, ownerId, organizationId, status
  → Data: Use realistic project names like "Q1 Marketing Campaign", "Operations Dashboard"
```

---

## 6. Business Context Awareness

### Reading from Memory
```typescript
// Before generating mock data, check context-map for business rules
const businessRules = await readFile('AI_DOCS/memory/context-map.md');
// Extract: User roles, organization structure, data constraints
```

### Business Rule Compliance
```markdown
## Mock Data Must Satisfy

| `frd.md` Requirement | Mock Data Rule |
|-----------------|----------------|
| "Admin can manage all users" | At least 1 Admin per organization |
| "Projects have 3 statuses" | Include Active, Complete, Archive |
| "Tasks assigned to team members" | Assignee must be in same org as project |
```

---

## 7. Folder Structure

```
AI_DOCS/design/
├── mockdata/
│   ├── _schema.md              # Entity definitions
│   ├── _index.ts               # Barrel export
│   ├── organizations.json      # Tenants
│   ├── users.json              # Users (with orgId)
│   ├── projects.json           # Projects (with orgId)
│   └── tasks.json              # Tasks (with orgId)
│
├── mockservices/
│   ├── _index.ts               # Barrel export
│   ├── baseService.ts          # CRUD helpers
│   ├── organizationService.ts
│   ├── userService.ts
│   ├── projectService.ts
│   └── taskService.ts
│
└── helpers/
    └── validateRelationships.ts
```

---

## 8. Quick Reference

| Question | Answer |
|----------|--------|
| When to create mock data? | After `frd.md` approval (Gate 2D) |
| How many records per entity? | 3-5 (enough for list/detail views) |
| Multi-tenant required? | YES for any SaaS/B2B app |
| Mock services required? | YES - mandatory for all designs |
| Validate relationships? | YES - run before each design session |

---

## 9. Memory Integration

After creating mock data:
1. Update `AI_DOCS/memory/context-map.md` with entity list
2. Document relationships in `milestone-status.md`
3. Reference mock data in design specs

## 10. Test-fixtures bridge (for E2E — MANDATORY when seeding auth-gated entities)

The same data the tests log in as must be the data you seed. When you generate seed users or seedable entities for an app with authentication, write/refresh `AI_DOCS/quality/test-fixtures.md` so `e2e-testing` reads real credentials, not hardcoded ones (see `e2e-testing/SKILL.md`). Include at least one test user per role.

```markdown
# Test Fixtures
test-users:
  - email: user@test.local
    password: TestPass123!
    role: user
    seeded: [profile-complete, 5-orders]
  - email: admin@test.local
    password: AdminPass123!
    role: admin
mock-services:
  email: mailhog        # SMTP :1025, HTTP API :8025 (set if the app sends OTP/verification mail)
  sms: null
test-mode:
  enabled: true
  fixed-otp: "000000"
reset-endpoint: POST /api/test/reset   # header: X-Test-Token
```

Passwords here are test-only placeholders, never real secrets. If the fixtures file already exists, merge new users/entities into it rather than overwriting.

---

## Rules Integration

> Claude Code auto-loads these rules when editing matching files:
> - `.claude/rules/development-rules.md` — naming conventions, no hardcoded values

## Suggested Next Actions
1. Extract entities from `frd.md`
2. Create `_schema.md` with relationships
3. Generate JSON files for each entity
4. Create mock services

## High-density fixture mode (realistic density — Track G)

The demo with 3 rows lies. Enterprise UIs are judged on the dense case: long lists, long strings, many columns, deep pagination. To design and test the populated-at-realistic-density state (and to catch layout breakage early), generate a high-density fixture set on demand.

- **Trigger:** any list/table surface, any `data-dashboard` / `analytics` / `fintech` project, or when `/design-screens` or E2E needs the realistic-density state.
- **Volume:** generate ~10,000 rows for the primary list entities (configurable), not the 3-5 used for relationship sanity. Include long strings (max-length names, multi-line addresses), edge values (zero, negative, very large numbers), and a realistic distribution (not all identical).
- **Output:** write to `AI_DOCS/design/mockdata/<entity>.highdensity.json` (kept separate from the small relational seed so normal flows stay fast). Provide a generator script so it is reproducible, not a committed 10k-row blob where avoidable.
- **Consumers:** `/design-screens` (realistic-density state), `/e2e-testing` and MAVS (render the dense case + measure layout), and pagination/search/filter behavior tests.

A surface that was only ever designed and tested at 3 rows is a Gate UX-1 state-coverage miss.

## Next Step
Proceed to `mock-api-server` skill to set up the local CRUD API using this data, followed by `design-system` for UI development.

<!-- Version: 1.4.0 — 2026-06-29 — Track G: added high-density fixture mode (~10k rows, long strings, edge values) so the realistic-density state is designable and testable. -->

