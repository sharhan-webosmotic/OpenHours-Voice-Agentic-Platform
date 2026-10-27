# Mock Data Standards

> **Purpose**: Define rules for creating and using mock data across design and development
> **Audience**: AI agents (Designer, Developer)
> **When**: After FRD approval (Gate G2), before Design (Gate G3A)

---

## Core Principle

> [!CRITICAL]
> **Mock data is created ONCE and REUSED everywhere.**
> Same entity appears identically across all screens.

```
FRD → Mock Schema → Mock Data → Mock Services → ALL Designs → 05_Seed.ts → DB
                                      ↓
                              SINGLE SOURCE OF TRUTH
```

---

## 1. Folder Structure

```
AI_DOCS/design/
├── mockdata/                    # DATA (JSON files)
│   ├── _schema.md              # Entity definitions from FRD
│   ├── _index.ts               # Barrel export
│   ├── users.json              
│   ├── projects.json           
│   └── [entity].json           
│
├── mockservices/               # API LAYER (MANDATORY)
│   ├── _index.ts               # Barrel export
│   ├── userService.mock.ts     
│   ├── projectService.mock.ts  
│   └── [entity]Service.mock.ts 
│
├── assets/
│   └── generated/              # AI-GENERATED IMAGES
│       ├── avatars/
│       └── placeholders/
│
└── src/                        # Shadow Mirror code
```

---

## 2. Mock Data Schema Template

> **File**: `AI_DOCS/design/mockdata/_schema.md`

```markdown
# Mock Data Schema

> Generated from FRD requirements

| Entity | Primary Key | Fields | Constraints | FRD Ref |
|--------|-------------|--------|-------------|---------|
| User | id | name, email, role, avatar | Roles: Admin, Manager, Employee | FR-AUTH-001 |
| Project | id | name, description, status, ownerId | Status: Active, Complete, Archive | FR-PROJ-001 |
| Task | id | title, projectId, assigneeId, status | Status: Todo, InProgress, Done | FR-TASK-001 |

## Relationships

- User (1) → Project (many): via `ownerId`
- Project (1) → Task (many): via `projectId`
- User (1) → Task (many): via `assigneeId`
```

---

## 3. Mock Data JSON Template

> **File**: `AI_DOCS/design/mockdata/users.json`

```json
{
  "_meta": {
    "entity": "User",
    "frdRef": "FR-AUTH-001, FR-USER-001",
    "description": "User entities for authentication and profile",
    "recordCount": 5
  },
  "data": [
    {
      "id": "U001",
      "name": "Sarah Chen",
      "email": "sarah.chen@company.com",
      "role": "Admin",
      "avatarUrl": "/assets/generated/avatars/admin-sarah.png",
      "createdAt": "2025-01-15T09:00:00Z"
    },
    {
      "id": "U002",
      "name": "Michael Rodriguez",
      "email": "m.rodriguez@company.com",
      "role": "Manager",
      "avatarUrl": "/assets/generated/avatars/manager-mike.png",
      "createdAt": "2025-02-01T10:30:00Z"
    },
    {
      "id": "U003",
      "name": "Emily Watson",
      "email": "emily.watson@company.com",
      "role": "Employee",
      "avatarUrl": "/assets/generated/avatars/employee-emily.png",
      "createdAt": "2025-02-10T14:00:00Z"
    }
  ]
}
```

---

## 4. Mock Service Template (MANDATORY)

> [!CRITICAL]
> **Mock services are REQUIRED** for all designs to mimic real API flows.

> **File**: `AI_DOCS/design/mockservices/userService.mock.ts`

```typescript
import usersData from '../mockdata/users.json';
import { User } from '../types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const userService = {
  // GET all users
  getAll: async (): Promise<User[]> => {
    await delay(300);
    return usersData.data;
  },

  // GET user by ID
  getById: async (id: string): Promise<User | undefined> => {
    await delay(200);
    return usersData.data.find(u => u.id === id);
  },

  // POST create user (simulates success)
  create: async (user: Partial<User>): Promise<User> => {
    await delay(500);
    const newUser = {
      ...user,
      id: `U${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    return newUser as User;
  },

  // PUT update user
  update: async (id: string, updates: Partial<User>): Promise<User> => {
    await delay(400);
    const existing = usersData.data.find(u => u.id === id);
    return { ...existing, ...updates } as User;
  },

  // DELETE user
  delete: async (id: string): Promise<boolean> => {
    await delay(300);
    return true;
  }
};
```

---

## 5. AI-Generated Image Assets

> Use **Gemini 3 Pro Image model** with FRD context.

### When to Generate

| Asset Type | Context Source | Prompt Example |
|------------|----------------|----------------|
| User Avatars | User roles from FRD | "Professional avatar for Admin user, modern style" |
| Product Images | Entity descriptions | "Icon for project management dashboard" |
| Empty States | Screen purpose | "Friendly empty state illustration for no projects" |
| Placeholders | Component type | "Loading placeholder for card component" |

### Generation Process

1. Read entity from `mockdata/*.json`
2. Extract context (role, type, purpose)
3. Generate image with Gemini 3 Pro
4. Save to `AI_DOCS/design/assets/generated/[type]/`
5. Update mock data JSON with image path

---

## 6. Data Reuse Rules

### Rule 1: Entity Consistency

Same entity appears identically across ALL screens:

```
Dashboard → shows "Sarah Chen" (U001)
User List → shows "Sarah Chen" (U001)
User Profile → shows "Sarah Chen" (U001)
```

### Rule 2: Reference by ID

Use IDs for relationships, denormalize display names:

```json
// projects.json
{
  "id": "P001",
  "name": "Alpha Care",
  "ownerId": "U001",
  "ownerName": "Sarah Chen"  // Denormalized for display
}
```

### Rule 3: Business Rule Compliance

Mock data MUST satisfy FRD constraints:

```
FRD says: "Admin users can approve timesheets"
→ mockdata/users.json MUST include at least one Admin
```

---

## 7. File Reference Matrix

| File | Relationship to Mock Data |
|------|---------------------------|
| `frd.md` | **Defines** entities and constraints |
| `mockdata/_schema.md` | **Derives from** FRD |
| `mockdata/*.json` | **Implements** schema |
| `mockservices/*.ts` | **Wraps** mock data |
| `01_Design.md` | **Specifies** which data to use |
| `design/src/**/*.tsx` | **Imports** from mockservices |
| `05_Seed.ts` | **Imports** mockdata for DB |

---

## 8. Transition to Production

### Design Phase
```typescript
// Uses mock service
import { userService } from '@/mockservices';
const users = await userService.getAll();
```

### Production Phase
```typescript
// Swap to real service (same interface)
import { userService } from '@/services/user.service';
const users = await userService.getAll();
```

### Seed Script
```typescript
// 05_Seed.ts - Same data flows to DB
import usersData from '../design/mockdata/users.json';

await prisma.user.createMany({
  data: usersData.data.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role
  }))
});
```

---

## 9. Quick Reference

| Question | Answer |
|----------|--------|
| When to create mock data? | After FRD approval, before Design |
| How many records? | 3-5 per entity (enough to show list/detail) |
| Mock services optional? | **NO** - Mandatory for flow alignment |
| Image assets? | AI-generated using Gemini 3 Pro |
| Data consistency? | Same entity = same data everywhere |

---

*Part of AI_SKILLS Framework v2.0*  
*Last Updated: 2026-02-05*
