---
name: caching-strategy
description: "Implement multi-layer caching with Redis, CDN, browser cache, and React Query. Use when adding caching, optimizing slow APIs, setting up Redis, or configuring CDN. Also triggers on: 'Add caching', 'Redis setup', 'Cache strategy', 'Performance caching', 'RTK Query', 'SWR'."
next_skill: null
required_gate: null
skill_id: SK-031
context_budget:
  load_kb: 30
  scope: task
version: 1.3.2
dependencies:
  required: [build]
  optional: []
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---
# ⚡ Caching Strategy Skill

> **Purpose**: Implement multi-layer caching for optimal performance
> **Output**: Cache configuration, invalidation strategy, TTL policies

---

## 🚨 Initialization & Memory Logic
> [!NOTE]
> **Gated Approach**: Memory initialization handled by [session-management](../session-management/SKILL.md). Gate status checked before skill handoff.

---

## 0. Decide before you cache (BLOCKING)

> [!CAUTION]
> **Do not add a cache by habit.** A cache is chosen FROM a requirement signal in `/do` Step 1.8 (`rules/runtime-architecture-rules.md`, Axis 1 of `skills/tech-specification/ARCH-PATTERNS.md`), recorded in tech-spec S22 (Caching) + ADR-003. This skill IMPLEMENTS that decision; it does not invent it.

Before writing any cache code, confirm:
1. **There is a real hot read.** The same expensive read is served repeatedly. No repeated hot read → no cache (premature infrastructure is a defect, `runtime-architecture-rules.md` Rule 2). Redis "because every backend has Redis" is forbidden.
2. **S22 records this cache.** If the plan has no Caching row for this path, STOP and route through `/change-request` to add it (decision + ADR) before coding. Unplanned Redis is runtime drift that `/build`'s runtime-pattern fidelity gate blocks.
3. **The three obligations are designed, not just the read path:** an explicit **TTL**, an **invalidation trigger** (on every write to the cached entity), and a documented **stale-tolerance** (what may the user see out of date, and for how long). Money, balances, and permissions default to no-cache or a very short TTL + explicit invalidation. The read path must tolerate a **cache miss** and a **cache-down** state (read through to the source, never hard-fail because Redis is unavailable).
4. **Regulated data stays out of the cache.** If `stack.md compliance` is set (Step 1.9), PHI / cardholder / restricted PII must not sit in a shared cache unencrypted. Honor the control from the matching `rules/compliance/*.md`.

Only after these are confirmed, proceed to the layer implementation below.

---

## 0.5 Cache correctness validation (MAVS, feeds `mavs/behavior.json`)

A cache is a correctness risk, not just a speed feature: the classic bug is a stale read after a write. So every cached read path gets a correctness test, run by the `qa-testing` behavior validator and recorded in the `cache` section of `AI_DOCS/quality/mavs/behavior.json`. For each cached entity declared in S22:

- **Miss then hit:** a cold read is a MISS (computed from the source), an identical second read is a HIT (served from cache, the source is not hit again). Prove the HIT by asserting the source was queried once, not twice (spy/counter or a changed-underneath check).
- **Invalidation on write:** after a WRITE to the entity, the next read reflects the new value. A read that still returns the pre-write value is a `FAIL` (stale-after-write is a data-integrity defect, not a performance nuance).
- **TTL:** an entry read past its configured TTL is recomputed, not served stale beyond the documented stale-tolerance.
- **Cache-down:** with the cache layer unavailable, the read still returns correct data from the source (no hard-fail because Redis is down).

This is `status` PASS only when all four hold for every cached path, SKIP (not FAIL) when the project declares no cache, never a silent PASS. The MILESTONE gate (`mavs-gate.sh`) blocks on a `behavior` FAIL.

---

## 1. Caching Layers Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     CACHING LAYERS                           │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Browser     │ Cache-Control, Service Worker       │
│  Layer 2: CDN         │ Edge caching, ISR                   │
│  Layer 3: Frontend    │ RTK Query, SWR, Zustand, TanStack   │
│  Layer 4: Backend     │ Redis/Memcached                     │
│  Layer 5: Database    │ Query result caching                │
└─────────────────────────────────────────────────────────────┘
```

> [!TIP]
> **Which frontend data/caching layer?** For React/Next the standard here is **RTK Query** (the stack uses Redux Toolkit, per `frontend-rules.md` 11): it owns server state, mutations (the form submit), and cache tags. SWR / TanStack are alternatives only on a non-Redux stack.
> 1. **RTK Query** - the React/Next default (Redux ecosystem, automatic cache tags, the form-submit mutation)
> 2. **SWR** - alternative for a non-Redux stack (simple, lightweight, Vercel ecosystem)
> 3. **TanStack Query** - alternative for a non-Redux stack (powerful, framework-agnostic)
> 4. **Zustand Persist** - client-only UI state persistence (complements RTK, not a server-state replacement)
> 5. **Redis** - Server-side, shared across instances

---

## 2. Browser Caching (Cache-Control)

### HTTP Headers Configuration
```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, max-age=0, must-revalidate' },
        ],
      },
    ];
  },
};
```

### Cache Duration Reference

| Asset Type | Cache Duration | Strategy |
|------------|---------------|----------|
| Static images | 1 year | `immutable` |
| CSS/JS bundles | 1 year | `immutable` (hashed) |
| API responses | 0-5 min | `stale-while-revalidate` |
| User data | No cache | `private, no-store` |

---

## 3. RTK Query (Redux Toolkit Query)

### Setup
```typescript
// store/api/baseApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['User', 'Product', 'Order'],
  endpoints: () => ({}),
});
```

### Define Endpoints with Cache Tags
```typescript
// store/api/productApi.ts
import { api } from './baseApi';

export const productApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getProducts: builder.query({
      query: () => '/products',
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Product', id })), 'Product']
          : ['Product'],
    }),
    
    updateProduct: builder.mutation({
      query: ({ id, ...patch }) => ({
        url: `/products/${id}`,
        method: 'PATCH',
        body: patch,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Product', id }],
    }),
    
    deleteProduct: builder.mutation({
      query: (id) => ({
        url: `/products/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'Product', id },
        'Product', // Also invalidate list
      ],
    }),
  }),
});

export const { useGetProductsQuery, useUpdateProductMutation, useDeleteProductMutation } = productApi;
```

### Optimistic Updates
```typescript
updateProduct: builder.mutation({
  query: ({ id, ...patch }) => ({ url: `/products/${id}`, method: 'PATCH', body: patch }),
  async onQueryStarted({ id, ...patch }, { dispatch, queryFulfilled }) {
    const patchResult = dispatch(
      productApi.util.updateQueryData('getProducts', undefined, (draft) => {
        const product = draft.find((p) => p.id === id);
        if (product) Object.assign(product, patch);
      })
    );
    try {
      await queryFulfilled;
    } catch {
      patchResult.undo(); // Rollback on error
    }
  },
}),
```

---

## 4. SWR (Stale-While-Revalidate)

### Basic Usage
```typescript
// hooks/useProducts.ts
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useProducts() {
  const { data, error, isLoading, mutate } = useSWR('/api/products', fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 2000,
  });

  return { products: data, error, isLoading, refresh: mutate };
}
```

### Global Configuration
```typescript
// app/providers.tsx
import { SWRConfig } from 'swr';

export function Providers({ children }) {
  return (
    <SWRConfig
      value={{
        fetcher: (url) => fetch(url).then((r) => r.json()),
        revalidateOnFocus: false,
        shouldRetryOnError: false,
        dedupingInterval: 5000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
```

### Mutation with Revalidation
```typescript
import useSWRMutation from 'swr/mutation';

async function updateProduct(url: string, { arg }: { arg: ProductUpdate }) {
  return fetch(url, { method: 'PATCH', body: JSON.stringify(arg) }).then((r) => r.json());
}

function ProductEditor({ id }) {
  const { trigger, isMutating } = useSWRMutation(`/api/products/${id}`, updateProduct);
  
  const handleSave = async (data) => {
    await trigger(data);
    mutate('/api/products'); // Revalidate list
  };
}
```

---

## 5. TanStack Query (React Query)

### Setup
```typescript
// lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30,   // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

### Query with Cache
```typescript
// hooks/useProducts.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: () => fetch('/api/products').then((r) => r.json()),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (product: Product) =>
      fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify(product),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
```

### Prefetching
```typescript
// Prefetch on hover
function ProductLink({ id }) {
  const queryClient = useQueryClient();
  
  return (
    <Link
      href={`/products/${id}`}
      onMouseEnter={() => {
        queryClient.prefetchQuery({
          queryKey: ['product', id],
          queryFn: () => fetch(`/api/products/${id}`).then((r) => r.json()),
        });
      }}
    >
      View Product
    </Link>
  );
}
```

---

## 6. Zustand Persist (Client State)

### Persisted Store
```typescript
// store/useCartStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clear: () => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) => set((state) => ({ items: [...state.items, item] })),
      removeItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }), // Only persist items
    }
  )
);
```

### Session Storage Option
```typescript
persist(
  (set) => ({ /* ... */ }),
  {
    name: 'session-data',
    storage: createJSONStorage(() => sessionStorage), // Clears on tab close
  }
)
```

---

## 7. Service Worker Caching (Workbox)

### next.config.js with next-pwa
```javascript
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/api\.example\.com\/.*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'api-cache',
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'image-cache',
        expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
  ],
});

module.exports = withPWA({ /* next config */ });
```

---

## 8. Redis (Server-Side)

### Connection
```typescript
// lib/cache/redis.ts
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
});

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  },
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  },
  async del(key: string): Promise<void> {
    await redis.del(key);
  },
  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
  },
};
```

### Cache Key Naming
```
[entity]:[id]:[variant]

Examples:
- user:123
- user:123:permissions
- products:list:page:1
- products:category:electronics
```

---

## 9. Comparison Matrix

| Feature | RTK Query | SWR | TanStack Query | Zustand |
|---------|-----------|-----|----------------|---------|
| Redux Integration | ✅ Native | ❌ | ❌ | ❌ |
| Cache Tags | ✅ | ❌ | ✅ queryKey | ❌ |
| Optimistic Updates | ✅ | ✅ | ✅ | Manual |
| Offline Support | ✅ | ❌ | ✅ | ✅ (persist) |
| Bundle Size | ~12KB | ~4KB | ~13KB | ~3KB |
| Best For | Redux apps | Simple apps | Complex apps | Local state |

---

## 10. Memory Integration

After implementing caching:
1. Update `AI_DOCS/memory/project-context.md` — note which caching layer was added
2. Append to `AI_DOCS/memory/decision-log.md`: which library was chosen and why
3. Update `AI_DOCS/design/component-registry.md` if any cache-aware UI components were created

---

## Rules Integration

> Claude Code auto-loads these rules when editing matching files:
> - `.claude/rules/development-rules.md` — architecture, naming conventions
> - `.claude/rules/api-rules.md` — cache headers, response patterns

## Suggested Next Actions
1. Choose frontend caching library (RTK Query / SWR / TanStack)
2. Set up Redis connection for backend
3. Implement cache invalidation hooks

## Next Step
Proceed to `performance` skill for optimization audits.
