# Technology Standards

> **Purpose**: Centralized technology stack specifications using dynamic LTS/Stable version references  
> **Audience**: Developers, architects, designers  
> **Philosophy**: Always use the **Latest LTS** (Long-Term Support) or **Latest Stable** version unless project constraints dictate otherwise.

---

## Overview

This document centralizes all technology stack requirements. Instead of hardcoded versions, all specifications reference **dynamic targets** (e.g., "Latest LTS") to ensure the stack is always current without manual updates.

> [!IMPORTANT]
> **Golden Rule**: When starting a new project, always run the automated version check script (see Section 9) or consult the official source links to get the current version numbers.

---

## 0. Technology Selection Wizard

> [!IMPORTANT]
> **For New Projects**: Before starting development, present these options to the user. Let them choose based on their context. Skip this section if technology is already decided.

### How This Works

1. AI presents technology choices as **Option A / B / C**
2. Each option includes **Recommendation Score** based on:
   - 💼 **Business Fit** (cost, time-to-market, team expertise)
   - 🏗️ **Architecture Fit** (scalability, maintainability)
   - 📊 **Traffic/Scale** (expected users, data volume)
   - 🎯 **Use Case Match** (specific feature requirements)
3. User selects an option or asks for hybrid
4. Selection is recorded in `AI_DOCS/implementation-plan.md`

---

### 0.1 Backend Framework Selection

**Question to User**: "What is your backend framework preference?"

| Option | Framework | Best For | Recommendation |
|--------|-----------|----------|----------------|
| **A** | **NestJS** (Node.js) | Enterprise apps, microservices, strict architecture | ⭐⭐⭐⭐⭐ Production-Grade |
| **B** | **Express.js** (Node.js) | Simple APIs, rapid prototyping, flexibility | ⭐⭐⭐⭐ MVP/POC |
| **C** | **Fastify** (Node.js) | High-performance APIs, low latency | ⭐⭐⭐⭐ High-Traffic |

**Decision Matrix**:

| Criteria | Option A (NestJS) | Option B (Express) | Option C (Fastify) |
|----------|-------------------|--------------------|--------------------|
| 💼 Business | Higher initial cost, lower long-term maintenance | Fast to market, higher tech debt | Medium cost, specialized |
| 🏗️ Architecture | Enforced patterns, DI, modular | Flexible, can become messy | Structured, plugin-based |
| 📊 Traffic | Good (optimized) | Good | Excellent (fastest) |
| 🎯 Use Case | Enterprise, multi-team | Startup, solo dev | Performance-critical |

**Default**: **Option A (NestJS)** for Production-Grade projects.

---

### 0.2 Database Selection

**Question to User**: "What is your primary database preference?"

| Option | Database | Best For | Recommendation |
|--------|----------|----------|----------------|
| **A** | **PostgreSQL** | Relational data, ACID compliance, complex queries | ⭐⭐⭐⭐⭐ Default Choice |
| **B** | **MongoDB** | Document data, flexible schema, rapid iteration | ⭐⭐⭐⭐ Content/Catalog Apps |
| **C** | **PostgreSQL + MongoDB** | Hybrid needs (relational + documents) | ⭐⭐⭐ Complex Apps |

**Decision Matrix**:

| Criteria | Option A (PostgreSQL) | Option B (MongoDB) | Option C (Hybrid) |
|----------|----------------------|--------------------|--------------------|
| 💼 Business | Standard, many tools | Faster prototyping | Higher complexity |
| 🏗️ Architecture | Schema-first, migrations | Schema-flexible | Mixed patterns |
| 📊 Traffic | Excellent with proper indexing | Excellent for reads | Depends on design |
| 🎯 Use Case | E-commerce, Finance, Healthcare | CMS, Catalogs, Logs | Multi-domain apps |

**Default**: **Option A (PostgreSQL)** for most applications.

---

### 0.3 Frontend Framework Selection

**Question to User**: "What is your frontend framework preference?"

| Option | Framework | Best For | Recommendation |
|--------|-----------|----------|----------------|
| **A** | **Next.js** (React) | SEO, SSR/SSG, full-stack features | ⭐⭐⭐⭐⭐ Production Web Apps |
| **B** | **Vite + React** | SPAs, dashboards, fast dev experience | ⭐⭐⭐⭐ Admin Portals |
| **C** | **Remix** (React) | Data-heavy apps, progressive enhancement | ⭐⭐⭐ Form-Heavy Apps |

**Decision Matrix**:

| Criteria | Option A (Next.js) | Option B (Vite+React) | Option C (Remix) |
|----------|--------------------|-----------------------|-------------------|
| 💼 Business | Standard, large ecosystem | Fast development | Newer, growing |
| 🏗️ Architecture | App Router, Server Components | Client-only, flexible | Nested routes, loaders |
| 📊 Traffic | Excellent (SSR/SSG) | Good (CDN for static) | Good (streaming) |
| 🎯 Use Case | E-commerce, Marketing, Blogs | Dashboards, Internal Tools | CRUD Apps |

**Default**: **Option A (Next.js)** for public-facing applications.

---

### 0.4 Styling Approach Selection

**Question to User**: "What is your styling preference?"

| Option | Approach | Best For | Recommendation |
|--------|----------|----------|----------------|
| **A** | **Vanilla CSS** (CSS Modules) | Maximum control, design system teams | ⭐⭐⭐⭐ Custom Designs |
| **B** | **TailwindCSS** | Rapid prototyping, utility-first | ⭐⭐⭐⭐⭐ Fast Development |
| **C** | **Shadcn/ui + Tailwind** | Component library with customization | ⭐⭐⭐⭐⭐ Production Apps |

**Decision Matrix**:

| Criteria | Option A (Vanilla) | Option B (Tailwind) | Option C (Shadcn) |
|----------|--------------------|--------------------|-------------------|
| 💼 Business | Slower, more control | Fastest | Fast + Consistent |
| 🏗️ Architecture | BEM, SCSS | Utility classes | Component-based |
| 📊 Traffic | Smallest bundle | Purged CSS | Slightly larger |
| 🎯 Use Case | Custom branding | Generic apps | Production apps |

**Default**: **Option C (Shadcn/ui + Tailwind)** for production applications.

---

### 0.5 Authentication Strategy Selection

**Question to User**: "What is your authentication strategy preference?"

| Option | Approach | Best For | Recommendation |
|--------|----------|----------|----------------|
| **A** | **Custom JWT** | Full control, specific requirements | ⭐⭐⭐⭐ Custom Enterprise |
| **B** | **NextAuth.js / Auth.js** | Social logins, quick setup | ⭐⭐⭐⭐⭐ Web Apps |
| **C** | **Auth0 / Clerk** | Managed auth, compliance needs | ⭐⭐⭐⭐ Enterprise SSO |

**Decision Matrix**:

| Criteria | Option A (Custom) | Option B (NextAuth) | Option C (Managed) |
|----------|-------------------|---------------------|---------------------|
| 💼 Business | Dev time cost | Free, quick | Paid, feature-rich |
| 🏗️ Architecture | Full control | Adapter pattern | Vendor lock-in |
| 📊 Traffic | Self-managed | Self-hosted | Vendor SLA |
| 🎯 Use Case | Specific needs | Standard apps | Enterprise SSO |

**Default**: **Option A (Custom JWT)** for full control, **Option B** for quick start with social logins.

---

### 0.6 Recording User Selection

After user makes selections, record in `AI_DOCS/implementation-plan.md` Section 2.1:

```markdown
## 2.1 Technology Selection

| Category | Selection | Rationale |
|----------|-----------|-----------|
| Backend | Option A: NestJS | Production-grade architecture needed |
| Database | Option A: PostgreSQL | ACID compliance for financial data |
| Frontend | Option A: Next.js | SEO required for public pages |
| Styling | Option C: Shadcn/ui | Fast development with consistency |
| Auth | Option B: NextAuth.js | Social logins required |
```

> [!NOTE]
> **If User Skips Selection**: Use the **Default** options listed above for each category.

---

### 0.7 MCP Server Recommendations

> [!TIP]
> **MCP (Model Context Protocol) servers** enhance AI capabilities for your specific tech stack.

After technology selection, AI should check for beneficial MCP servers based on your choices.

| Your Selection | Recommended MCP Server | Benefit |
|----------------|----------------------|---------|
| **MongoDB** | `mongodb-mcp-server` | Direct DB queries, schema inspection |
| **PostgreSQL** | `postgres-mcp-server` | SQL execution, migration help |
| **Next.js** | `next-devtools` | Runtime errors, route diagnostics |
| **Shadcn/ui** | `shadcn` | Component search, add commands |
| **MUI** | `mui-mcp-server` | Component documentation |
| **Google Maps** | `gmp-code-assist` | Maps API guidance |

**See**: [mcp-server-recommendations.md](mcp-server-recommendations.md) for:
- Full MCP server catalog
- Setup instructions
- Connection configuration

---

## 1. Backend Technology Stack

### Runtime & Framework

| Technology | Version Policy | Official Source | How to Verify |
|------------|----------------|-----------------|---------------|
| **Node.js** | Latest **LTS** | [nodejs.org/en/about/releases](https://nodejs.org/en/about/releases) | `node -v` |
| **NestJS** | Latest **Stable** | [docs.nestjs.com](https://docs.nestjs.com/) | `npm view @nestjs/core version` |
| **Express.js** | Latest **Stable** (4.x line) | [expressjs.com](https://expressjs.com/) | `npm view express version` |
| **TypeScript** | Latest **Stable** | [typescriptlang.org](https://www.typescriptlang.org/) | `npm view typescript version` |

### Database

| Technology | Version Policy | Official Source | Notes |
|------------|----------------|-----------------|-------|
| **PostgreSQL** | Latest **Stable** | [postgresql.org/support/versioning](https://www.postgresql.org/support/versioning/) | Use latest major for new projects |
| **MongoDB** | Latest **Stable** | [mongodb.com/docs](https://www.mongodb.com/docs/) | Community or Atlas |
| **Redis** | Latest **Stable** | [redis.io/downloads](https://redis.io/download/) | Check for LTS variants |

**Decision Guide**:
- Use **PostgreSQL** for: E-commerce, financial, healthcare (requires ACID compliance)
- Use **MongoDB** for: Content management, catalogs, rapid prototyping (flexible schema)
- Use **Redis** for: Session storage, caching, pub/sub messaging

### Authentication & Security

| Technology | Version Policy | Official Source |
|------------|----------------|-----------------|
| **jsonwebtoken** | Latest Stable | [npmjs.com/package/jsonwebtoken](https://www.npmjs.com/package/jsonwebtoken) |
| **bcrypt** | Latest Stable | [npmjs.com/package/bcrypt](https://www.npmjs.com/package/bcrypt) |
| **helmet** | Latest Stable | [helmetjs.github.io](https://helmetjs.github.io/) |
| **express-rate-limit** | Latest Stable | [npmjs.com/package/express-rate-limit](https://www.npmjs.com/package/express-rate-limit) |

### ORM / ODM

| Technology | Version Policy | Database | Official Source |
|------------|----------------|----------|-----------------|
| **Prisma** | Latest Stable | PostgreSQL | [prisma.io](https://www.prisma.io/) |
| **Mongoose** | Latest Stable | MongoDB | [mongoosejs.com](https://mongoosejs.com/) |
| **TypeORM** | Latest Stable | Multi-DB | [typeorm.io](https://typeorm.io/) |

---

## 2. Frontend Technology Stack

### Framework & Build Tools

| Technology | Version Policy | Official Source | How to Verify |
|------------|----------------|-----------------|---------------|
| **React** | Latest **Stable** | [react.dev](https://react.dev/) | `npm view react version` |
| **Next.js** | Latest **Stable** | [nextjs.org](https://nextjs.org/) | `npm view next version` |
| **Vite** | Latest **Stable** | [vitejs.dev](https://vitejs.dev/) | `npm view vite version` |
| **TypeScript** | Latest **Stable** | [typescriptlang.org](https://www.typescriptlang.org/) | `npm view typescript version` |

**Decision Guide**:
- Use **Next.js** for: SEO-critical apps, e-commerce, blogs (needs SSR/SSG)
- Use **Vite + React** for: SPAs, dashboards, internal tools (CSR sufficient)

### UI & Styling

| Technology | Version Policy | Use Case |
|------------|----------------|----------|
| **Vanilla CSS** | N/A | Maximum control, design systems (recommended default) |
| **TailwindCSS** | Latest Stable | Rapid prototyping, utility-first (use only if requested) |
| **CSS Modules** | N/A | Component-scoped styles |
| **Shadcn/ui** | Latest | Component library built on Radix UI |

**Default Approach**: Use **Vanilla CSS** unless user explicitly requests TailwindCSS.

### State Management

| Technology | Version Policy | Use Case |
|------------|----------------|----------|
| **React Context API** | Built-in | Simple state, small apps |
| **Zustand** | Latest Stable | Medium complexity, preferred over Redux |
| **TanStack Query** | Latest Stable | Server state management (API data) |

### Form Management

| Technology | Version Policy | Purpose |
|------------|----------------|---------|
| **React Hook Form** | Latest Stable | Form state and validation |
| **Zod** | Latest Stable | Schema validation (works with React Hook Form) |

---

## 3. Testing Stack

### Unit Testing

| Technology | Version Policy | Purpose |
|------------|----------------|---------|
| **Jest** | Latest Stable | Unit testing framework |
| **Vitest** | Latest Stable | Vite-optimized testing (alternative to Jest) |
| **@testing-library/react** | Latest Stable | React component testing |

### Integration & E2E Testing

| Technology | Version Policy | Purpose |
|------------|----------------|---------|
| **Supertest** | Latest Stable | API integration testing (Node.js/Express) |
| **Playwright** | Latest Stable | E2E testing (recommended) |
| **Cypress** | Latest Stable | E2E testing (alternative) |

### Load & Security Testing

| Technology | Version Policy | Purpose |
|------------|----------------|---------|
| **k6** | Latest Stable | Load and performance testing |
| **OWASP ZAP** | Latest Stable | Dynamic Application Security Testing (DAST) |
| **Snyk** | Latest | Dependency vulnerability scanning |

---

## 4. Code Quality & Analysis

### Static Analysis

| Technology | Version Policy | Purpose |
|------------|----------------|---------|
| **SonarQube** | Latest Stable (Community/Enterprise) | Code quality, security, maintainability |
| **ESLint** | Latest Stable | JavaScript/TypeScript linting |
| **Prettier** | Latest Stable | Code formatting |

**SonarQube Quality Gate Criteria** (Production-Grade):
- ✅ Zero critical/blocker issues
- ✅ Security Rating: A
- ✅ Reliability Rating: A
- ✅ Maintainability Rating: A or B
- ✅ Code Coverage: 98%+ on lines, branches, and functions (unit tests)
- ✅ Duplicated Lines: < 3%

---

## 5. DevOps & Deployment

### Containerization

| Technology | Version Policy | Purpose |
|------------|----------------|---------|
| **Docker** | Latest Stable | Containerization |
| **Docker Compose** | Latest Stable | Multi-container orchestration |

### CI/CD

| Platform | Use Case |
|----------|----------|
| **GitHub Actions** | CI/CD for GitHub projects |
| **GitLab CI/CD** | CI/CD for GitLab projects |
| **Jenkins** | Self-hosted CI/CD |

### Cloud Platforms

| Platform | Use Case |
|----------|----------|
| **AWS** | Enterprise deployments, complex infrastructure |
| **Vercel** | Next.js deployments (frontend focus) |
| **Railway** | Full-stack deployments (simple alternative) |
| **DigitalOcean** | Simple deployments, cost-effective |

---

## 6. Monitoring & Observability

| Technology | Version Policy | Purpose |
|------------|----------------|---------|
| **Prometheus** | Latest Stable | Metrics collection |
| **Grafana** | Latest Stable | Metrics visualization |
| **Winston** | Latest Stable | Application logging (Node.js) |
| **Pino** | Latest Stable | High-performance logging (alternative) |
| **Sentry** | Latest | Error tracking and monitoring |

---

## 7. API Documentation

| Technology | Version Policy | Purpose |
|------------|----------------|---------|
| **Swagger / OpenAPI** | 3.x (spec) | REST API documentation standard |
| **Swagger UI** | Latest Stable | Interactive API documentation viewer |

---

## 8. Accessibility Standards

| Standard | Compliance Level | Requirement |
|----------|------------------|-------------|
| **WCAG** | 2.1 Level AA | Minimum requirement for all production applications |
| **ARIA** | 1.2 | Use for complex interactive components |

---

## 9. Automated Version Check

To ensure you're always using the latest LTS/Stable versions, use this script at project start:

### Script: `check-versions.sh`

```bash
#!/bin/bash
# Run this script to get current latest stable versions

echo "=== Current Latest Stable Versions ==="
echo ""

# Node.js LTS
echo "Node.js LTS: $(curl -s https://nodejs.org/dist/index.json | jq -r '[.[] | select(.lts != false)] | .[0].version')"

# Core packages
echo "Next.js: $(npm view next version)"
echo "React: $(npm view react version)"
echo "TypeScript: $(npm view typescript version)"
echo "NestJS: $(npm view @nestjs/core version)"
echo "Express: $(npm view express version)"

# Testing
echo "Jest: $(npm view jest version)"
echo "Playwright: $(npm view @playwright/test version)"

# DB Tools
echo "Prisma: $(npm view prisma version)"
echo "Mongoose: $(npm view mongoose version)"

# UI
echo "TailwindCSS: $(npm view tailwindcss version)"

echo ""
echo "=== End of Version Check ==="
```

### GitHub Actions Workflow: `.github/workflows/version-check.yml`

```yaml
name: Tech Stack Version Check

on:
  schedule:
    - cron: '0 9 1 * *'  # Monthly on the 1st at 9 AM
  workflow_dispatch:     # Manual trigger

jobs:
  check-versions:
    runs-on: ubuntu-latest
    steps:
      - name: Check Latest Versions
        run: |
          echo "## Latest Stable Versions ($(date +'%Y-%m-%d'))" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "| Package | Latest Version |" >> $GITHUB_STEP_SUMMARY
          echo "|---------|----------------|" >> $GITHUB_STEP_SUMMARY
          echo "| Node.js LTS | $(curl -s https://nodejs.org/dist/index.json | jq -r '[.[] | select(.lts != false)] | .[0].version') |" >> $GITHUB_STEP_SUMMARY
          echo "| Next.js | $(npm view next version) |" >> $GITHUB_STEP_SUMMARY
          echo "| React | $(npm view react version) |" >> $GITHUB_STEP_SUMMARY
          echo "| TypeScript | $(npm view typescript version) |" >> $GITHUB_STEP_SUMMARY
          echo "| NestJS | $(npm view @nestjs/core version) |" >> $GITHUB_STEP_SUMMARY
          echo "| Prisma | $(npm view prisma version) |" >> $GITHUB_STEP_SUMMARY
          echo "| Playwright | $(npm view @playwright/test version) |" >> $GITHUB_STEP_SUMMARY
```

---

## 10. Quick Reference: Common Viable Options per Category

> [!IMPORTANT]
> **There is NO default stack.** This framework does not prescribe a preferred or "house" stack. Stack selection is requirement-first and decided per project against the discipline in `rules/tech-stack-selection-rules.md`, choosing from the option catalogue in `skills/workscope/TECH-OPTIONS.md`. The table below is a neutral menu of options commonly viable per category, not a list to "always use". Pick from it (or outside it) based on the project's actual requirements, constraints, and team expertise.

When a category is in scope, weigh these common options against the requirements. None is a default. Each carries trade-offs (learning curve, ecosystem maturity, hosting cost, team familiarity) to evaluate per project.

**Backend runtime / framework**:
- Node.js + NestJS, Express, or Fastify (TypeScript)
- Python + FastAPI or Django
- Go, Rust, or other runtimes where requirements justify them

**Database**:
- PostgreSQL or another relational engine (for relational, transactional data)
- MongoDB or another document store (for document-shaped data)
- Choice follows the data model, not preference

**ORM / data layer**:
- Prisma, Drizzle, or TypeORM (Node)
- SQLAlchemy or Django ORM (Python)
- Mongoose (MongoDB)

**Frontend**:
- Next.js, React, Vue, Angular, or SvelteKit (TypeScript)
- Styling: vanilla CSS, TailwindCSS, or a CSS-in-JS option
- State / data: Zustand, Redux, Jotai, TanStack Query, SWR, or RTK Query as the data model requires
- Forms / validation: React Hook Form, Zod, or equivalents

**Testing**:
- Jest, Vitest, Supertest, Playwright, or pytest, matched to the chosen stack

**Code quality**:
- ESLint + Prettier, SonarQube, or equivalents

**Security**:
- OWASP ZAP, Snyk, or equivalents

For version targets within a chosen technology, the **Latest LTS / Latest Stable** policy (Sections 0 and 9) still applies.

---

## 11. Version Lookup Resources

| Technology | Official EOL/Release Info |
|------------|---------------------------|
| Node.js | [endoflife.date/nodejs](https://endoflife.date/nodejs) |
| React | [endoflife.date/react](https://endoflife.date/react) |
| Next.js | [endoflife.date/nextjs](https://endoflife.date/nextjs) |
| PostgreSQL | [endoflife.date/postgresql](https://endoflife.date/postgresql) |
| MongoDB | [endoflife.date/mongodb](https://endoflife.date/mongodb) |
| TypeScript | [endoflife.date/typescript](https://endoflife.date/typescript) |

> [!TIP]
> Bookmark [endoflife.date](https://endoflife.date/) for quick reference on all major technologies' support timelines.

---

## 12. When to Deviate from "Latest"

Standards are guidelines, not rigid rules. You may deviate when:

✅ **Acceptable Reasons to Deviate**:
- Client/team has existing expertise in a specific version
- Project has existing codebase locked to a version
- Known breaking changes in the latest version affecting your use case
- Budget/time constraints requiring a proven stable version

❌ **NOT Acceptable Reasons to Deviate**:
- "I prefer X over Y" (personal preference without justification)
- "Let me try this new thing" (experimentation in production)

**Rule**: If you deviate, document the reason and the specific version locked in your project's `README.md` or `package.json`.

---

*Last Updated: 2026-06-23*  
*Version: 2.1.0: requirement-first stack selection, no default stack*  
*Part of AI_PROMPT Framework*  
*Auto-Check: Run `check-versions.sh` or GitHub Actions workflow monthly*
