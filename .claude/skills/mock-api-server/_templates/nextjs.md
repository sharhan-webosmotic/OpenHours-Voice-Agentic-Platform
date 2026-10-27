# Mock API Server — Next.js 16 Template

> **Applies to**: Next.js (App Router), React, TypeScript

## Implementation Strategy

### 1. Catch-all Route Handler
Create a single dynamic route handler that intercepts requests and maps them to local JSON file operations.

**File**: `src/app/api/mock/[...path]/route.ts`

**Logic Flow**:
- Parse the incoming `path` array (e.g., `['users']` → target `users.json`).
- Parse the HTTP method.
- **GET**: 
  - `fs.promises.readFile('AI_DOCS/design/mockdata/[entity].json')`
  - Return JSON payload.
- **POST/PUT**:
  - `await request.json()`
  - Validate with Zod: `schema.parse(body)`.
  - Read existing array, append/update, `fs.promises.writeFile`.
- **DELETE**:
  - Filter array by `id`, `fs.promises.writeFile`.

### 2. API Client Wrapper
Provide a typed fetch wrapper for components.

**File**: `src/lib/api-client.ts`

```typescript
const IS_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';
const BASE_URL = IS_MOCK ? '/api/mock' : process.env.NEXT_PUBLIC_API_URL;

export const apiClient = {
  get: async <T>(path: string): Promise<T> => {
    const res = await fetch(`${BASE_URL}${path}`);
    if (!res.ok) throw new Error('API Error');
    return res.json();
  },
  post: async <T>(path: string, data: unknown): Promise<T> => {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' }
    });
    return res.json();
  }
};
```
