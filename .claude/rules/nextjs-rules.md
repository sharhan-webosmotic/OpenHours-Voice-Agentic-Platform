---
description: "Next.js-specific rules: RSC boundaries, list keys, async patterns, hydration, image/font, Turbopack compatibility"
paths:
  - "**/*.tsx"
  - "**/*.ts"
  - "**/app/**"
  - "**/pages/**"
  - "**/components/**"
  - "**/next.config.*"
---

# Next.js Rules

> Applies to any project with `next.config.*` or an `app/` / `pages/` directory.
> General frontend rules are in `frontend-rules.md`. These rules are Next.js-specific.

<!-- Version: 1.0.0 | 2026-04-15 -->

---

## List Keys (BLOCKING)

**The most common React console error in Next.js is a duplicate or unstable key.**

1. **NEVER use array index as a key**: items shift on insert/delete, breaking identity
   ```tsx
   // WRONG
   {items.map((item, index) => <Row key={index} {...item} />)}

   // CORRECT
   {items.map((item) => <Row key={item.id} {...item} />)}
   ```

2. **NEVER use a date string as a key**: dates are not unique if multiple records share the same date
   ```tsx
   // WRONG: multiple records can have the same date
   {events.map((e) => <EventCard key={e.date} event={e} />)}

   // CORRECT: use a guaranteed-unique ID
   {events.map((e) => <EventCard key={e.id} event={e} />)}
   ```

3. **NEVER use non-unique fields as keys**: names, labels, statuses, timestamps-without-ms
   - If two siblings share the same key, React silently drops one and behavior is undefined

4. **Key rules**:
   - Must be **unique** among siblings (not globally)
   - Must be **stable** across renders: the same item always gets the same key
   - Must come from **data**, not from render logic
   - Prefer database IDs (`item.id`, `item._id`, `item.uuid`)
   - If no ID: combine fields that together guarantee uniqueness (`${item.userId}-${item.date}-${item.type}`)
   - If generating data without IDs: assign a stable id at **creation time**, not in `map()`. In client/browser code use a `safeRandomUUID()` helper, never bare `crypto.randomUUID()`, which is `undefined` in non-secure contexts (HTTP on a LAN IP, preview URLs, older webviews) and throws `crypto.randomUUID is not a function`. See `skills/reactjs/SKILL.md` -> Client IDs & Web Crypto. On the server (Route Handlers, Server Components) `crypto.randomUUID()` is fine.

5. **When combining fields for keys, use a separator that won't appear in the values**:
   ```tsx
   // Safe separator: double underscore
   key={`${userId}__${eventDate}__${eventType}`}
   ```

6. **Never call `Math.random()` or `Date.now()` inside `map()`**: produces new keys every render
   ```tsx
   // WRONG: generates new key on every render
   {items.map((item) => <Row key={Math.random()} {...item} />)}
   ```

---

## RSC / Client Boundary (BLOCKING)

7. **Default to Server Components**. Only add `'use client'` when the component needs:
   - `useState`, `useEffect`, `useReducer`, or any React hook
   - Event handlers (`onClick`, `onChange`, etc.)
   - Browser APIs (`window`, `localStorage`, `document`)
   - Third-party libraries that require the browser

8. **Never put `'use client'` on a layout file**: it forces every child into the client bundle

9. **Never make a Client Component `async`**:
   ```tsx
   // WRONG: async client component is invalid
   'use client'
   export default async function Widget() { ... }
   ```

10. **Non-serializable values cannot cross the server→client boundary**:
    - Functions, class instances, Dates, Maps, Sets, WeakMaps: NOT serializable as props
    - Use Server Actions (`'use server'`) to pass functions; use `.toISOString()` for Dates

11. **Keep Client Components as leaves**: a 'use client' boundary pulls its whole subtree into the client bundle, so push interactivity as deep as possible, not up to layouts.

---

## Async Params & APIs (Next.js 15+)

12. **`params`, `searchParams`, `cookies()`, `headers()` are all async in Next.js 15+**:
    ```tsx
    // WRONG (Next 14 style, throws in 15+)
    export default function Page({ params }: { params: { id: string } }) {
      return <div>{params.id}</div>
    }

    // CORRECT
    export default async function Page({ params }: { params: Promise<{ id: string }> }) {
      const { id } = await params
      return <div>{id}</div>
    }
    ```

13. **`cookies()` and `headers()` must be awaited**:
    ```tsx
    import { cookies, headers } from 'next/headers'
    const cookieStore = await cookies()
    const headersList = await headers()
    ```

---

## Hydration Error Prevention

14. **Wrap browser-only values in `useEffect`**: never read `window`, `localStorage`, or `navigator` during SSR:
    ```tsx
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])
    if (!mounted) return null
    ```

15. **Never render dynamic values (dates, random numbers) that differ between server and client**:
    - Use `suppressHydrationWarning` only on the specific element, not the whole tree
    - Or render the value inside `useEffect`

16. **Fix invalid HTML nesting** (common causes of hydration errors):
    - `<p>` inside `<p>`: use `<div>` for the outer
    - `<a>` inside `<a>`: nested links are invalid
    - `<button>` inside `<button>`: invalid HTML
    - `<div>` inside `<p>`: block element inside inline element

17. **Browser extensions can cause hydration mismatches**: add `suppressHydrationWarning` to `<body>`:
    ```tsx
    <body suppressHydrationWarning>{children}</body>
    ```

---

## Suspense (BLOCKING)

18. **`useSearchParams()` causes CSR bailout without Suspense**: always wrap the component that calls it:
    ```tsx
    // WRONG: entire page falls back to CSR
    export default function Page() {
      const searchParams = useSearchParams()
      ...
    }

    // CORRECT: only this component CSRs
    export default function Page() {
      return (
        <Suspense fallback={<Skeleton />}>
          <SearchContent />
        </Suspense>
      )
    }
    ```

19. **Use Suspense for parallel independent data streams**: never await one then the other (waterfall):
    ```tsx
    // WRONG: sequential
    const user = await getUser(id)
    const posts = await getPosts(user.id)

    // CORRECT: parallel
    const [user, posts] = await Promise.all([getUser(id), getPosts(id)])

    // CORRECT: streaming with Suspense
    <Suspense fallback={<UserSkeleton />}><UserProfile id={id} /></Suspense>
    <Suspense fallback={<PostsSkeleton />}><UserPosts id={id} /></Suspense>
    ```

---

## Image & Font Optimization (BLOCKING)

20. **Always use `next/image`**: never a raw `<img>` tag for user-facing images:
    ```tsx
    import Image from 'next/image'
    // Set priority on LCP (hero/banner) images
    <Image src="/hero.jpg" width={1200} height={600} alt="Hero" priority />
    ```

21. **Configure `remotePatterns`** in `next.config.*` for external image domains. Never leave it open with `*`.

22. **Always use `next/font`**: never `<link>` to Google Fonts directly:
    ```tsx
    import { Inter } from 'next/font/google'
    const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
    ```

---

## Route Handlers

23. **Use Route Handlers for** external API consumers, webhooks, file downloads
24. **Fetch internal data in Server Components**, because calling your own Route Handler adds an extra HTTP round-trip and loses RSC caching and streaming. Do NOT use Route Handlers for internal data fetching.
25. **Route Handlers cannot coexist with `page.tsx`** at the same route segment for GET
26. **Always use `NextRequest`/`NextResponse`**, not raw `Request`/`Response`:
    ```tsx
    import { NextRequest, NextResponse } from 'next/server'
    export async function POST(request: NextRequest) {
      const body = await request.json()
      return NextResponse.json({ ok: true })
    }
    ```

---

## Error Boundaries

27. **Every route segment that fetches data must have `error.tsx`**
28. **Root must have `global-error.tsx`**: catches errors in root layout
29. **`error.tsx` must be a Client Component** (`'use client'`): it uses `reset`:
    ```tsx
    'use client'
    export default function Error({ error, reset }: { error: Error; reset: () => void }) {
      return (
        <div>
          <h2>Something went wrong</h2>
          <button onClick={() => reset()}>Try again</button>
        </div>
      )
    }
    ```

---

## Metadata

30. **Set titles and meta via the metadata export or generateMetadata**, because Next.js dedupes, merges, and streams metadata only through that API. Never set `<title>` or `<meta>` in JSX:
    ```tsx
    export const metadata: Metadata = { title: 'Page Title', description: '...' }
    ```

31. **Dynamic pages must use `generateMetadata`**, because their metadata depends on fetched params and a hardcoded title serves the same value on every instance of the route. Never hardcode titles in dynamic routes.

---

## Parallel & Intercepting Routes

32. **Always provide `default.tsx`** in every parallel route slot (`@modal`, `@sidebar`)
33. **Close modals with `router.back()`**, because backing out restores the intercepted background route and its state. Navigating to a different URL discards both, so do not use it to close a modal.

---

## Middleware

34. **Keep middleware minimal**: only auth guards, redirects, header injection, A/B routing
35. **Heavy logic belongs in route handlers**, because middleware runs on every matched request and any work there adds latency to the whole site. Keep heavy logic out of middleware.
36. **Always define `matcher`**: never run middleware on every request including static assets:
    ```ts
    export const config = {
      matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
    }
    ```

---

## Turbopack

37. **Do NOT use `webpack` config options not supported by Turbopack**: check Next.js Turbopack compat list before adding webpack plugins
38. **Custom webpack loaders** may not work with Turbopack: use `next.config.ts` `experimental.turbo.rules` instead
39. **If a dependency causes Turbopack errors**, check its GitHub issues before downgrading: often a `next.config.ts` alias or transpile entry fixes it

---

## Cross-References

- General frontend rules (pagination, URL state, tables) → `frontend-rules.md`
- API contract enforcement → `api-rules.md`
- Component reuse, design tokens → `component-reuse-rules.md`
- Security (XSS, auth, CSRF) → `security-rules.md`
- Next.js skill reference → `skills/nextjs/SKILL.md`

<!-- Version: 1.0.1 | 2026-06-18 | List-key guidance: client code uses safeRandomUUID(), not bare crypto.randomUUID() (secure-context-only). -->
<!-- Version: 1.1.0 | 2026-08-21 | Full em-dash sweep (this file was missed by the positive-direction pass) plus six causal-phrasing conversions from the 2026-08-21 revalidation audit: client-leaf boundary, internal fetching in Server Components, metadata API, generateMetadata for dynamic routes, router.back() for modals, heavy logic out of middleware. -->
