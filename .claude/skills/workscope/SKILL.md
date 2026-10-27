---
name: workscope
description: "Generate client-facing scope documents in two versions: a short Ballpark quote (releases, 1 to 3 diagrams, MVP committed cost, future phases tentative, client questions) or the Final 12-section work scope (dated milestones with acceptance criteria, investment and payment, priced tentative future phases). Decides the scope strategy first (full quote, client MVP, or MVP-first default) on an operator card, runs a one-batch output intake, reads the requirements baseline. Triggers on: 'Create workscope', 'Ballpark quote', 'Work scope', 'Proposal'."
effort: xhigh
next_skill: tech-specification
required_gate: null
skill_id: SK-072
context_budget:
  load_kb: 30
  scope: task
version: 3.1.0
dependencies:
  required: [session-management]
  optional: [requirement-finalization, estimation, docx-from-markdown]
consumes:
  - path: "AI_DOCS/planning/requirements-baseline.md"
    required_sections: [finalized-requirements, decisions, open-items]
    optional: true
  - path: "AI_DOCS/ingested/manifest.md"
    optional: true
  - path: "AI_DOCS/estimation/estimation-v<N>.json"
    optional: true
  - path: "AI_DOCS/planning/workscope-intake.md"
    optional: true
produces:
  - path: "AI_DOCS/planning/scope-strategy.md"
    consumers: [operator, estimation]
  - path: "AI_DOCS/planning/workscope-intake.md"
    consumers: [workscope]
  - path: "AI_DOCS/planning/workscope.md"
    consumers: [tech-specification, estimation, project-brief, docx-from-markdown, landing-page]
  - path: "AI_DOCS/planning/diagrams/*.png"
    consumers: [docx-from-markdown]
  - path: "AI_DOCS/planning/workscope-review-note.md"
    consumers: [operator]
  - path: "AI_DOCS/planning/workscope.docx"
    consumers: [client]
  - path: "AI_DOCS/planning/versions/workscope-v<N>.docx"
    consumers: [client]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---
# Workscope Skill

> **Purpose**: Generate a professional, client-facing Work Scope document from a requirements discussion or brief.
> **Output**: `AI_DOCS/planning/workscope.md` (the source of truth), its diagrams in `AI_DOCS/planning/diagrams/`, the operator-facing `AI_DOCS/planning/workscope-review-note.md`, and on approval the branded `AI_DOCS/planning/workscope.docx` rendered from the Markdown (always the latest), with an immutable numbered copy per version at `AI_DOCS/planning/versions/workscope-v<N>.docx`.
> **When to Use**: Before the Technical Specification. This is the client-facing agreement document. The Tech Spec is the internal developer document.

> [!CRITICAL]
> **THE MARKDOWN IS THE SOURCE. THE DOCX IS RENDERED FROM IT, NEVER WRITTEN BY HAND.**
> This skill writes `AI_DOCS/planning/workscope.md` and generates its diagrams. The client-facing Word document is produced only by `docx-from-markdown` (`--mode cover`) from that Markdown, in Post-Generation step 7. Edits go into the Markdown and are re-rendered, never into the DOCX. A PDF, when wanted, is exported from the rendered DOCX.

> [!IMPORTANT]
> **Two versions, one source file.** The intake (Phase 0.6) picks the variant, and the frontmatter carries it as `variant: ballpark` or `variant: final`:
>
> | Variant | Template | Purpose | Order |
> |---|---|---|---|
> | **Ballpark** | `BALLPARK-TEMPLATE.md` | Short quote that wins the conversation: what we build per release, 1 to 3 images, MVP committed cost, future phases tentative, client questions | scope strategy, estimate, ballpark document |
> | **Final** | `WORKSCOPE-TEMPLATE.md` | The 12-section ZENi5 work scope that referees delivery: dated milestones with acceptance lines, investment and payment schedule, priced tentative future phases | scope strategy, workscope, estimate, cost filled, cross-check |
>
> Either way the workscope stays ONE file (`AI_DOCS/planning/workscope.md`), and the DOCX conversion is mechanical: `docx-from-markdown --mode cover --version <N>` renders the Markdown one to one. Cover fields (title, subtitle, presented_to, presented_by, date, validity_days, closing, version, variant) travel as YAML frontmatter, with `date` in human form (`8th September 2026`), never ISO. `closing: "THANK YOU"` renders the centred bold closing line. `version` is bumped on every revision and passed to `--version`, which keeps the numbered copy. The old 13-section commercial variant is retired: its investment table and payment terms live in the final Section 6, its Why WebOsmotic, Relevant Experience, Next Steps and Acceptance blocks are optional sections in both variants.

---

## Initialization

> [!NOTE]
> **Gated Approach**: Memory initialization handled by [session-management](../session-management/SKILL.md). Gate status checked before skill handoff.

---

## Distinction: Workscope vs Technical Specification

| Aspect | Workscope | Technical Specification |
|--------|-----------|------------------------|
| Audience | Client / Stakeholder | Developer / AI Agent |
| Language | Business / plain English | Technical / precise |
| Content | What will be built, milestones, cost | How it will be built, APIs, schemas, flows |
| Budget | `XXX` placeholder, or Committed hours x the operator's rate (MVP committed, future phases tentative) | Not included |
| Generated when | Before project starts | After workscope is approved |

---

## Phase 0: Baseline Pre-flight (before any question is asked)

> [!IMPORTANT]
> Interrogating a client about things their own documents already answer is the opposite of looking intelligent. Read first, then confirm instead of re-ask.

1. Read `AI_DOCS/planning/requirements-baseline.md` if it exists. Read its Section 9 readiness verdict first. "Not ready" means the High-impact questions it lists are asked before anything else, and the workscope stays a draft until they are answered or qualified. Honor each requirement's Basis tag: only Verified rows pre-fill answers, Assumption rows go to "Assumptions Made for This Scope" (Section 12) with the role that must confirm them, Proposed rows go to the draft review note as recommendations, and Open rows become questions. Pre-fill every discovery answer the baseline covers, each tagged with its `R-NNN` source reference. When a batch comes up in Phase 1, present the pre-filled answers as **confirm or correct**, never as fresh questions. Open items from the baseline's Section 5 clarification log become explicit questions in the matching batch, High impact first.
2. If no baseline exists, say there is no readiness verdict to rely on, then check `AI_DOCS/requirements/` and `AI_DOCS/ingested/manifest.md`. If the folder holds **more than one source**, recommend running `/requirement-finalization` first (conflicting sources produce a workscope that referees nothing). Log the recommendation in the working notes and proceed only if the user declines. A single clean source: read its ingested markdown and pre-fill from it the same way.
3. Nothing on disk: proceed with full conversational discovery.
4. **Read the delivered workscopes before drafting** (`REFERENCE-LIBRARY.md`).
   They are the source of the house pattern and settle what the template leaves
   open: how short Out of Scope really is, what a Deliverables line looks like,
   whether the cover carries a person or a company. The approved ZENi5 MVP work
   scope (version 36) is the current reference. Note the reading technique:
   Google Docs renders its editor to a canvas, so `WebFetch` returns 401 and
   `get_page_text` on an `/edit` URL returns menus. Use the `/mobilebasic` view,
   which renders plain HTML.

The writing discipline for the generated document is `rules/document-generation-rules.md`. This skill's purpose and audience are fixed (a client-facing scope agreement read by the client's decision-maker), so of the Rule 1 intake gate only **tone** remains to confirm, and intake question 6 (Phase 0.6) collects it.

---

## Phase 0.5: Scope Strategy (MANDATORY, before any document or estimate)

> [!CRITICAL]
> Read `SCOPE-STRATEGY.md`. Classify the requirement as **A. Full quote**, **B. Client-defined MVP**, or **C. MVP-first** (the default whenever the client has not asked for a full quote). Score every feature for interest signals across ALL documents in `AI_DOCS/requirements/` (or the baseline), citing source and line. Keep the essentials (primary journey, auth, roles, security, privacy, data integrity, deployment, monitoring) in the MVP, never cut to lower the number.

1. Write the operator decision card (case, proposed MVP list, proposed future phases list, evidence per feature, recommended default, the options when ambiguous) to `AI_DOCS/planning/scope-strategy.md` and show it in chat.
2. **Stop and wait for the operator.** Never decide the case silently. Never draft or estimate until the operator has answered.
3. Record the answer in the same file. It sets the estimate's milestones (`release`, `commitment`, `project.scopeCase`) and the document's release blocks: Committed release features in the build sections, Tentative phases in their own priced blocks.

---

## Phase 0.6: Output Intake (one batch, asked once)

Ask all seven questions in ONE message, each with its default for the variant. Save the answers to `AI_DOCS/planning/workscope-intake.md` and reuse them on every revision: re-ask only when the operator changes one.

| # | Question | Ballpark default | Final default |
|---|---|---|---|
| 1 | Ballpark quote or final work scope? | (asked) | (asked) |
| 2 | Include a milestone plan? | No | Yes |
| 3 | Show assumptions? | A few lines | Yes, Section 12 |
| 4 | Show out of scope? | A short list | Yes, Section 9 |
| 5 | Show future scope? | Yes in cases B and C, no in A | Yes in cases B and C (priced tentative phases), unplanned items in every case |
| 6 | Style? | To the point, images and diagrams, easy to read | Same |
| 7 | Include Why WebOsmotic and relevant case studies? | Yes, short: the fixed copy plus at most 2 case studies (it helps win the project) | Yes |

```markdown
# Workscope Intake

- **Variant:** ballpark
- **Milestone plan:** no
- **Assumptions:** a few lines
- **Out of scope:** short list
- **Future scope:** yes (case C)
- **Style:** to the point, images and diagrams, easy to read
- **Why WebOsmotic and case studies:** yes, short
- **Answered:** 14 October 2026, by [operator]
```

Question 6 also settles the document-generation-rules Rule 1 tone item, so Batch 1 does not ask tone again.

### Variant branch

| Step | Ballpark | Final |
|---|---|---|
| Phase 1 discovery | Only the questions the quote needs (table below), pre-filled from the baseline as confirm-or-correct | All 35 questions, 6 batches |
| Phase 1.5 Figma | Only if a link exists, summary and gap list only | Full |
| Phase 2 tech stack | Skipped, unless the stack changes the cost materially (rule below) | Full, mandatory |
| Phase 2.5 hidden challenges | Run internally, every challenge becomes a client question (Client-Problem Question Rule) | Full report, NEEDS CLARIFICATION resolved or carried to the review note |
| Estimate | REQUIRED before writing: hand off to `/estimation` with the scope strategy, then write | After the workscope is drafted, then cost filled and cross-checked |
| Document | `BALLPARK-TEMPLATE.md` | `WORKSCOPE-TEMPLATE.md` |

**Ballpark keeps these discovery questions:** 1, 2, 4, 5, 6 (identity), 7, 8, 9, 10 (platforms, roles, rough volume, login), 12 to 17 (features, payments, real-time, media, notifications, languages), 18 to 21 (integrations, compliance, data sensitivity, offline), 24 and 25 (design needed, Figma), 30, 31 and 34 (exclusions, later phases, rough launch date). It skips 3, 11, 22, 23, 26 to 29, 32, 33 and 35 (brand, feel, KPIs, payment split), which the final version collects.

**Ballpark tech-stack rule.** Skip Phase 2 unless the stack choice changes the cost materially: a native app per platform instead of one cross-platform app, a client-mandated technology the team must ramp up on, a regulated hosting requirement, or a hardware SDK that only one stack supports. Then run Phase 2 for that category only and record the choice in `stack.md` as usual. Never name the stack in the ballpark document.

---

## Phase 1: Discovery Questionnaire

> [!IMPORTANT]
> Final variant: run through ALL 35 questions before generating anything. Ballpark: only the questions listed in Phase 0.6. Group them in conversational batches, do not fire all at once. Start with batch 1, wait for answers, then move to batch 2. Questions the Phase 0 pre-flight already answered are presented as confirmations ("the brief says X, confirm?"), never re-asked from scratch.

### Batch 1: Project Identity

1. **Project Name**: What is the product/platform called?
2. **Client Name**: Who is this being presented to? (Company or individual)
3. **Prepared By**: Which company or team is building this?
4. **Project Description**: Describe the platform in 2 to 3 sentences. What problem does it solve and for whom?
5. **Project Type**: Is this a POC, MVP, or full Production-Grade system?
6. **Decision-Maker**: Who approves the scope and signs the proposal? (Name and role. The document is written for this reader.)

The **document tone** (`rules/document-generation-rules.md` Rule 1) is settled by intake question 6 in Phase 0.6. Do not ask it again here.

### Batch 2: Platform and Users

7. **Platform Targets**: Which platforms will the system run on?
   - Options: Web App, iOS App, Android App, Desktop App, API Only
   - Can be multiple (for example Web + Android + iOS)
8. **User Roles**: Who are the primary actors?
   - Example: Customer, Vendor, Admin, Employee, Super Admin
   - For each role: what is their core action in the system?
9. **User Volume (Estimate)**: What is the expected number of concurrent users at launch? And in 12 months?
   - This drives architecture and infrastructure decisions
10. **Authentication Method**: How will users log in?
    - Options: Email/Password, OTP (SMS/WhatsApp), Social Login (Google/Apple), SSO, Biometric
    - Multiple allowed (for example OTP + Social)
11. **Onboarding Model**: Can users self-register, or are they invited/approved by admin?

### Batch 3: Features and Business Logic

12. **Core Feature List**: List the main feature areas (rough is fine). Examples:
    - Booking management, Payments, GPS tracking, Notifications, Reports, Chat
13. **Payment and Transactions**: Does the platform handle money?
    - If yes: Online payments? Payouts to vendors/employees? Wallet system? Refunds?
    - Preferred gateway (if any): Stripe, Razorpay, PayTabs, Tap Payments, etc.
14. **Real-Time Features**: Does the platform need live updates?
    - Examples: Live tracking, chat, real-time booking status, live dashboards
15. **File and Media**: Does the system handle uploads?
    - Examples: Profile photos, documents, service videos, invoices
16. **Notifications**: What types are needed?
    - Options: Push notifications (mobile), Email, SMS, WhatsApp, In-app
17. **Localization**: Does the app need multiple languages?
    - If yes: Which languages? Is RTL support required (Arabic, Hebrew, Urdu)?

### Batch 4: Technical and Compliance Context

18. **Existing Systems / Integrations**: Does this platform need to connect to any existing systems?
    - Examples: CRM, ERP, accounting software (Zoho, QuickBooks), maps, analytics
19. **Compliance and Regulations**: Are there specific compliance requirements?
    - Examples: GDPR (Europe), HIPAA (healthcare), PCI-DSS (payments), VAT/tax reporting
20. **Data Sensitivity**: What sensitive data does the system handle?
    - Examples: PII, medical records, financial data, KYC documents
21. **Offline Support**: Do any parts of the app need to work without internet?
22. **Deployment Preference**: Where should the system be hosted?
    - Options: AWS, GCP, Azure, DigitalOcean, client's own servers, no preference
23. **Existing Tech Preferences**: Has the client expressed any technology preferences or constraints?
    - Examples: Must use React, must avoid MongoDB, team only knows Python

### Batch 5: Design, Brand and Scope

24. **Design Needed?**: Should UI/UX design be included in the scope?
25. **Figma Designs Available?**: Does the client already have Figma designs or wireframes?
    - If **yes**: Ask for the Figma file link(s). These will be analysed in Phase 1.5 to cross-check screen coverage against stated features.
    - If **no**: Note it and continue. Design will be part of deliverables.
26. **Brand Guidelines**: Does the client have existing brand guidelines (colors, fonts, logo)?
    - If yes: collect hex codes, font names, logo files
    - If no: note it. The `design-system` skill will suggest colors based on industry and audience (see Design DNA)
27. **Design Feel / Platform Vibe**: How should the platform feel to users?
    - Examples: "Clean and professional like Stripe", "Warm and friendly like Airbnb", "Data-focused like Bloomberg"
    - If the user doesn't have a reference: AI will suggest based on industry + target audience during the design phase
    - Store this answer. It feeds directly into the Design DNA questionnaire later
28. **Target Audience Profile**: Who is the primary user of this platform?
    - Age range, tech literacy level, usage context (on-the-go mobile? desk-based? in-field tablet?)
    - This drives design density, font size, touch targets, and navigation pattern
29. **Favicon / App Icon**: Does the client have a logo or icon for the app?
    - If yes: collect the asset
    - If no: will be designed as part of the design phase

### Batch 6: Scope, Outcome and Timeline

30. **Known Out-of-Scope Items**: What is explicitly NOT part of this phase?
31. **Known Future Scope Items**: What features are planned for later phases? (Important for architecture decisions)
32. **Success KPI**: What measurable outcome at 90 days after launch makes this project a success for the client?
    - Examples: bookings per week, hours of manual work removed, order volume, support-ticket reduction
    - Feeds the Overview and the milestone acceptance lines. A workscope with no success measure cannot referee delivery.
33. **Cost of Doing Nothing**: What happens to the client's business if this is not built?
    - Feeds the Overview. Names the problem in the client's own terms.
34. **Target Launch Timeline**: Tentative kick-off date, target go-live date, and the outside date the client cannot pass? (Sections 5 and 6 are dated from the kick-off. With no kick-off date the milestones carry week ranges only.)
35. **Budget Awareness and Payment Terms**: Does the client have a rough budget range in mind (used only to calibrate scope, never written into the document), and what payment split applies? (Section 6 carries a kick-off share of at least 10 percent plus an equal round share per delivered milestone, adding to 100 percent. Confirm, never assume.)

> [!NOTE]
> Do NOT assume any answer. If a question is not answered in the user's brief or the requirements baseline, ask it explicitly.
> Budget information is used only to calibrate feature depth in the scope. It is NEVER written into the workscope document.
> Design feel and audience answers are stored in `AI_DOCS/memory/project-context.md` and fed into the Design DNA questionnaire during the design phase.

---

## Phase 1.5: Figma Design Analysis (skip if no Figma link provided)

> [!IMPORTANT]
> Only run this phase if the user provided at least one Figma file link in Batch 5, Q25.
> Requires the **Figma MCP server** to be connected. If it is not available, skip this phase and note it.

Read `FIGMA-ANALYSIS.md` before running this phase: it has the connection config, the exact `get_metadata`/`get_design_context` calls, and the summary and gap-analysis output formats. Five steps: (1) connect and authenticate to the Figma MCP server, (2) read the file structure (pages, top-level frames) and present a summary, (3) extract design context per page (flows, roles, feature areas), (4) cross-reference the Figma screens against the Batch 3 feature list, produce a gap-analysis table, and surface gaps to the user before proceeding, (5) after the user confirms, update the combined feature list, record the confirmed Figma links in the working notes, and reflect them in Section 3 (Features Breakdown) and, where the scope rests on them, in Section 12's assumptions.

---

## Phase 2: Tech Stack R&D

> [!IMPORTANT]
> **Final variant: this phase is mandatory, even if the requirements document already specifies a tech stack.** Ballpark variant: skipped unless the stack changes the cost materially (Phase 0.6, Ballpark tech-stack rule).
> Requirements are written by stakeholders, not architects. Always present options, always give an AI recommendation with reasoning, always confirm with the user.
> **Never skip this phase. Never inherit the stack from a document without explicit user confirmation in this session.**

> [!NOTE]
> **Governing rule**: stack selection in this phase follows `rules/tech-stack-selection-rules.md` (requirement-driven, anti-default, options plus recommendation plus confirm). Read it before running this phase. The architecture-lens cross-check below maps to that file's Rule 4.

### Step 0: Idempotency Guard (check before asking anything)

> [!CRITICAL]
> Before presenting any options, read `AI_DOCS/memory/stack.md`. If it exists AND has `stack_confirmed: true` in its frontmatter, the stack was already selected this project (for example by `/do` Step 1.7). **Do NOT re-run the selection and do NOT re-ask the user.**
> Instead:
> 1. Read the confirmed names and the `## Selection rationale` section from `stack.md`.
> 2. Reuse them as-is.
> 3. Reflect the confirmed stack in the workscope **Section 7 (Technology Stack)** in plain English and continue to Phase 2.5.
>
> Only run the full options-and-confirm flow below when `stack.md` is absent or `stack_confirmed` is not `true`.

> [!NOTE]
> **AI Recommendation Rule**: For EVERY category, after presenting the options table, add an **AI Recommendation** block that names the recommended option and explains WHY it fits this specific project's requirements (real-time needs, scale, team, geography, compliance, etc.). Make it opinionated and specific, not generic.
> If the requirements mentioned a technology, acknowledge it and either validate or challenge it with clear reasoning.

### Signals from Discovery That Narrow Options

Use the answers from Phase 1 to filter which options are relevant. Read `STACK-PERSISTENCE.md` for the full signal-to-option lookup table (mobile, real-time, user volume, payments, RTL, compliance, existing stack, team skills).

### Architecture Lens Cross-Check (MANDATORY)

> [!IMPORTANT]
> The signal tables narrow options. Before locking the recommendation, run the architecture lens from `rules/tech-stack-selection-rules.md` Rule 4 against the requirement. For each axis, name what the requirement implies and confirm the chosen stack satisfies it:
>
> - **Scale**: expected users at launch and at 6 to 12 months. Does the stack reach the 6 to 12 month target via config change, not re-architecture?
> - **Data shape**: relational, document, time-series, graph, blob. Does the database choice match the dominant shape?
> - **Real-time**: live updates, presence, streaming. Does the backend support it without bolt-ons?
> - **Team skills**: what the team already ships. Is the stack within reach, or does it force a rewrite?
> - **Mobile**: native, cross-platform, none. Does the mobile choice match the platform and UX needs?
> - **Integrations**: payments, maps, messaging, auth providers, region constraints. Are the chosen services available and compliant in the target geography?
>
> Any axis the stack fails becomes a Hidden Challenge in Phase 2.5, not a silent gap.

### Tech Stack Options Output Format

See [TECH-OPTIONS.md](TECH-OPTIONS.md) for the full options tables for each technology category (Frontend, Mobile, Backend, Database, Cloud, Third-Party Services) and the AI Recommendation format.

> [!CRITICAL]
> **LTS Verification (MANDATORY)**: When presenting AI Recommendations or writing any confirmed version into the workscope's Technology Stack section, verify the current LTS/stable version online first. Sources: nodejs.org/releases, endoflife.date, `npm view <pkg> version`, PyPI. Never write a runtime or framework version from memory. See `.claude/rules/development-rules.md` Rule 31.

Present to the user covering every applicable category. Wait for user input on EVERY category before proceeding.

> [!CAUTION]
> - Present ALL options and wait for user input on EVERY category. Do not assume any default.
> - If the user has expressed a preference in discovery (Batch 4, Q23), do not list that as an equal option. Acknowledge it and mark it as their preference, but still show alternatives in case they want to reconsider.
> - The confirmed stack appears in **Section 7 (Technology Stack)** of the workscope ONLY, not elsewhere in the client document.
> - Write stack rows in plain English (for example "Android and iOS Mobile Application: React Native", not just "React Native").

### Tech Stack Rule: Always Ask, Even If Requirements Mention Tech

> [!CRITICAL]
> **If the user's requirements document already mentions a tech stack, DO NOT skip Phase 2.**
> Requirements docs are written by stakeholders, not architects. They may specify technology without understanding the implications.

**The AI MUST**:
1. Acknowledge what the requirements say: _"I see your requirements mention React Native and PostgreSQL."_
2. Still present ALL options for every category
3. Give an **AI Recommendation** for each category with reasoning
4. Let the user confirm, override, or explore alternatives

### Step 6: Persist the Confirmed Stack (MANDATORY, after user confirms)

> [!CRITICAL]
> The client-facing **Technology Stack** section is NOT a substitute for the canonical store. After the user confirms every category, you MUST write the stack to two places before moving on. Skip neither.

**6a. Write `AI_DOCS/memory/stack.md`.** Read `STACK-PERSISTENCE.md` (MANDATORY) for the exact schema to write verbatim (create the file if absent, overwrite if it predates confirmation). Use plain category names in the frontmatter (for example `Next.js`, `NestJS`, `PostgreSQL`). Set `stack_confirmed_date` to today. This file is what the idempotency guard (Step 0) and `/do` Step 1.7 read.

**6b. Record a stack ADR** in `AI_DOCS/architecture/adrs/`, for EVERY project, single-service included. Name it `NNNN-tech-stack-selection.md` (next free number). Read `STACK-PERSISTENCE.md` for the exact capture fields (Context, Options considered, Decision, Architecture reasoning, Consequences).

The `architecture` skill owns the ADR format. Reuse it if available, otherwise write the sections above directly.

Only after both 6a and 6b are written do you proceed to reflect the stack in Section 7 (Technology Stack) and continue to Phase 2.5.

---

## Phase 2.5: Hidden Challenges Discovery (MANDATORY)

> [!CRITICAL]
> Before generating the workscope document, the AI MUST surface all hidden technical challenges, ambiguities, and loopholes it has identified from Phase 1 and Phase 2.
> This phase prevents scope creep, budget overruns, and architecture regrets after the project starts.

After the tech stack is confirmed, produce a **Hidden Challenges Report** in the chat covering 5 categories: Feature Ambiguities, Scale and Performance Hidden Costs, Integration Loopholes, Missing Flows That Are Always Needed, and Tech Stack Risk Flags.

**UX and requirement-gap pass.** Also flag where the requirement is thin on UX or likely to produce a weak experience: filters/controls that will not fit the data shape (for example toggle-chips for a long status list), screens with no empty/error/first-run state, unclear primary actions. Spawn the `ux-advisor` agent on the requirement to generate a "Recommended vs Current" list, and surface the top items to the user as advice. This is internal advice: it does NOT go into the client-facing workscope document. Adopted changes are folded into scope. Full UX direction sampling happens later in `/design-direction`. This pass catches the gaps at requirements time.

See [HIDDEN-CHALLENGES.md](HIDDEN-CHALLENGES.md) for detailed examples, checklists, and the challenge format template for each category.

**Ballpark: every hidden challenge becomes a client question.** The ballpark carries no technical challenges or risks section. Each challenge is rewritten, under the Client-Problem Question Rule below, into a question the client can answer, and it goes to "Questions for You". A challenge that cannot be phrased that way stays internal and is priced into the estimate's assumptions.

> [!NOTE]
> Do not generate the workscope document until the user has addressed all NEEDS CLARIFICATION items. IN SCOPE and OUT OF SCOPE items can proceed: document them in the workscope accordingly. A NEEDS CLARIFICATION item the user chooses to carry into a draft goes to the draft review note (Critical Rule 5e), never into the scope as if it were settled.

---

## Client-Problem Question Rule (both variants)

A question reaches the client only if (1) the client can answer it without software knowledge and (2) the answer changes scope, cost or feasibility. Ask about their users, devices, environment, data, existing systems, rules, volumes, access and constraints. Never about our build choices (framework, database, API style, architecture, hosting vendor). Those are ours to decide.

| Domain | Good question (ask the client) | Bad question (never ask) |
|---|---|---|
| Pen tablets built in China | "Which operating system and version do the tablets run?" and "Can we get two tablets for testing?" | "Should we use Flutter?" |
| Clinic booking | "Do patients book for themselves, or does reception book for them by phone?" | "Do you want a REST or GraphQL API?" |
| Warehouse stock | "Do pickers have signal everywhere in the warehouse, or are there dead zones?" | "Should the app use an offline-first database?" |
| Payments in a new market | "Which payment methods do your customers use most today?" | "Should we integrate Stripe or a local gateway SDK?" |

**Self-check before a question goes out:** could the client's operations manager answer it in a meeting without asking IT? Does the answer change what we build, what it costs, or whether it can work? Both yes, keep it. Either no, rewrite it or keep it internal (the review note).

## Conflict Rule (both variants)

Conflicts between documents (the requirements baseline conflict register, or one detected directly) are never silently picked.

- **Ballpark:** a client question that names both sources ("Your brief says 200 students, the September email says 60. Which should the pilot plan for?").
- **Final:** resolved with a citation to the deciding source, or listed open in `## Open Questions` and the review note.
- A feature under an open conflict gets `estimateStatus: "Awaiting Clarification"` in the estimate.

**Operator-facing questions and recommendations (both variants).** Every question this skill asks the operator (a conflict to settle, a Proposed row, a wording that collides with the baseline) uses the `/ask` 2.0.0 shape: `Read:` the file and the exact row or section, `Wording:` quoted verbatim, `Conflict:` the baseline requirement (`R-NNN`), SOW clause or scope-strategy case it collides with and why it matters for cost or scope, one `Question:`, and a recommended answer with its reason. Never "item 5 has this, keep or replace?". Every recommendation in the review note carries the scope line from `rules/advisor-stance-rules.md` Rule 9: `In scope: R-NNN` with the reason, or `Out of scope: not in the baseline. Important because <need>. Goes through /change-request if accepted.` The client-facing document never carries either shape, only the resolved result.

---

## Phase 3: Generate Workscope Document

> [!IMPORTANT]
> **Ballpark variant:** after Phase 0.5 (answered card), Phase 0.6 (intake saved), the ballpark discovery questions, and an estimate built from the scope strategy, generate `AI_DOCS/planning/workscope.md` from `BALLPARK-TEMPLATE.md` (MANDATORY read): cover frontmatter with `variant: ballpark`, Overview, What We Will Build (MVP or Full scope first, then each tentative phase), How It Works (1 to 3 `diagram-design` images: overview, main journey, MVP vs future map, `slide-4x3`, `webosmotic` profile, exported to PNG), Estimated Investment (Section 6 cost wiring below, the fixed ballpark note verbatim, a one or two line payment note), Questions for You, and only the optional sections the intake asked for. Then go to Post-Generation. The rest of this phase describes the final variant.
>
> **Final variant:** only begin this phase after ALL of these are complete:
> - Phase 0 (pre-flight): baseline read, pre-filled answers confirmed
> - Phase 0.5 and 0.6: scope strategy answered, intake saved
> - Phase 1 (discovery): all 35 questions answered or confirmed (6 batches)
> - Phase 2 (tech stack): user has confirmed each category
> - Phase 2.5 (hidden challenges): all NEEDS CLARIFICATION items resolved by user, or explicitly carried into the draft review note
>
> Document IN SCOPE and OUT OF SCOPE challenge resolutions in the appropriate workscope sections.

Generate `AI_DOCS/planning/workscope.md` using the 12-section ZENi5 structure. Headings carry their numbers in the text: `# 1. Overview`, `# 5. Milestones`. Prose follows `rules/document-generation-rules.md` and `rules/writing-style-rules.md`.

**MANDATORY: read `WORKSCOPE-TEMPLATE.md` before generating `workscope.md`.** It holds the exact section-by-section content spec and the markdown skeletons: the frontmatter (with `closing` and `version`), the surface blocks of Section 3, the role flow blocks of Section 4, the dated milestone blocks of Section 5 with their `Deliverables on completion` lane and `Accepted when` line, the Section 6 milestone table, timeline image and payment schedule, and the General Notes and Assumptions of Section 12, plus the "Extending the structure" table of optional sections to offer afterwards.

Generate in this order:

1. **Sections 1 to 3** from the confirmed discovery answers.
2. **The milestone plan first, then Sections 5 and 6 from it.** Fix each milestone's first and last day from the kick-off (day 1), the launch day, and the outside date, then write the Section 5 duration lines, the Section 6 table rows, and the payment due dates from those same numbers. Parallel milestones overlap on purpose and say so ("alongside Milestone 2"). Write each milestone's `**Accepted when:**` line from its deliverables: observable evidence the client can check.
3. **The diagrams**, with the `diagram-design` Claude Code plugin (the framework's only diagram generator), into `AI_DOCS/planning/diagrams/`:
   - **One flow per acting role** (Section 2 order): a User journey diagram when the flow crosses touchpoints, a Process diagram otherwise, a Sequence diagram when the point is the handoff between actors or systems. Name it `diagrams/flow-<role>.html`.
   - **The milestone plan**: a Timeline diagram, or a Gantt diagram when milestones run in parallel and the overlap is the point, drawn from the same day ranges as the Section 6 table. Name it `diagrams/milestone-timeline.html`. With no confirmed kick-off date it carries week numbers only, no calendar dates.
   - Use the `slide-4x3` size preset and the `webosmotic` brand profile (first use on a machine: paste the tokens ink `#0F2A43`, accent `#2E75B6`, paper `#FFFFFF` and save the profile as `webosmotic`). Keep to six nodes or fewer with two- or three-word names, because the DOCX embeds images at about 7.4in.
   - Export each to PNG: `/diagram-design:export-diagram diagrams/<name>.html --png-only`. Keep the `.html` beside the `.png` so the diagram can be revised later.
   - Reference the PNGs relatively from the Markdown: `diagrams/flow-<role>.png` in Section 4, `diagrams/milestone-timeline.png` in Section 6. Full guidance: `docx-from-markdown` SKILL.md, "Diagram R&D pass".
4. **Sections 4 and 7 to 12.** Put a standalone `\newpage` line before `# 4.` and before `# 5.`. The closing line comes from the frontmatter `closing: "THANK YOU"`, never from a body line.
5. **The draft review note** at `AI_DOCS/planning/workscope-review-note.md` (Critical Rule 5e).

**Releases in the final variant.** Sections 3, 5 and 8 carry only the Committed release (the MVP in cases B and C, the full scope in case A). Each Tentative phase is a `## Phase N: [Name] *(tentative)*` block in Section 10 with its tentative figure, and a tentative row in the Section 6 investment table. Optional sections chosen in the intake (Why WebOsmotic, Relevant Experience, Validity and Next Steps, Acceptance) follow Section 12, per "Extending the structure" in `WORKSCOPE-TEMPLATE.md`.

### Section 6 cost wiring (both variants)

- **Committed figure** = the estimate's Committed (MVP) hours x the hourly rate the operator states for this engagement. Ask for the rate, never assume one.
- **Future phase figures** = each release's Tentative hours x the same rate, labelled tentative, shown per phase, never added into the committed figure.
- **A range only if the client asked for one.** Otherwise one figure per release.
- **Never cut an essential to lower the number** (`SCOPE-STRATEGY.md`).
- Proposed, Deferred and Excluded hours are never priced. Without an estimate the figures stay `XXX` (final only. A ballpark always waits for the estimate).

---

## Critical Rules

> [!CAUTION]
> 1. NEVER invent a number. Every cost figure is an `XXX` placeholder (with the client's currency) or estimation-sourced per the Section 6 cost wiring, nothing else. Percentages, dates, and day counts come from the confirmed plan.
> 2. Write client-facing prose in plain English the decision-maker will actually understand: "secure login", not "JWT" or "REST API" or "Prisma ORM". Section 7's stack list is the one place real technology names appear, in plain-English pairings.
> 3. NEVER skip Out of Scope (Section 9): it protects both sides from scope creep.
> 4. NEVER generate milestones that overlap in deliverables. Milestones may overlap in TIME (parallel workstreams), but every Section 3 feature is built in exactly one milestone.
> 5. A milestone shows its DATED TIMELINE, its LANES, its DELIVERABLES, and its ACCEPTANCE line, nothing else. No narrative paragraph: it restates Features Breakdown and is where the document starts contradicting itself. Lanes are a grouped ordered list (`1. **Lane**` with nested `  - ` items), numbering restarting in each milestone, and the last lane is always `Deliverables on completion` (the artefacts whose acceptance triggers that milestone's payment). Durations name the week range and the calendar dates from the tentative kick-off ("weeks 3 to 6, 28 September to 25 October"), or the week range only when no kick-off date is known. Milestone 1 is Discovery and Architecture. The final milestone is a dedicated QA, pilot, and production-launch milestone.
> 5a. **Every milestone carries one `**Accepted when:**` line** after its lanes: the observable evidence the client can check to accept it ("the client signs off the dated roadmap and the findings register in a review call", "a customer books and pays on the staging build and the booking appears on the vendor dashboard"). One condition on the line, or at most two short bold-led bullets beneath the label. Never an internal task ("backend complete"). This is the measurable completion condition the payment rests on.
> 5b. Write feature modules in Section 3 as `1. **Bold Title**`, never `1. ### Heading`: the latter renders as literal `###` characters in the DOCX.
> 5c. Out of Scope carries what WebOsmotic never does on any engagement (compliance certification, licences and approvals, partner agreements, platform and infrastructure fees, domain and account purchase, legal drafting, content production) plus the release-specific exclusions a client would otherwise assume, eight to ten numbered items ending with the catch-all. Everything the client wants but this phase defers goes to Future Scope with the fixed "not planned, not estimated, not covered" closing sentence. The test: would we ever do this for them? Never means Out of Scope, just not now means Future Scope.
> 5d. Say a thing once. A note belonging to Features lives in Features, a commercial term lives in Milestone and Payment. Cross-reference by section number instead of restating.
> 5e. **Section 12 is General Notes plus Assumptions, and no assumption silently becomes a requirement.** The client copy carries General Notes (numbered notes on third-party charges, testing, partner API limits, the indicative timeline, support terms, and future enhancements) followed by `## Assumptions Made for This Scope` (numbered, each a bold lead sentence and its consequence, highest-consequence first). Record only confirmed assumptions there. Every unresolved question is listed in the draft review note (`AI_DOCS/planning/workscope-review-note.md`, also shown in chat with the draft), each tied to the assumption or section it decides, and any assumption that rests on an unanswered question is marked there as unconfirmed. While a question is open, the draft also carries `## Open Questions` after the assumptions and the version is a draft: the subsection is removed, and the review note shows no open item, before the document is sent. Never assert a recommended standard (accessibility target, compliance posture, security control) in the document's own voice when the requirement does not state it: state it as an assumption awaiting the client's agreement.
> 5f. **Highlight for scanning (operator rule).** Every list item in Sections 3, 5, 8, 9, 10, 11 and 12 opens with a bold lead phrase of two to six words, a complete noun phrase never cut mid-phrase. Italic only for qualifiers such as *(from Phase 2)*. In prose, bold only the must-not-miss line, the `**Accepted when:**` label, and the Section 6 labels. In tables, bold only the Total row. Template rule 5.
> 5g. **Payments are a kick-off of at least 10 percent plus equal round shares per milestone** (10, 15, 20, 25, 30). Template rule 6.
> 5h. **No team plan in a fixed-scope work scope.** A resource-based engagement gets a Team Composition section of roles and the skills each is chosen for, never hours or cost per person. Template rule 7.
> 6. ALWAYS write each assumption with what changes if it is wrong.
> 7. NEVER add a "QA and Deployments" module to a Section 3 surface block: QA and deployment belong to the final milestone and to Deliverables.
> 8. ALWAYS reproduce fixed copy verbatim: the ballpark note, the Future Scope closing sentences, the standard General Notes 4 to 6, and the "Why WebOsmotic" and "Next Steps" blocks from `docx-from-markdown/references/workscope-template.md` (Fixed copy). Relevant Experience uses only delivered projects, never an invented case study.
> 8a. A ballpark carries no technical challenges, hidden risks, payment table or payment schedule, and no technology names. Questions follow the Client-Problem Question Rule.
> 9. ALWAYS ask about future scope: it shows strategic thinking to the client. Future phases are always shown with their tentative cost, never hidden and never blended into the committed figure.
> 10. Prose follows `rules/document-generation-rules.md`. Run its Rule 7 validation checklist (banned phrases, purpose sentence, one-thing test) before presenting the draft.
> 11. ALWAYS put a standalone `\newpage` line before `# 4.` and before `# 5.`, and carry the closing line as the frontmatter key `closing: "THANK YOU"`, never as a body line. `md_to_docx.py` turns a standalone `\newpage` (or `\pagebreak`) line into a page break and renders `closing:` as a centred bold line after the last section. A `\newpage` inside a paragraph prints as literal text.

---

## Post-Generation Steps

After the workscope is generated:

1. Save to `AI_DOCS/planning/workscope.md` as ONE file, with the diagrams (`.html` and `.png`) in `AI_DOCS/planning/diagrams/` and the review note at `AI_DOCS/planning/workscope-review-note.md`.
2. Run the house-rule check and fix every FAIL. The variant comes from the frontmatter `variant:` key (or `--variant ballpark|final`). Final: bold leads, italic qualifiers, payment shares, banned punctuation, team plan in a fixed scope, missing acceptance lines, a page-break token sharing a line with text. Ballpark: a payment table or schedule, a technical or hidden challenges or risks section, or a missing ballpark note FAIL, and a question naming build technology WARNs. Both: a future phase without a tentative label WARNs, and so do a missing `closing:` key, a body `**THANK YOU**` line, or (final) a missing `\newpage` before `# 4.` or `# 5.`:
   `python3 .claude/skills/workscope/scripts/check_workscope.py AI_DOCS/planning/workscope.md`
   Add `--resource-based` for a resource engagement. Then run the `rules/document-generation-rules.md` Rule 7 validation checklist, and check the consistency points: the Section 5 duration lines, the Section 6 table, the timeline diagram, and the payment due dates all use the same day numbers, and the payment shares add to 100 percent. Revise before presenting, not after.
3. **When an estimate exists, cross-check it** (estimation contract schemaVersion 3, release-aware for v6.1 milestones with `release` and `commitment`). Committed features in the document must match Included estimate features in Committed milestones, future phase features must match Tentative ones, and a committed hours figure must never include Tentative hours:
   `python3 .claude/skills/workscope/scripts/check_workscope.py AI_DOCS/planning/workscope.md --estimate AI_DOCS/estimation/estimation-v<N>.json`
   Each REVIEW line is a scope disagreement between the two documents: a Section 3 feature with no Included estimate feature, an Included estimate feature missing from Section 3, or an Excluded, Deferred, or Pending feature promised in Sections 3, 5, or 8. Resolve each one in the workscope or the estimate, or list it in the review note. REVIEW lines never change the exit code. Only FAIL lines do.
4. Present the draft with the review note, then ask: *"Is this workscope approved?"*
5. Final variant, on approval: offer the estimation handoff FIRST: *"Want an estimate from this scope? `/estimation` reads it with the scope strategy, and Section 6 can then carry real figures instead of XXX."* (A ballpark already has its estimate.) The estimate gives hours, not money. Fill the figures per the Section 6 cost wiring: Committed hours x the operator's rate for the committed amount, Tentative hours x the same rate per future phase. Milestone weeks come from the estimate's provisional ETA when it has scheduling inputs, otherwise from the operator. After an estimate is produced, re-run step 3.
6. Bump `version:` in the frontmatter on every revision after the first.
7. **Render the client document** with `docx-from-markdown` in cover mode, passing the frontmatter `version` so the converter keeps an immutable numbered copy at `AI_DOCS/planning/versions/workscope-v<N>.docx` beside the always-latest `workscope.docx`:
   `python .claude/skills/docx-from-markdown/scripts/md_to_docx.py AI_DOCS/planning/workscope.md AI_DOCS/planning/workscope.docx --mode cover --version <N>`
   Then follow that skill's "Inspect before handoff" step: export the DOCX to PDF (Word), render and read every page (cover, TOC, each diagram at embed size, the Section 6 table, the payment table), fix what the render shows, render again. A PDF for the client is that export. The handoff to the operator ends with the inspection block from `rules/document-generation-rules.md`: `Opened:` (file, pages rendered, what was confirmed), `Found and fixed:`, and `Please verify (about 2 min):` three to five items only the operator can judge, for example the client name and dates on the cover, the Section 6 figures against the estimate, the milestone dates against the agreed start, and whether each diagram shows the roles and flows they expect. No handoff without the `Opened:` line.
8. Then proceed to the Technical Specification.

## Next Step

On approval: optionally [estimation](../estimation/SKILL.md) for the effort ballpark (feeds the Section 6 total cost), then [tech-specification](../tech-specification/SKILL.md) for the full developer-facing specification from this workscope.

<!-- Version: 2.1.0 | 2026-08-06 | progressive disclosure: reference blocks moved to supporting files (v4.18.0 structural pass); no content deleted -->
<!-- Version: 2.1.1 | 2026-08-20 | phrasing pass, constraints unchanged. Folder-split and jargon-ban Critical Rules reworded as motivated positives; the output-format-is-Markdown-only contract, the never-invent-a-number / never-skip-Out-of-Scope / never-overlapping-milestones rules, and the tech-stack-confirmation phase gate are safety/cost/structural and left verbatim. -->

<!-- Version: 2.2.0 | 2026-08-24 | Lean 10-section structure is now the default (Overview, User Roles and Features, Features Breakdown, Flow Plan, Milestones, Technology Stack, Deliverables, Out of Scope, Client Responsibilities, General Notes); 13-section commercial shape preserved at WORKSCOPE-TEMPLATE-13SECTION.md and offered on request. Milestone block reshaped: relative durations, required 'By the end of this milestone' paragraph, lane grouping, dedicated final QA/launch milestone. Feature modules are bold list items, not H3s. Diagram R&D pass wired into Phase 3. Human-form cover date. -->

<!-- Version: 2.3.0 | 2026-08-26 | 12-section structure derived from the delivered WebOsmotic workscopes: adds Milestone and Payment (hours/cost table), Future Scope, and Questions and Concerns; removes General Notes. Flow Plan is image-led (diagram + summary paragraph, no numbered steps). Deliverables split by codebase component with purpose. Out of Scope narrowed to never-do items with the Future Scope test. Cover uses people's names. Section 3 drops QA & Deployments (owned by the final milestone and Deliverables). -->

<!-- Version: 2.4.0 | 2026-08-26 | Milestones carry timeline + features only: the 'By the end of this milestone' narrative paragraph is removed, since it restated Features Breakdown. Lanes are level-0 bullets with work items as sub-bullets (one nested list per lane), replacing the bold-paragraph-plus-flat-list form that put label and items at the same level. Content in a removed paragraph that is genuinely new moves to the section that owns it. -->

<!-- Version: 2.5.0 | 2026-08-26 | Added REFERENCE-LIBRARY.md: the five delivered WebOsmotic workscopes, what pattern each one establishes, and the /mobilebasic technique for reading a Google Doc (the /edit view is a canvas that returns no body text, and WebFetch 401s on an authenticated doc). Phase 0 pre-flight now reads them before drafting. -->
<!-- Version: 2.5.2 | 2026-10-14 | Diagram R&D pass now generates with the diagram-design plugin, which replaced the retired Pillow generator. -->

<!-- Version: 2.6.0 | 2026-10-05 | Aligned to the approved ZENi5 MVP work scope (8 September 2026, v36) and the reference workscope skill 2.6.0. Section 12 is General Notes plus Assumptions Made for This Scope (open questions only in a draft). Milestones are dated from the tentative kick-off, may run in parallel, and end with a Deliverables on completion lane. Section 6 carries weeks, days and dates, a timeline image, the total cost line, and a kick-off plus per-milestone percentage payment schedule. Flow Plan images are role-owned. Lists follow the list-kind-by-purpose rule. The workscope stays one file and is rendered with docx-from-markdown --mode cover --version N. Discovery Q34 and Q35 now collect the kick-off, launch, and outside dates and the payment split. Gap analysis: .claude/docs/workscope-alignment-2026-10-05.md. -->

<!-- Version: 2.8.0 | 2026-10-14 | Ported the sales-repo workscope 2.7.0 improvements: the approved ZENi5 v36 structure (dated milestones from a kick-off with a Deliverables on completion lane, Section 6 as weeks, days and dates with one total-cost line, a kick-off of at least 10 percent plus equal round milestone shares, General Notes plus Assumptions Made for This Scope), bold lead phrases and italic qualifiers, Team Composition only for resource-based work, Q34 and Q35 asking the kick-off date and payment split, one file rendered with docx-from-markdown --mode cover and a PDF read-back, and the Section 7 Technology Stack reference fix. All diagrams (role flows, milestone Timeline or Gantt) now come from the diagram-design plugin. Added a per-milestone Accepted when line so the promised acceptance criteria exist, a draft review note that lists every unresolved question so no assumption silently becomes a requirement, and scripts/check_workscope.py with an --estimate cross-check against the estimation contract schemaVersion 3. Dropped the converter's --version flag, \newpage and the closing frontmatter key, which the older md_to_docx.py did not support. -->
<!-- Version: 2.8.1 | 2026-10-14 | Phase 0 reads the requirements-baseline readiness verdict and Basis tags (requirement-finalization 1.1.0): only Verified rows pre-fill, Assumption rows go to Section 12, Proposed rows to the review note, Open rows become questions. -->
<!-- Version: 2.8.2 | 2026-10-14 | Estimation handoff wired to v6: total cost = Approved hours x operator-stated rate, provisional ETA feeds milestone weeks, no reference mode. -->
<!-- Version: 2.9.0 | 2026-10-14 | Merged origin/main workscope 2.6.0 into the 2.8.2 line. Restored the three converter features the upgraded md_to_docx.py now supports: standalone \newpage lines before # 4. and # 5., the frontmatter closing: "THANK YOU" line, and --version N (renders the latest workscope.docx and archives versions/workscope-v<N>.docx). Brought back the upstream Deliverables numbered-list pattern, the standing Out of Scope items (compliance certification and audit, licences and regulatory approvals built to readiness), the colour-code paragraph for per-role journey images (now diagram-design images under AI_DOCS/planning/diagrams/), and the known ZENi5 source location in REFERENCE-LIBRARY.md. Where the two sides disagreed on any other rule, the 2.8.2 line was kept (diagram-design over the retired generator, Accepted when lines, check_workscope.py, kick-off of at least 10 percent). -->
<!-- Version: 3.0.0 | 2026-10-14 | MAJOR: two versions. Ballpark quote (new BALLPARK-TEMPLATE.md: releases, 1 to 3 diagrams, MVP committed cost, tentative future phases, fixed ballpark note, payment note, client questions) and Final 12-section work scope (now with the investment table, releases and priced tentative future phases). New Phase 0.5 scope strategy with the operator decision card (SCOPE-STRATEGY.md, shared with estimation: cases A, B, C, MVP-first default, essentials never cut), Phase 0.6 seven-question output intake saved to workscope-intake.md, the variant branch (ballpark trims discovery, skips the stack unless it moves the cost, needs the estimate first), the Client-Problem Question Rule with a self-check, the Conflict Rule, Section 6 cost wiring (Committed hours x rate, Tentative hours x rate labelled tentative, range only on request). check_workscope.py gains --variant and the release-aware --estimate cross-check. WORKSCOPE-TEMPLATE-13SECTION.md retired, its Why WebOsmotic, Relevant Experience, Next Steps and Acceptance kept as optional sections gated by intake question 7. -->

<!-- Version: 3.0.1 | 2026-10-21 | effort set per the v4.28.0 cost policy -->
<!-- Version: 3.1.0 | 2026-10-22 | operator questions and review-note recommendations use the /ask 2.0.0 shape and the advisor-stance Rule 9 scope line, the final DOCX handoff carries the render-inspect block (Opened, Found and fixed, Please verify), ADF v4.32.0 -->
