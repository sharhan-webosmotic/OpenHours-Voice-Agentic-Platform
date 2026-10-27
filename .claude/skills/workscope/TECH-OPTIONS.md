# Tech Stack Options Tables

> Extracted from [SKILL.md](SKILL.md) Phase 2 — full option tables for each technology category.

---

### Frontend (Web)
_Applicable if: Web app is in scope_

| Option | Technology | Best When | Trade-offs |
|--------|-----------|-----------|------------|
| A | Next.js (React) | SEO matters, SSR/SSG needed, large app | Slightly more complex setup |
| B | React + Vite | SPA, no SEO requirement, fast builds | No SSR out of the box |
| C | Angular | Enterprise, large team, strict structure | Steeper learning curve, verbose |
| D | Vue + Nuxt | Smaller team, cleaner syntax preferred | Smaller ecosystem than React |

**Your current stack preference (if any):** [from discovery]
**Which option would you like for the web frontend?**

**React vs Next.js decision matrix** (MANDATORY before recommending a web frontend: decide from the requirement, never default one. Picking Next.js "because it's modern" or React "because it's simple" is the exact blind choice this matrix prevents):

Frontend-shape questions (fold into discovery):
1. Are there public, unauthenticated pages that must rank in search or render rich social-share previews (marketing site, blog, product/catalog pages, docs)? (yes → SSR/SSG → Next.js)
2. Is the app a fully authenticated tool behind login where SEO is irrelevant (dashboard, admin, internal app)? (yes → React + Vite is lighter and faster to iterate)
3. Do you need server-side rendering, streaming, or per-request data on first paint for performance or personalization? (yes → Next.js)
4. Do you want one framework to also host API routes / server actions / middleware (BFF in the same app)? (yes → Next.js) Or is the backend a separate service the SPA just calls? (either works; React + Vite keeps the frontend thin)

| Requirement profile | Recommended | Why |
|---|---|---|
| Public pages + SEO, marketing/content, social previews | Next.js | SSR/SSG/ISR, metadata, image optimization, edge rendering |
| SSR / streaming / per-request first paint | Next.js | App Router server components, server actions |
| Authenticated SPA, internal tool, no SEO | React + Vite | Smaller, faster builds, simpler mental model, no SSR tax |
| Same app should also serve API/BFF | Next.js | API routes + server actions + middleware in one codebase |
| Maximum control / non-React ecosystem preference | Vue + Nuxt or Angular | apply the same SEO-vs-SPA logic to that ecosystem |

Defaults and guardrails:
- **There is no default frontend.** The decision is earned from the SEO/SSR/public-surface signals above, recorded with the signal that drove it in `stack.md → ## Selection rationale → Frontend`.
- **When the app is half-and-half** (a public marketing surface AND a big authenticated app): Next.js usually wins because it covers both; if the public surface is tiny, a separate static page + a React SPA is also valid. Name which surface drove the call.
- **Mismatch pushback**: if the user asks for a SPA (React + Vite) but the requirement has public SEO pages, SAY SO with the cost (no SSR for SEO, client-only metadata is weak) and recommend Next.js. If they ask for Next.js for a pure internal dashboard, note the unused SSR complexity. Hold the position unless given new information (`rules/tech-stack-selection-rules.md` Rule 3).

---

### Mobile Application
_Skip if no mobile app is in scope_

| Option | Technology | Best When | Trade-offs |
|--------|-----------|-----------|------------|
| A | React Native | Single codebase for iOS+Android, team knows JS/React | Slightly behind Flutter on animations |
| B | Flutter | High-performance UI, complex animations, single codebase | Dart language — different from web stack |
| C | Native (Swift + Kotlin) | Maximum performance, full platform APIs | Two separate codebases, higher cost |

**Which option would you like for mobile?**

---

### Backend / API

| Option | Technology | Best When | Trade-offs |
|--------|-----------|-----------|------------|
| A | Node.js + NestJS | TypeScript-first, real-time, modular, same language as frontend | Requires good architecture discipline |
| B | Node.js + Express | Minimal setup, fast prototyping, small team | Need to add structure manually |
| C | Python + FastAPI | Data science involved, team knows Python, ML integration | Slightly lower performance than Node for high concurrency |
| D | Python + Django | Admin panel needed, batteries-included, ORM built-in | Monolithic by default, less flexible |
| E | Go | High concurrency, maximum performance, microservices | Longer development time, smaller talent pool |

**Backend decision signals** (map discovery answers to an option, then recommend with reasons):

| Signal from discovery | Choose | Avoid (and say why in the recommendation) |
|---|---|---|
| TypeScript team, real-time (sockets/live updates), API will grow past ~20 endpoints, microservices on the roadmap | NestJS | Express: structure debt appears exactly when the API grows |
| Tiny API (<10 endpoints), fastest MVP, solo dev | Express, or Next.js API routes when the frontend is already Next.js | NestJS: module/DI ceremony slows a tiny project |
| AI/ML features, LLM SDK usage, data pipelines, Python team | FastAPI | Node: flag the ecosystem tradeoff explicitly if chosen anyway |
| Admin-heavy CRUD where a built-in admin UI saves weeks | Django | FastAPI: admin would be hand-built |
| Extreme concurrency, low-latency infra services | Go | scripting-language stacks |

**NestJS vs FastAPI tie-break** (team knows both languages):
1. AI/ML anywhere in scope → FastAPI (the Python ecosystem is the point).
2. Heavy real-time or shared types with a TypeScript frontend → NestJS (one language end to end).
3. Neither signal → match the team's stronger language. Never split a small team across two backend languages.

**Which option would you like for the backend?**

---

### Database

| Option | Technology | Best When | Trade-offs |
|--------|-----------|-----------|------------|
| A | MongoDB | Flexible schema, document-based, rapid iteration | No strict relational joins; less suited for ACID-heavy workloads |
| B | PostgreSQL | Relational data, ACID compliance, complex queries | Schema changes need migrations |
| C | MySQL | Widely known, good for structured data, cost-effective | Less features than PostgreSQL |
| D | MongoDB + PostgreSQL | Hybrid — documents for catalog, relational for transactions | More complexity to manage |

_Common additions (usually paired with primary DB):_
- **Redis** — caching, sessions, rate limiting, pub/sub
- **Elasticsearch** — full-text search, logs, complex filters

**MongoDB vs PostgreSQL decision matrix** (MANDATORY before recommending: ask the four data-shape questions, then recommend from the answers, never from habit):

Data-shape questions (fold into discovery):
1. Are there orders, payments, bookings, or inventory: any flow where several records must change together or money moves? (yes → transactions + ACID → PostgreSQL)
2. Are the main entities heavily related (orders → line items → products → stock) and will reports filter or aggregate across them? (yes → PostgreSQL)
3. Is the data mostly self-contained documents (catalog entries, CMS content, event payloads, profiles) with shallow nesting and few cross-entity queries? (yes → MongoDB is viable)
4. Will the schema change weekly during MVP with low data risk? (yes → MongoDB acceptable, but set a revisit trigger: "first transactional feature → re-evaluate")

| Data profile | Recommended | Why |
|---|---|---|
| Transactions, money, inventory, multi-row consistency | PostgreSQL | ACID, foreign-key integrity, joins |
| Cross-entity reporting and dashboards | PostgreSQL | SQL aggregation, mature indexing |
| Self-contained flexible documents, few joins | MongoDB | schema flexibility, iteration speed |
| Both in one product (e.g. shop: catalog + orders) | PostgreSQL primary; JSONB for the document side | one database unless hybrid complexity is truly earned |

Defaults and guardrails:
- **When uncertain, default to PostgreSQL.** JSONB gives document flexibility inside a relational database. The reverse is not true: MongoDB cannot retrofit ACID joins. Choosing MongoDB for relational data is the most common stack mistake this matrix exists to prevent.
- **Hybrid (option D) must be earned**: justified only when BOTH sides are first-class (a large flexible catalog AND heavy transactions). Name which entities live in which store in the workscope, or do not propose hybrid.
- **Reconciliation downstream**: the choice is re-validated when tech-spec Section 7 drafts the real data model. A schema that contradicts the locked choice stops the spec and routes through `/change-request` before the API contract locks.

**Which database(s) would you like?**

---

### Cloud & Deployment

| Option | Technology | Best When | Trade-offs |
|--------|-----------|-----------|------------|
| A | AWS | Enterprise scale, global regions, full service ecosystem | Most complex, steeper cost at small scale |
| B | Google Cloud (GCP) | ML/AI workloads, Firebase integration, Google Maps | Smaller service catalog than AWS |
| C | Microsoft Azure | Microsoft stack, enterprise compliance, Office 365 integration | Complex pricing, good for .NET teams |
| D | DigitalOcean / Render | Smaller scale, simpler setup, cost-efficient | Limited advanced services |
| E | Client's own servers | Compliance requirements, air-gapped environments | Full ops responsibility |

**Which cloud/deployment would you like?**

---

### Third-Party Services
_Only list services relevant to features in scope. Replace inapplicable rows._

| Purpose | Option A | Option B | Best For |
|---------|----------|----------|---------|
| Payments (Global) | Stripe | PayPal | Global, developer-friendly |
| Payments (India) | Razorpay | PayU | UPI, INR support |
| Payments (MENA) | Tap Payments | PayTabs | AED/SAR, Arabic support |
| Push Notifications | Firebase (FCM) | OneSignal | FCM is standard; OneSignal has a dashboard |
| Maps & GPS | Google Maps | Mapbox | Google = data; Mapbox = custom styling |
| File Storage | AWS S3 | Cloudinary | S3 = general; Cloudinary = image transformations |
| SMS / OTP | Twilio | AWS SNS | Twilio = global; SNS = cost at scale |
| WhatsApp | Meta Cloud API | Twilio WhatsApp | Meta = direct; Twilio = easier setup |
| Email | Amazon SES | SendGrid | SES = cost; SendGrid = analytics/templates |

**Which services would you like for each relevant category?**

---

### Authentication & Identity

| Option | Technology | Best When | Trade-offs |
|--------|-----------|-----------|------------|
| A | Roll-your-own (sessions or JWT, per `security-rules.md`) | Full control, no per-MAU cost, simple role model | You own reset/MFA/lockout/rotation correctness |
| B | Auth0 / Okta | Enterprise SSO, SAML, compliance, fast setup | Per-MAU cost at scale, vendor lock |
| C | Clerk | React/Next-first, prebuilt UI, orgs + B2B | Per-MAU cost, newer ecosystem |
| D | NextAuth / Auth.js | Next.js app, OAuth social logins, self-hosted | You still own the session store + DB |
| E | Supabase Auth / Firebase Auth | Already on that BaaS, social + magic-link built in | Couples auth to the BaaS |
| F | AWS Cognito / Keycloak | AWS-native, or self-hosted open-source IdP | Cognito DX is rough; Keycloak is ops-heavy |

> Recommended by signal: enterprise SSO/SAML or compliance -> Auth0/Okta or Keycloak. React/Next B2B with orgs -> Clerk. Already on Supabase/Firebase -> their auth. Simple role model, cost-sensitive, full control -> roll-your-own per `security-rules.md` (and it must pass the `authz-matrix` tests either way). The auth MODEL (session vs JWT, MFA, rotation) is decided per `security-rules.md` regardless of provider.

---

### API Style

| Option | Technology | Best When | Trade-offs |
|--------|-----------|-----------|------------|
| A | REST (the framework default, standard envelope) | Most apps, public API, simple caching, broad tooling | Over/under-fetching, many endpoints for rich clients |
| B | tRPC | TypeScript end-to-end, same monorepo FE+BE, no codegen | TS-only, not a public/3rd-party API |
| C | GraphQL (Apollo / urql / Yoga) | Many clients with different shapes, rich graph, mobile + web | Caching + N+1 + auth-per-field complexity |
| D | gRPC | Internal service-to-service, low latency, strict contracts | Not browser-native, needs a gateway for web |

> Recommended by signal: public or 3rd-party API, or simplest tooling -> REST. A TS monorepo where FE and BE share types -> tRPC. Many heterogeneous clients over one rich graph -> GraphQL (budget for dataloader + per-field authz). Internal microservice mesh -> gRPC. `api-rules.md` (envelope, status codes) applies to REST; GraphQL/tRPC carry their own error + authz conventions, recorded in the API ADR.

---

### ORM / Data Access

| Option | Technology | Best When | Trade-offs |
|--------|-----------|-----------|------------|
| A | Prisma | TS, fast DX, generated types, migrations | Heavier runtime, less raw-SQL control |
| B | Drizzle | TS, SQL-first, lightweight, edge-friendly | Younger ecosystem |
| C | TypeORM | NestJS legacy, decorator entities | Migration sharp edges at scale |
| D | SQLAlchemy + Alembic | Python, mature, full control | More boilerplate |
| E | Django ORM | Django stack, batteries-included | Coupled to Django |
| F | Mongoose | MongoDB documents | Document-model only |

> Recommended by signal: TS + Postgres/MySQL, fast DX -> Prisma; SQL-first or edge -> Drizzle. Python -> SQLAlchemy (FastAPI) or the Django ORM (Django). Mongo -> Mongoose. The chosen ORM is what `schema-validation` diffs against `database-schema.md`, and what `development-rules.md` rule 65 (FK indexes) is checked on.

---

### Backend-as-a-Service (BaaS)

| Option | Technology | Best When | Trade-offs |
|--------|-----------|-----------|------------|
| A | None (own backend) | Custom logic, full control, the default for non-trivial apps | You build auth/storage/realtime |
| B | Supabase | Postgres + auth + storage + realtime + edge functions, SQL-native | Self-host or vendor; heavy logic still needs functions |
| C | Firebase | Mobile-first, Firestore + auth + FCM + functions | NoSQL model, vendor lock, query limits |
| D | Appwrite / PocketBase / Nhost | Open-source, self-hostable BaaS | Smaller ecosystems |

> Recommended by signal: fastest MVP with relational data + the team wants SQL -> Supabase. Mobile-first realtime -> Firebase. Self-hosted open-source -> Appwrite/PocketBase. Non-trivial custom business logic -> own backend. Choosing a BaaS often subsumes the Auth + Database + Realtime decisions, so reconcile them. (Supabase agent skills install via `npx skills add supabase/agent-skills`.)

---

### Async / Queue / Messaging

| Option | Technology | Best When | Trade-offs |
|--------|-----------|-----------|------------|
| A | None (inline / synchronous) | Work finishes inside the request budget | n/a (the default per `runtime-architecture-rules.md`) |
| B | BullMQ (Redis) | Node, jobs/retries/cron, already have Redis | Redis-bound, single-region by default |
| C | Celery / ARQ (Redis or RabbitMQ) | Python background jobs, scheduled tasks | Operational footprint |
| D | SQS / Cloud Tasks | Managed, durable, serverless-friendly | Cloud lock, at-least-once semantics |
| E | RabbitMQ | Complex routing, work queues, on-prem | Ops to run it |
| F | Kafka / Redpanda | Event streaming, high throughput, replay/log | Heavy; overkill for simple job queues |

> Recommended by signal (per `runtime-architecture-rules.md` Axis async): a queue is chosen FROM a requirement (work exceeds the request budget, bursts, durable delivery), never by default. Node + Redis -> BullMQ. Python -> Celery/ARQ. Managed/serverless -> SQS. Event streaming/replay -> Kafka. The chosen queue forces idempotent handlers + retry + dead-letter (you do not get the queue without those obligations).

---

### Serverless / Edge Compute

| Option | Technology | Best When | Trade-offs |
|--------|-----------|-----------|------------|
| A | Traditional server (the default) | Long-lived connections, steady load, full control | You manage scaling + uptime |
| B | AWS Lambda / Cloud Functions | Spiky/event-driven, pay-per-use, glue work | Cold starts, time/memory limits, statelessness |
| C | Cloudflare Workers / Vercel Edge | Low-latency global, edge middleware, light compute | Constrained runtime (no full Node), no long tasks |
| D | Next.js route handlers / Server Actions | The frontend is already Next.js, BFF pattern | Couples API life-cycle to the web deploy |

> Recommended by signal: steady load or websockets -> a server. Spiky/event-driven glue -> Lambda. Global low-latency middleware/redirects/auth-at-edge -> Workers/Edge. A small API alongside a Next.js app -> route handlers. Serverless changes the data-flow (cold start, statelessness, connection pooling) recorded in `runtime-architecture-rules.md` / the infra ADR.

---

### Desktop Application

| Option | Technology | Best When | Trade-offs |
|--------|-----------|-----------|------------|
| A | Tauri | Small binary, Rust core, reuse the web UI, security-focused | Rust for native bits, younger ecosystem |
| B | Electron | Mature, huge ecosystem, full Node in main process | Large binary, higher memory |
| C | Native (Swift / WinUI / GTK) | Deep OS integration, maximum performance | Per-OS codebases |

> Recommended by signal: reuse the existing React/Vue web UI as a desktop app, want a small footprint -> Tauri; need the mature ecosystem/plugins or heavy Node in-process -> Electron; deep per-OS native features -> native. Backed by `rules/desktop-rules.md`. (This closes the gap where `/do` offered a Desktop target with no patterns.)

---

### Additional backend languages (beyond the main table)

When the team or domain calls for it, the same requirement-first selection applies: **Java + Spring Boot** (enterprise, strong typing, mature ecosystem), **.NET / C#** (Microsoft shops, Azure, high performance), **Laravel / PHP** (rapid CRUD, huge hosting availability, large talent pool), **Ruby on Rails** (convention-over-configuration, fast CRUD MVP), **Elixir / Phoenix** (massive concurrency, real-time/LiveView). Go is in the main table and backed by `rules/go-rules.md` + the `go-specialist` agent. Pick from a real signal (team skills, domain fit, concurrency, ecosystem), recorded in the stack ADR.

---

### Other specialized services (pick only when a feature needs it)

Each follows the same options + trade-off + recommendation format when in scope:
- **Headless CMS** (content-heavy): Sanity, Contentful, Strapi, Payload, Directus.
- **Search**: Postgres FTS (start here), Meilisearch / Typesense (self-host), Algolia (managed), Elasticsearch/OpenSearch (logs + complex).
- **Realtime providers**: Socket.io (self), Pusher / Ably (managed), Supabase Realtime, Liveblocks (collaborative editing/presence).
- **Observability tools** (per `docs/app-observability-standard.md`): Sentry (errors), Datadog / New Relic (APM), Grafana + Prometheus + Loki (self-host), OpenTelemetry (vendor-neutral instrumentation).
- **Feature flags**: LaunchDarkly (managed), Unleash / Flagsmith (open-source), or a config-table for simple cases.
- **Monorepo tooling**: Turborepo (TS), Nx (TS/polyglot), pnpm workspaces (light).
- **Container / orchestration**: Docker (always for parity), then Kubernetes (multi-service scale), ECS/Fargate (AWS-managed), Fly.io / Render (simpler).
- **Specialized databases**: DynamoDB (key-value at scale), PlanetScale / Vitess (MySQL at scale), Turso/LibSQL (edge SQLite), pgvector / Pinecone / Weaviate / Qdrant (vector search for AI), TimescaleDB (time-series), Neo4j (graph). Vector stores tie into `python-ai-services`.

---

### Confirmed Stack
Once you have answered the above, I will summarize the confirmed stack
and proceed to generate the Workscope document.

---

### AI Recommendation Format

Add to each category after the options table:

```markdown
### Frontend (Web)
[options table as above]

**AI Recommendation**: **Next.js**
> Your project requires SEO (public-facing pages) and has real-time features (dashboard). Next.js with App Router handles both with server components for SEO and client components for real-time updates. React + Vite would work but loses SSR for SEO pages.
>
> Your requirements mentioned Vite — this is fine for an internal tool, but if any page is public-facing, Next.js is the stronger choice.

**Your choice (or confirm AI recommendation):** ___
```

Apply this format to every category: frontend, mobile, backend, database, cloud, auth, third-party services.

Two non-negotiables for every recommendation:
1. **Versions are verified online, never from memory** (development-rules Rule 31): check nodejs.org/releases, endoflife.date, npm/PyPI before writing a runtime or framework version into the workscope.
2. **Database recommendations cite the decision matrix above**: name which data-shape answers drove the choice. The chosen option plus its revisit trigger is recorded in `AI_DOCS/memory/stack.md` (`## Selection rationale` → Database) per `rules/tech-stack-selection-rules.md`, not only in `decision-log.md`.

### After confirmation: persist the stack (do not stop at Deliverables)

Once the user confirms every category, follow SKILL.md Phase 2 **Step 6**:
- Write the full confirmed stack to `AI_DOCS/memory/stack.md` (names in frontmatter, `stack_confirmed: true` + `stack_confirmed_date`, and a `## Selection rationale` section per category: reason chosen, alternatives considered, revisit trigger).
- Record a stack ADR in `AI_DOCS/architecture/adrs/` (every project, single-service included): options considered, decision, and architecture reasoning (scale path, data shape, boundaries, failure modes).

The client-facing **Confirmed Stack** summary and the workscope **Deliverables** section are NOT a substitute for `stack.md` or the ADR. Governing rule: `rules/tech-stack-selection-rules.md`.
