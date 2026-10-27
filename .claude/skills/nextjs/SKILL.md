---
name: nextjs
description: "Authoritative skill for all Next.js-specific work: App Router, Server and Client Components, 'use client'/'use server', route handlers under app/api, the metadata API and OG images, next/image and next/font, hydration fixes, Suspense streaming, async params, and self-hosting vs Vercel. Use whenever the task touches an app/ directory, a Server/Client Component boundary, Next.js routing, metadata, or deployment. Do NOT use for: framework-agnostic React (use reactjs), shadcn/ui (use shadcn-ui), Playwright tests (use e2e-testing), or non-Next.js deploys (use deployment-planning)."
mcp_integrations: [next-devtools]
next_skill: null
required_gate: null
skill_id: SK-102
context_budget:
  load_kb: 30
  scope: task
version: 1.4.3
dependencies:
  required: [build]
  optional: [design-discovery, design-tokens, design-screens, shadcn-ui]
note: "For the full dynamic skill: npx skills add https://github.com/vercel-labs/next-skills --skill next-best-practices"
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---

> **Comments & docs:** Docstrings/JSDoc on every function. No inline comments except a one-line *why* for genuinely complex logic (calculations, time conversions, deliberate workarounds). No commented-out code. Put rationale, decisions, and feature context in `AI_DOCS/planning/` + `AI_DOCS/memory/decision-log.md` and keep it updated in the same change. Full policy: `.claude/rules/development-rules.md` -> Code Comments & Documentation.

# Next.js

Loads: `rules/development-rules.md` and `rules/frontend-rules.md`.

## MCP Acceleration

Per `.claude/rules/mcp-rules.md`, use these MCP servers to work faster (free servers are auto-provisioned in the project `.mcp.json`, and gated servers need approval + `${ENV_VAR}` credentials):

- `next-devtools` (free): discover the running Next.js server and inspect routes, RSC boundaries, hydration, and runtime errors.

Target the project's dev URL/port (default `http://localhost:3000`) when connecting the browser-based server.

## RSC Boundaries

- Default to Server Components. Add `'use client'` only when component needs hooks, events, or browser APIs.
- Client Components cannot be `async` — `async function ClientComponent()` is invalid.
- Non-serializable props (functions, Dates, Maps, Sets, class instances) cannot cross server to client.
- Server Actions are the exception — functions passed via `action` prop serialize.
- Directives (`'use client'`, `'use server'`, `'use cache'`) go at the top of the file before imports.

```tsx
// BAD
'use client'
export default async function Page() { ... }   // async client = invalid
<ClientComponent handler={() => {}} />          // function prop won't serialize

// GOOD
<form action={submitAction}>...</form>          // Server Action is fine
```

## Async Patterns (Next 15+)

`params`, `searchParams`, `cookies()`, `headers()` are all async.

```tsx
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()
  const headersList = await headers()
  return <div>{id}</div>
}
```

## Routing & Data

> **Code to the installed stack (`tech-stack-selection-rules.md` Rule 9).** Read `package.json` + `stack.md`: when `@reduxjs/toolkit` is installed, client-side data + mutations use RTK Query hooks (not raw `fetch`-in-`useEffect`); forms use `react-hook-form` + `zod` if installed; use the installed UI library. Server Components / Server Actions below are the Next-native path, but on a project whose stack is Redux Toolkit, the client data layer is RTK Query. Do not leave an installed data/form library unused.

| Pattern | Use For |
|---|---|
| Server Component | Read data during render |
| Server Action | Mutations from client (forms, buttons) |
| Route Handler `app/api/.../route.ts` | Webhooks, external API consumers, file downloads |

- Route Handler and `page.tsx` cannot coexist at same segment for GET.
- Avoid waterfalls — use `Promise.all` or independent `<Suspense>` boundaries.

## Hydration & Suspense

| Cause | Fix |
|---|---|
| `window`/`localStorage` in render | Wrap in `useEffect` or guard `typeof window` |
| Date/time mismatch | `suppressHydrationWarning` or render in `useEffect` |
| Invalid HTML nesting | Fix structure |
| Browser extension DOM mutation | `suppressHydrationWarning` on `<body>` |

`useSearchParams()` and `usePathname()` (in dynamic routes) cause CSR bailout — wrap consumer in `<Suspense>`.

## Error Files

| File | Scope |
|---|---|
| `error.tsx` | Route segment errors (must be Client Component) |
| `global-error.tsx` | Root-level boundary |
| `not-found.tsx` | Custom 404 |

## Metadata & OG

```tsx
export const metadata: Metadata = { title: 'My App', description: '...' }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const product = await getProduct(id)
  return { title: product.name }
}
```

OG images: `next/og` `ImageResponse` in `opengraph-image.tsx`.

## Image & Font

- Always `next/image` — never `<img>`. Configure `remotePatterns` for external sources.
- Set responsive `sizes`; `priority` on LCP; `placeholder="blur"` with `blurDataURL` for above-fold.
- Always `next/font` — never `<link>` to Google Fonts. Subset (`subsets: ['latin']`). Use CSS variable for Tailwind.

## Parallel & Intercepting Routes

- Modal pattern uses `@slot` + `(.)` interceptor. Layout renders `{children}` and `{modal}`.
- Always provide `default.tsx` in parallel route slots.
- Close intercepted modals with `router.back()`, not navigation.

## Self-Hosting

- `output: 'standalone'` in `next.config.js` for Docker.
- Configure cache handler for multi-instance ISR.
- Verify feature parity outside Vercel before relying on it.

## Web Crypto: Client vs Server (BLOCKING)

`crypto.randomUUID()` is safe on the server and a crash waiting to happen on the client.

- **Server (Server Components, Route Handlers, Server Actions, middleware — Node runtime):** `crypto.randomUUID()` is fine. Node exposes Web Crypto globally (Node 19+) or via `node:crypto`. Generating ids server-side and passing them down is the preferred pattern.
- **Client (`'use client'` components running in the browser):** never call `crypto.randomUUID()` directly. It is exposed ONLY in secure contexts (HTTPS or `localhost`). Over plain HTTP on a LAN IP (`http://192.168.x.x`), a preview URL, or in an older webview, `crypto.randomUUID` is `undefined` and throws `crypto.randomUUID is not a function`. The same gate applies to `crypto.subtle`. It is a runtime crash that passes typecheck and CI and only appears off `localhost`.
- `crypto.getRandomValues` works in insecure contexts too — only `randomUUID`/`subtle` are gated. So client code uses a `safeRandomUUID()` helper (native when present, `getRandomValues` v4 fallback). Never fall back to `Math.random` (not crypto-strong; banned by `security-rules.md`).

```ts
// Client-safe helper. On the server, calling crypto.randomUUID() directly is fine.
export function safeRandomUUID(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  if (c && typeof c.getRandomValues === 'function') {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; // RFC 4122 version 4
    b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  throw new Error('No Web Crypto RNG available');
}
```

## When NOT to Use

- Pure React hooks/components -> reactjs
- shadcn/ui install -> shadcn-ui
- Playwright tests -> e2e-testing
- Non-Next.js deployments -> deployment-planning
<!-- Version: 1.4.3 | 2026-10-22 | repointed rule references after code-rules.md and compliance/secrets.md merges (v4.32.0) -->
