---
name: design-screens
description: "Gates 4-5 of the design process: map UX flows per user role (auth, profile, search, notifications, errors), produce user journey maps, and build all production-ready screens with complete interaction coverage (every button, link, exit, error state mapped). Requires /design-tokens to have locked the component library. Produces the full screen inventory + interaction registry + handoff artifacts for /build. Use after /design-tokens completes. Also triggers on: 'Build screens', 'Production screens', 'User journeys', 'Gate 4', 'Gate 5', 'Design handoff', 'All screens for milestone'."
skip:
  - "Pick colors (use /design-discovery)"
  - "Build tokens (use /design-tokens)"
  - "One screen only (use platform skill with the tokens)"
next_skill: build
required_gate: "Gate 4+5 (Design Approved)"
allowed-tools: "Read Write Edit Grep Glob Bash(npm:*) Bash(npx:*) WebFetch"
skill_id: SK-047
context_budget:
  load_kb: 30
  scope: task
version: 1.9.0
license: Proprietary
compatibility: "Claude Code 1.x"
dependencies:
  required: [design-tokens, tech-specification]
  optional: [shadcn-ui, accessibility-audit, component-inspector]
produces:
  - path: AI_DOCS/design/sitemap.md
    consumers: [build, qa-testing, do]
  - path: AI_DOCS/design/navigation.md
    consumers: [build, qa-testing]
  - path: AI_DOCS/design/onboarding-flow.md
    consumers: [build, qa-testing]
  - path: AI_DOCS/design/ux-flows/
    consumers: [build, qa-testing]
  - path: AI_DOCS/design/screens/
    consumers: [build, qa-testing, accessibility-audit]
  - path: AI_DOCS/design/interaction-map.md
    consumers: [build, qa-testing]
consumes:
  - path: design-system/tokens.json
  - path: design-system/components/
  - path: AI_DOCS/design/component-registry.md
  - path: AI_DOCS/design/flow-validation-plan.md
  - path: AI_DOCS/design/flows/<flow-id>/chosen.md
  - path: AI_DOCS/planning/tech-spec.md
    required_sections: [user-roles, user-flows]
  - path: AI_DOCS/planning/frd.md
    required_sections: [features, acceptance-criteria]
metadata:
  author: WebOsmotic Private Limited
  category: infrastructure
  patterns: [sequential, context-aware]
  split_from: design-system
  split_in: 3.1.0
  role: "design-phase (gates 4-5)"
---

# /design-screens — UX Flows + Production Screens

> **SCOPE:** Gates 4–5 of the 5-gate design process. Consumes locked tokens.json + component library; produces the full screen inventory with every interaction mapped.

---

## Project Type Awareness (from v3.0 original, retained)

Screen coverage adapts to project classification:

| Type | Screens | Components | States | CRUD Parity |
|---|---|---|---|---|
| **POC** | 1–3 screens | Basic (no full system) | Default only | Not required |
| **MVP** | 10–15 screens | Basic library | Default + Error | Not required |
| **Production-Grade** | Unlimited (CRUD parity mandatory) | Full design system | All states | **Required** |

Production-Grade includes: all user-role screens, all component states, empty/loading/error states, responsive across all breakpoints, WCAG 2.2 AA compliance, dark mode (if configured), interactive prototypes, developer handoff documentation.

## Task-Based Design Rule (NON-NEGOTIABLE)

> [!CRITICAL]
> **NEVER design ALL screens upfront. Design ONLY for the current task/milestone.**

- Read `AI_DOCS/planning/milestones/milestone-N.md` for active milestone scope
- Screens outside the current milestone are NOT designed
- Future milestones get their own `/design-screens` run
- This prevents over-investment in designs that may change before implementation

## STRICT TECH STACK OVERRIDE

> [!IMPORTANT]
> Despite any instructions to use "Vanilla JS" or "HTML-only prototype", **always generate design artifacts in the confirmed tech stack** (e.g., React + Tailwind from `frontend-stack.md`).

- Output format: single-file components in the stack's native format (`.tsx`, `.vue`, `.tsx` for RN, etc.)
- No separate prototype — the code IS the prototype
- Developer must be able to copy-paste your output directly into the code folder

## Component Reusability

Before creating any new component, check `AI_DOCS/design/component-registry.md`:

- **Exists?** → Reuse it. Do not re-design.
- **Does not exist?** → Go back to `/design-tokens` briefly. Create it there, register it, then consume it here.

No ad-hoc components in screens.

## Reference Documents

| Doc | Purpose |
|---|---|
| `references/screen-design.md` | Full screen output format, directory mirror mandate, atomic consumption rules, CRUD parity spec |
| `references/accessibility.md` | WCAG 2.2 AA per-screen requirements, touch target sizes |
| `references/design-sync.md` | Design-to-code update flow |
| `templates/component-registry.md` | Template for AI_DOCS/design/component-registry.md |

---

## When to Run

| Trigger | Timing |
|---|---|
| `/design-tokens` completed | After Gate 3 passes |
| User says "build all screens" / "UX flows" | Explicit |
| Milestone design scope | Per milestone (build screens for that milestone's features) |

---

## Pre-flight

Read:

1. `design-system/tokens.json` — locked tokens
2. `design-system/components/` + `AI_DOCS/design/component-registry.md` — what's available
3. `AI_DOCS/planning/tech-spec.md` sections 3 (roles), 4 (flows)
4. `AI_DOCS/planning/frd.md` — features, acceptance criteria
5. `AI_DOCS/planning/milestones/milestone-N.md` — scope for this milestone
6. `rules/design-rules.md` — strict vs advisory enforcement, auth/nav/exit-path non-negotiables
7. `rules/design/auth-nav.md` (auth/navigation/exit-path principles) + the product's domain patterns in `rules/design/domains/<domain>.md` (router: `rules/design-language.md`)
8. `AI_DOCS/design/flow-validation-plan.md` (when present) + `AI_DOCS/design/flows/<flow-id>/chosen.md` for every flow with an approved row: the flow source Gate 4 derives from for Tier F flows

---

## Instructions

### Gate 3.5 — Information Architecture (sitemap, navigation, onboarding)

**Objective:** Before mapping flows or building screens, lock HOW the product is structured and connected. This closes three gaps: no page-connectivity map, no side-menu design, no onboarding plan.

Run this once per project (not per milestone) and extend it as new milestones add pages. Produces three artifacts:

1. **`AI_DOCS/design/sitemap.md`** — the navigation tree / page connectivity. Every page, its parent, its children, and which role(s) reach it. Machine-readable enough that QA can verify "no orphan page, no dead end."

   ```markdown
   # Sitemap

   - / (public landing) [Guest]
     - /login [Guest]
     - /signup [Guest]
   - /app (authenticated shell) [End User, Admin]
     - /app/dashboard [End User, Admin]   ← default after login
     - /app/items [End User, Admin]
       - /app/items/:id [End User, Admin]
       - /app/items/new [End User]
     - /app/settings [End User, Admin]
     - /app/admin [Admin]                  ← Admin-only subtree
   ```

   Rules: every page links to at least one other page (no dead end); every authenticated page is reachable from the navigation; mark the post-login default landing page.

2. **`AI_DOCS/design/navigation.md`** — the side menu / primary navigation design.

   ```markdown
   # Navigation Design

   **Pattern**: [left sidebar | top nav | both]  (from design-dna.md)

   ## Menu items (in order)
   | Label | Icon | Route | Visible to roles | Active-state rule |
   |-------|------|-------|------------------|-------------------|
   | Dashboard | home | /app/dashboard | End User, Admin | exact match |
   | Items | list | /app/items | End User, Admin | prefix /app/items |
   | Admin | shield | /app/admin | Admin only | prefix /app/admin |
   | Settings | gear | /app/settings | End User, Admin | exact match |

   ## Behavior
   - Collapsed/expanded: [rule]
   - Mobile: [drawer | bottom tab | hamburger]
   - Active indicator: [highlight + icon fill]
   - Role-based items: hidden (not just disabled) when role lacks access, mirrors RBAC (tech-spec S3)
   - Secondary nav (avatar menu): [profile, settings, logout]
   ```

   **Derive "Visible to roles" from tech-spec Section 3 (RBAC):** every role named in the "Visible to roles" column MUST exist in tech-spec S3. A role that appears in `navigation.md` but not in S3 is a fail condition. The per-item role visibility MUST mirror S3 RBAC exactly: if S3 grants a route to a role, that nav item is visible to that role, and if S3 denies it, the item is hidden for that role. Do not invent roles or visibility rules here, read them from S3.

3. **`AI_DOCS/design/onboarding-flow.md`** — how a brand-new user gets from zero to first value.

   ```markdown
   # Onboarding Flow

   ## First-run journey
   1. Signup → email verify → [welcome / setup wizard?]
   2. Empty workspace → guided first action (create first item)
   3. [sample data? checklist? product tour?]

   ## Per-screen first-run (zero-data) hooks
   - Dashboard with no data → [what shows]
   - Items list empty → [CTA copy]

   [Mermaid diagram of the first-run path]
   ```

   Mermaid diagrams MUST follow `rules/mermaid-rules.md` (quote labels with special characters, no bare lowercase `end`, validate in mermaid.live).

**IA-to-data-model reconciliation (BLOCKING, Track G):** the navigation must match the domain. Cross-check `sitemap.md` domain objects against `AI_DOCS/architecture/database-schema.md`:
- Every domain object reachable in the nav maps to a schema entity (no nav object without data behind it).
- Every core schema entity is reachable from the nav (no orphan entity the user can never see or manage).
- Misalignment here is a classic source of confusing enterprise UIs: fix the IA or the schema before building flows. Record as a row in the verdict table.

**Gate 3.5 approval:** user approves sitemap + navigation + onboarding before Gate 4. These feed tech-spec S21 (traceability) and the Planning Completeness Gate.

Record the result as a verdict table in the Gate 3.5 approval summary, one row per IA artifact, each `PASS` / `FAIL` / `N/A (reason)`. A `FAIL` blocks Gate 4, an `N/A` must carry a one-line reason.

| Artifact | Verdict | Reason (if N/A) |
|----------|---------|-----------------|
| sitemap.md | PASS / FAIL / N/A | |
| navigation.md | PASS / FAIL / N/A | |
| onboarding-flow.md | PASS / FAIL / N/A | |
| IA-to-data reconciliation | PASS / FAIL / N/A | |

On explicit approval, log telemetry:

```bash
bash hooks/log-event.sh "\"event\":\"gate.verdict\",\"gate\":\"G3.5-IA\",\"verdict\":\"pass\""
```

### Gate 4 — UX Flows by User Role

> [!CRITICAL]
> **Pre-flight halt (BLOCKING):** do not map any UX flow and do not build any screen unless all three Gate 3.5 IA artifacts are present or explicitly waived. Fail condition: any of `AI_DOCS/design/sitemap.md`, `AI_DOCS/design/navigation.md`, or `AI_DOCS/design/onboarding-flow.md` is missing AND is not marked `N/A` with a one-line reason in the Gate 3.5 verdict table. On a miss, stop and return to Gate 3.5, do not proceed.

**Objective:** Map every user-role's journey + every common flow.

**Approved journeys are the flow source (Tier F).** Before authoring any flow, read `AI_DOCS/design/flow-validation-plan.md`. For any flow with an approved row there, the approved journey at `AI_DOCS/design/flows/<flow-id>/chosen.md` IS the flow definition: Gate 4 derives its flow diagrams and screen sequences from that click-path map rather than re-authoring the flow. A Gate 4 flow diagram that contradicts an approved journey is a defect, routed back through Gate FLOW's regression (`/flow-prototypes`), never silently redrawn. Tier S flows, and flows with no row in the plan file, keep the authoring path below unchanged.

1. **Extract user roles** from tech-spec / FRD: Guest, End User, Admin, Manager, etc.

2. **Identify common / shared flows:**
   - Auth (signup, login, password reset, 2FA, session timeout)
   - Profile (view, edit, preferences, notifications, logout)
   - Search / filter
   - Notifications (in-app, email preferences)
   - Error handling (network down, permission denied, not found, server error)
   - Help / support (tooltips, docs, contact)
   - Settings (per-role)

3. **Create UX Flow Diagrams** for each role in `AI_DOCS/design/ux-flows/<role>.md`:

   ```markdown
   # UX Flow — End User

   ## Entry points
   - / (landing, unauthenticated)
   - /login (direct link)
   - Email magic link

   ## Happy path: login → dashboard → create item
   [Mermaid diagram]

   ## Edge cases
   - Invalid credentials → error message, retry allowed
   - Email unverified → verification prompt
   - Session expired mid-flow → re-auth modal
   - Server error → retry CTA + status page link
   ```

   Use Mermaid for diagrams: renders in GitHub + VS Code. Mermaid diagrams MUST follow `rules/mermaid-rules.md` (quote labels with special characters, no bare lowercase `end`, validate in mermaid.live).

4. **Cross-role journey connections:**
   - Guest → End User (signup flow)
   - End User → Admin (promotion path)
   - Shared touchpoints (e.g., notifications visible to multiple roles)

5. **User journey maps** for top 3 critical flows:
   - Touchpoints (every step)
   - Pain points (where friction exists)
   - Emotional journey (confused / frustrated / delighted)
   - Opportunities (where to improve)

6. **Gate 4 approval:** user must approve all flows before Gate 5.

### Gate 5 — Production-Ready Screens

**Objective:** Every screen in the milestone, production-quality, every interaction mapped.

1. **Screen inventory** from FRD + tech-spec. Output format per screen:

   ```
   AI_DOCS/design/screens/<screen-name>/
     README.md               # Screen brief
     desktop.tsx             # Primary layout (React / RN / framework)
     tablet.tsx              # If responsive layout differs
     mobile.tsx              # Mobile layout
     states/
       empty.tsx
       loading.tsx
       error.tsx
       partial.tsx
       success.tsx
   ```

2. **Screen brief template** (`README.md` per screen):

   ```markdown
   # Screen: <Name>

   **Route:** /path/:param
   **User role:** [Guest | End User | Admin]
   **Entry points:** [list of entries]
   **Exit points:** [back / close / logout / timeout / error]

   ## Purpose

   [One-paragraph what this screen does]

   ## Layout

   - Header: ...
   - Body: ...
   - Footer: ...

   ## Interactions

   Every interactive element, with destination:

   | Element | Action | Destination |
   |---|---|---|
   | "Submit" button | Validates + posts | /success OR inline error |
   | Back arrow | Browser back | previous route OR / |
   | Row click | Opens detail | /items/:id |
   | Avatar menu | Opens popover | [profile, settings, logout] |

   ## States

   - Default: [description]
   - Empty: [when + copy]
   - Loading: [skeleton vs spinner]
   - Error: [4xx vs 5xx differentiation]
   - Partial: [partial-data / slow-network]
   - Success: [temporary confirmation vs persistent]

   ## Edge cases

   - Access denied → 403 view + contact admin link
   - Not found → 404 with search suggestion
   - Server error → retry CTA + status page link
   - Session timeout → re-auth modal (preserves form state)

   ## Responsive breakpoints

   - Desktop (1024px+): [layout]
   - Tablet (768-1023px): [layout diff]
   - Mobile (320-767px): [layout diff]

   ## Accessibility notes

   - Heading hierarchy (h1 → h2 → h3)
   - Keyboard: Tab order + shortcuts
   - Screen reader: any aria-live regions, labels on form inputs
   - Focus trap in modals / dialogs
   - Color not the only differentiator (always paired with icon / text)

   ## Components used

   [Reference component-registry: Button, Input, Card, DataTable, ...]
   ```

3. **CRUD parity** (Production-Grade projects):
   Every entity has Create / Read / List / Update / Delete screens; no missing CRUD operation for any primary entity.

4. **Directory mirror mandate:**
   Screen paths in `AI_DOCS/design/screens/` mirror the code routes. `/users/:id/edit` → `AI_DOCS/design/screens/users/_id_/edit/`.

5. **Atomic consumption:**
   Every screen uses only atoms from `component-registry.md` + layout atoms. If a new primitive is needed, it goes back to `/design-tokens` for approval + registry entry — not created ad-hoc.

6. **Interaction map:**
   Aggregate `AI_DOCS/design/interaction-map.md` lists EVERY interactive element across all screens with destinations. QA uses this as a test matrix; `build` uses it as an acceptance check.

### Enterprise state coverage (mandatory per meaningful surface, Track G)

Consumer apps can ship the happy path. Enterprise cannot. Every meaningful surface designs its FULL state set, not the populated case only. This is a non-skippable checklist (the thing that separates "looks great in the pitch" from "survives a real tenant's data"):

| State | Requirement | Common miss |
|---|---|---|
| Empty: first-run | Composed: icon/illustration + reason + a primary action ("No orders yet" + Create) | text-only gray sentence, no action |
| Empty: filtered-to-zero | DISTINCT from first-run: "No results for these filters" + Clear filters | lumped with first-run |
| Loading / skeleton / partial | Skeleton matching the real layout (not a centered spinner); partial-load handled | bare spinner for a content region |
| Populated at REALISTIC density | Designed for ~10,000 rows, long strings, many columns (use the high-density fixtures from `/mock-data`) | demo with 3 rows that lies about the real layout |
| Error: network | Distinct treatment + retry | one generic "something went wrong" |
| Error: validation | Inline, field-level, plain-language | global banner only |
| Error: server (5xx) | Distinct + retry/escalate | merged with network |
| Error: permission-denied (403) | Read-only or access-denied view per role | missing |
| No-permission / read-only per role | The same surface rendered read-only for a role with reduced rights | only the full-access version designed |
| Bulk-selection / bulk-action | Selection state + bulk-action bar where lists allow multi-select | missing entirely |

### List operations decision (per list/table surface)

For every list or table surface, decide and record whether it needs pagination, sort, search, and filter. Default: all four are must-have for any list of records that can grow. A small, bounded, fixed list (roughly under 100 rows that cannot grow, e.g. a status enum or a short settings menu) MAY omit them, recorded with an explicit reason. If it is genuinely unclear whether a list needs them, ASK the user (one question, options + a recommended default) rather than guessing. All four, when present, are BACKEND-driven (the UI sends params, the server returns one page, per `api-rules.md` Rules 27-28 and `frontend-rules.md`). Record the decision in the interaction registry so the backend contract and the `behavior` validator both have it.

### Permission-gated UI map (frontend stays in sync with RBAC)

The UI must reflect the permission model, not just look pretty. In the interaction registry (`interaction-map.md`), every permission-gated control, field, and route records the permission(s) that gate it and its `data-perm` / `data-perm-field` attribute (the bridge the `authz-matrix` Playwright layer locates by). This makes the frontend a verified consumer of `authz-matrix.yaml`, the same way it consumes `api-contract.md`:
- Every gated action control (create/edit/delete/approve/assign) carries `data-perm="<resource>.<action>"`; every sensitive field carries `data-perm-field="<resource>.<field>"`; every gated route is in the map.
- The rendered state per the user's EFFECTIVE permissions: control present+enabled (has the permission), hidden or disabled (lacks it), field editable / read-only / masked / absent. In dynamic mode this is keyed on the permission, not the role name.
- Dependency-disabled state: a control whose permission has an unmet dependency (e.g. Assign without `user.read`) is disabled WITH a reason ("you need user-read to assign"), never broken-but-clickable.
- Every entry maps to an `authz-matrix.yaml` cell. A gated control with no matrix cell, or a matrix capability with no UI treatment, is FRONTEND-RBAC DRIFT, flagged by `drift-detector.sh` (Phase G) and proven at runtime by the `authz` validator's Playwright UI layer. So the frontend can neither show a control the permissions forbid nor hide a capability the user is entitled to.

### Security & error states (mandatory per screen)

- Session timeout (re-auth modal preserves form state)
- Step-up re-authentication on sensitive actions (per `ux-brief.md` security-UX)
- Sensitive-data masking on flagged fields (reveal on explicit action)
- Access denied (403)
- Hard refresh with stale state
- Loading > 2s (show skeleton)
- Optimistic update failure (rollback UI)
- Destructive action: prefer Undo (snackbar) over a confirm dialog where reversible

### Auth / Navigation / Exit-path Gate (BLOCKING)

> [!CRITICAL]
> This checklist runs once before Gate 5. It is not advisory. If the app needs any item below and the screen inventory is missing it, **Gate 5 fails** until the gap is designed. Enforces `rules/design-rules.md` → Auth / navigation / exit-path non-negotiables.

Determine first what the app actually needs:

- **Needs auth?** True if the tech-spec defines any authenticated role, login, accounts, or per-user data. A purely public single-page site does not.
- **Needs multi-screen navigation?** True if there is more than one authenticated destination.

Then verify, and fail the gate on any miss:

| # | Check | Applies when | Fail condition |
|---|-------|--------------|----------------|
| 1 | Sign-in path | App needs auth | No login/signup entry reachable from the public surface |
| 2 | Sign-out path | App needs auth | No visible logout from the authenticated shell (in the avatar/secondary menu per `navigation.md`) |
| 3 | Session-edge flows | App needs auth | Missing any of: password reset, session-timeout re-auth, and (if tech-spec requires) 2FA / email verification |
| 4 | Back / exit affordance | Every non-root screen | Any screen past the entry has no way back (top-left back arrow on mobile, breadcrumb or persistent nav on web, modal close). 99%+ of screens need one. |
| 5 | No dead-end screen | Multi-screen nav | Any screen with zero outbound navigation (cross-check `sitemap.md` "no dead end" rule) |
| 6 | Post-login landing | App needs auth | Default authenticated landing page not marked in `sitemap.md` |
| 7 | Role-based nav visibility | RBAC in tech-spec | Nav items for a role the user lacks are merely disabled, not hidden (mirrors RBAC, `navigation.md`) |
| 8 | Primary action per screen | All | A screen has no discernible primary action or its CTA is ambiguous (one clear primary per screen, per `rules/design/auth-nav.md` C.3) |

Record the result as a short table in the Gate 5 approval summary: each check `PASS` / `FAIL` / `N/A (reason)`. A `FAIL` blocks; an `N/A` must carry a one-line reason (e.g. "public marketing page, no auth").

### Gate 5 approval

User reviews:
- Screen inventory completeness (every FRD feature has a screen)
- Responsive coverage for all breakpoints
- Interaction map completeness (no dead ends, no unlabeled buttons)
- CRUD parity (Production-Grade only)
- Accessibility notes per screen

On explicit approval:

- `AI_DOCS/memory/gate-status.md`: Gate 3 → PASS (full, not just tokens)
- Telemetry:
  ```bash
  bash hooks/log-event.sh "\"event\":\"gate.verdict\",\"gate\":\"G3-complete\",\"verdict\":\"pass\""
  ```

### Handoff

Print:

```
Production screens complete.
- Sitemap: AI_DOCS/design/sitemap.md
- Navigation: AI_DOCS/design/navigation.md
- Onboarding: AI_DOCS/design/onboarding-flow.md
- UX flows: AI_DOCS/design/ux-flows/
- Screens: AI_DOCS/design/screens/
- Interaction map: AI_DOCS/design/interaction-map.md

Next: /build to implement per milestone scope.
```

---

## Examples

### Example 1: Fintech — milestone 1 (auth + portfolio view)

**Actions:**

1. Read milestone-1.md: auth flow + portfolio dashboard
2. Read tech-spec roles: Guest + End User (individual investor)
3. Build UX flows: guest-signup, user-login, user-logout, user-password-reset
4. Build screens: /signup, /login, /forgot-password, /reset-password, /dashboard, /portfolio, /portfolio/:id
5. Every screen has 5 states + responsive + a11y
6. Interaction map captures: 47 interactive elements, 12 exit flows (logout, timeout, error, etc.)
7. Gate 5 PASS, handoff to `/build`

### Example 2: Internal test runner — milestone 2 (CI log browser)

**Actions:**

1. Read milestone-2.md: read-only log viewer + filter
2. Single role: Engineer
3. UX flows: enter-filters → view-results → drill-down-to-log → copy-paste-to-slack
4. Screens: /runs, /runs/:id, /runs/:id/logs
5. Dense layout, minimal states, no CRUD (read-only)
6. Interaction map: 12 elements, 3 exit flows
7. Gate 5 PASS

---

## Troubleshooting

### Missing FRD features in screen inventory

**Solution:** grep FRD features vs screens directory. Any orphan feature → add screen OR mark as out-of-scope in milestone-N.md (not silently dropped).

### New primitive needed mid-screen

**Solution:** stop. Go back to `/design-tokens` briefly. Build the primitive, register it, then resume. Don't embed it ad-hoc in a screen — causes drift.

### Responsive layouts drift from desktop

**Solution:** diff the tablet/mobile files against desktop structurally — should share the component tree, differ only in layout. If completely different structure, that's a smell — revisit the mobile-first pass.

### Accessibility gaps discovered late

**Solution:** invoke `/accessibility-audit --scope=screens` on the draft set. Fix before Gate 5 approval. Do not defer a11y to post-implementation.

### Interaction map incomplete (buttons without destinations)

**Solution:** every button, link, icon with a tap target needs a destination in the map. "TBD" or "?" → stop. Clarify with user before declaring Gate 5 ready.

---

## Rules

1. **Every screen uses atoms from component-registry.** No ad-hoc primitives.
2. **Every interactive element has a destination** in the interaction map.
3. **Every screen has 5 states** (default, empty, loading, error, partial/success).
4. **Responsive layouts required** at 320, 768, 1024+.
5. **Accessibility notes per screen**, not a blanket claim.
6. **CRUD parity** for Production-Grade; not optional.
7. **No dark mode styles** unless Design DNA permits.
8. **No hex / px** — tokens only.
9. **Directory structure mirrors code routes.**
10. **Gate 5 requires explicit user approval** — not auto-pass after screen build.
11. **Gate 3.5 (IA) runs once before flows**: sitemap, navigation, and onboarding must exist and be approved before Gate 4. No orphan pages, no dead ends, role-based menu visibility mirrors RBAC.
12. **Auth / Navigation / Exit-path Gate is BLOCKING**: when the app needs auth or multi-screen nav, the 8-point checklist must pass before Gate 5. Missing sign-in/out, a back/exit affordance, or a dead-end screen fails the gate. Never silently ship an app without its front door or back button.

## Next Step

`/build` implements the screens for the active milestone.

<!-- Version: 1.5.0 — 2026-06-29 — Track G: Gate 3.5 gains IA-to-data-model reconciliation (sitemap domain objects vs database-schema.md); enterprise state-coverage matrix made mandatory per surface (first-run vs filtered-empty, realistic 10k density, four error types, read-only per role, bulk); security states add step-up re-auth, masking, undo-over-confirm; WCAG 2.1 -> 2.2 AA. -->
<!-- Version: 1.9.0 | 2026-08-21 | Gate 4 consumes approved journey prototypes as the flow source for Tier F flows: flow-validation-plan.md approved rows point at flows/<flow-id>/chosen.md, Gate 4 derives diagrams and screen sequences from the click-path, contradictions route back through Gate FLOW regression instead of silent redraws. Tier S and un-rowed flows keep the existing authoring path. -->

