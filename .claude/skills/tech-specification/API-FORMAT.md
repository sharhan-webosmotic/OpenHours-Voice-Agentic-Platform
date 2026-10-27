# API Contract Format Details

> Extracted from [SKILL.md](SKILL.md) Section 6 — full API contract format, examples, and mismatch prevention rules.

---

> [!CRITICAL]
> Section 6 is the **source of truth** for all API endpoints. When this section is approved:
> 1. Copy it verbatim into `AI_DOCS/architecture/api-contract.md` — this becomes the live contract file
> 2. `build` reads `api-contract.md` before implementing ANY frontend call or backend route
> 3. Any change to an endpoint (URL, body, response shape) requires a Change Request — update BOTH this section AND `api-contract.md` before touching code

**Base URL Convention**: All endpoints are relative to `/api/v1/` unless specified otherwise.
**Response Envelope**: All responses use `{ success: boolean, data: T, message?: string }` unless the endpoint deviates (document deviation explicitly).

```markdown
## 6. API Contract

> Source file: AI_DOCS/architecture/api-contract.md (auto-synced from this section)
> Base URL: /api/v1

---

### [Resource Group — e.g., Authentication]

#### POST /api/v1/auth/login
**Auth Required**: No
**Request Body**:
\`\`\`json
{
  "email": "string (required)",
  "password": "string (required, min 8 chars)"
}
\`\`\`
**Success Response (200)**:
\`\`\`json
{
  "success": true,
  "data": {
    "token": "string (JWT)",
    "user": {
      "id": "string",
      "name": "string",
      "email": "string",
      "role": "string (enum: admin | user | ...)"
    }
  }
}
\`\`\`
**Error Responses**:
| Code | When |
|------|------|
| 400 | Missing or invalid fields |
| 401 | Wrong email or password |

---

#### GET /api/v1/users/:id
**Auth Required**: Yes — Bearer token
**URL Params**: `id` (string — MongoDB ObjectId or UUID)
**Success Response (200)**:
\`\`\`json
{
  "success": true,
  "data": {
    "id": "string",
    "name": "string",
    "email": "string",
    "role": "string",
    "createdAt": "ISO 8601 datetime"
  }
}
\`\`\`
**Error Responses**:
| Code | When |
|------|------|
| 401 | No/invalid token |
| 403 | Token belongs to different user (non-admin) |
| 404 | User not found |
```

**After Section 6 is approved**, run:
```
→ Copy this section to AI_DOCS/architecture/api-contract.md
→ Update AI_DOCS/memory/gate-status.md: "API Contract: LOCKED [date]"
→ Inform build that api-contract.md is ready to use
```

**Mismatch Prevention Rules (enforced by build):**
- Frontend calls exactly what the contract says — method, URL, body field names, response field names
- Backend returns exactly what the contract says — no extra fields, no renamed fields
- Auth guard presence matches the contract's `Auth Required` field
- URL param names match exactly (`:id` not `:userId` if contract says `:id`)
