---
name: session-management
description: "Execution skill for initialization, session restore, and developer onboarding. Actually runs git init, settings, scaffolding, quality tooling, and session restoration from prior project state. Use when the ask is 'initialize repo', 'restore my session', 'pick up where I left off', 'set up scaffolding', 'onboard a new dev', or 'bootstrap this project'. Also hosts the triage router for ambiguous 'how should we start?' questions (asks diagnostic questions, then routes to workscope, codebase-migration, brainstorm, or project-stage-detect). Distinct from memory-protocol (only AI_DOCS/memory files) and guardrails (linter config only). Also triggers on: 'Start new project', 'Setup project', 'New project', 'Migrate project', 'Restore session', 'Continue', 'Onboard me', 'Kick off'."
effort: medium
next_skill: workscope
required_gate: null
skill_id: SK-001
context_budget:
  load_kb: 20
  scope: session
version: 1.7.0
dependencies:
  required: []
  optional: [codebase-migration, workscope, tech-specification, memory-protocol]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---
# AI_START - System Bootstrap Protocol

**NOTE**: Files under `.claude/` (skills, hooks, rules, agents) are framework code — do not modify them as part of project work. Files under `AI_DOCS/` are the project memory and are written by skills only.

> **🤖 AI ENTRY POINT**: This file initializes the framework session  
> **AUDIENCE**: AI agents only (not for human reading — humans should read README.md)

---

## 🚨 CRITICAL: Entry Check (FIRST STEP — Before Workflow Detection)

> [!CRITICAL]
> Before detecting the workflow, check if this is the very first session on this project.

**If `AI_DOCS/memory/project-context.md` does NOT exist:**
→ This is a new or un-initialized project. Run the **Triage Routing** section below first.
→ It asks the right questions and routes to Workflow A, Workflow F, or the migration path.

**If the active milestone's `AI_DOCS/milestones/M<NN>-<slug>/tasks.md` has a row with `Status: DOING`:**
→ An unfinished task was detected. Show the user:
```
⚠ Unfinished task: "[title from tasks.md]"
Milestone: M<NN>-<slug>  Task: T-NN
Run /do to resume, or continue below to restore session context.
```

**Otherwise:** proceed to Workflow Detection.

---

## 🚨 CRITICAL: Workflow Detection (SECOND STEP)

> [!CRITICAL]
> **BEFORE doing ANYTHING else, determine which workflow the user needs.**

When a user invokes this skill, you MUST first detect the scenario:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        WORKFLOW DETECTION MATRIX                             │
├──────────────────────┬───────────────────────┬──────────────────────────────┤
│ Does AI_DOCS/ exist? │ What does user want?  │ Execute Workflow             │
├──────────────────────┼───────────────────────┼──────────────────────────────┤
│ ❌ NO                │ "Start new project"   │ WORKFLOW A: New Project      │
│ ❌ NO                │ Any trigger keyword   │ Run Triage Routing first     │
│ ✅ YES               │ "Add new feature"     │ WORKFLOW B: Feature Add-on   │
│ ✅ YES               │ "Change request"      │ WORKFLOW C: Change Request   │
│ ✅ YES               │ "Continue/Resume"     │ WORKFLOW D: Session Restore  │
│ ✅ YES               │ "I'm new/Onboard me" │ WORKFLOW E: Dev Onboarding   │
│ ✅ YES               │ "AI-enable/Migrate"  │ WORKFLOW F: AI-Enable        │
│ ✅ YES               │ (Not specified)       │ ASK user which workflow      │
└──────────────────────┴───────────────────────┴──────────────────────────────┘
```

### Quick Detection Prompt

**Ask the user** (if not obvious from their message):

> "I see `AI_DOCS/` already exists. What would you like to do?
> 
> 1. 🆕 **New Project** — Start fresh (will archive existing AI_DOCS)
> 5. 👋 **Onboard Me** — I'm a new developer joining this project
>
> 2. ➕ **Feature Add-on** - Add a planned feature to existing project
> 3. 🔄 **Change Request** - Add an unplanned feature mid-flight
> 4. ▶️ **Resume Work** - Continue where we left off
> 
> Reply with the number or describe what you need."

---

## Triage Routing (formerly the project-kickoff skill)

This section is the **first thing that runs** when the user is ambiguous about the starting path. It asks the right questions before a single line of code is written or a single doc is created, then routes. It does not perform setup itself, the workflows below and the downstream skills do.

Fires when the user says any of: "start", "setup", "init", "new project", "begin", "kick off", "migrate this project", "add AI to my project", "make this AI-enabled", when there is no `AI_DOCS/` folder, or on first use of any skill in a project with no `CLAUDE.md`.

> [!CRITICAL]
> Before asking any questions, check if `AI_DOCS/` and `AI_DOCS/memory/project-context.md` exist.
> If both exist, the project is already initialized: use Workflow D (Restore) instead.

### Question flow

Ask these questions one at a time, inline. Do not dump them all at once.

**Question 1: Project situation**

```
What best describes your situation?

1. New project: starting from scratch, nothing built yet
2. Migration: existing codebase, want to bring it into this framework
3. AI-enable: existing project working fine, just want AI memory/context set up
4. Have requirements: I have a brief/PRD/Figma, ready to plan
```

**Question 2 (branches by the answer above)**

If answer = New project:
```
Do you have your requirements ready, or should we figure them out together?

1. Generate from scratch: I'll describe my idea, you ask discovery questions
2. I have a brief/document: I'll paste or describe it, you formalize it
3. I have a Figma design: start from the visual design
4. Skip straight to tech spec: I know what I want to build
5. My documents are already in (or I can drop them into) AI_DOCS/requirements/: point the framework at them
```

If answer = Migration:
```
What do you want to do with the existing codebase?

1. Analyze and recreate requirements: scan the code, generate spec and memory docs
2. Just AI-enable: create CLAUDE.md + AI_DOCS without touching the code
3. Full migration: also update the tech stack / architecture as part of this
```

If answer = AI-enable:
```
How much AI setup do you want?

1. Minimal: just CLAUDE.md and AI_DOCS/memory/ (no planning docs)
2. Standard: CLAUDE.md + memory + read existing code to fill in project-context.md
3. Full: everything above + generate tech-spec and api-contract from existing code
```

If answer = Have requirements:
```
What format are the requirements in?

1. I'll describe verbally: start discovery questions now
2. Text document / PRD: I'll paste the content
3. Figma link / design file: analyze the screens
4. Existing codebase to analyze
5. My documents are already in (or I can drop them into) AI_DOCS/requirements/: point the framework at them
```

**Question 3: Review mode** (ask for all paths)

```
How strict should governance be?

1. Solo: no gates, just me building (fastest)
2. Lean: key gates only, architecture review + QA sign-off before release
3. Full: all 9 governance gates (recommended for client / team projects)
```

### Routing table

| Situation | Mode | Route to |
|---|---|---|
| New project, generate requirements | Any | `workscope` skill, then `tech-specification`, then `milestone-planning` |
| New project, have brief | Any | Workflow A (fast path, tech spec directly) |
| New project, have Figma | Any | `workscope` Phase 1.5 (Figma analysis), then tech spec |
| New project, skip to tech spec | Any | Workflow A, then `tech-specification` directly |
| New project / Have requirements, docs already in `AI_DOCS/requirements/` | Any | If more than one source is present, recommend `requirement-finalization` before `workscope`. Otherwise proceed straight to `workscope` / `tech-specification`. |
| Migration, recreate requirements | Any | `codebase-migration` skill, then Workflow A |
| Migration, just AI-enable | Any | Workflow F |
| Migration, full stack update | Any | `codebase-migration`, then Workflow A |
| AI-enable, minimal | Any | Workflow F, Minimal |
| AI-enable, standard | Any | Workflow F, Standard |
| AI-enable, full | Any | Workflow F, Full |
| Unsure where the project stands | Any | `project-stage-detect` |
| Pre-requirements ("should we build this?") | Any | `brainstorm` |

### What gets written after triage

Regardless of path, write to `AI_DOCS/memory/session-state.md`: Current Phase (discovery, specification, design, implementation), Project Type (new, migration, ai-enable), Review Mode (solo, lean, full), Active Milestone (name or "not set"), Active Task ("none, kickoff complete"), Gate Status (NOT STARTED, or SKIPPED if review mode is solo) and Next Action (the skill to run next).

Then show the user a short summary: project, type, review mode, memory location (`AI_DOCS/memory/`), and the next step with the skill name and what it does.

---

## WORKFLOW A: New Project Initialization

**Trigger**: User wants to start a completely new project OR `AI_DOCS/` doesn't exist.

### Step 0: Project Flow Guide (SHOW TO USER FIRST)

> [!CRITICAL]
> Before doing ANYTHING, show the user this roadmap so they understand the complete journey ahead.

Present this to the user:

```
Welcome! Here's how we'll build your project together.

PHASE 1 — PLANNING (You decide, I document)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Step 1: Project Setup
          → I ask about your idea, tech preferences, and goals
          → I create .claude/settings.json (permissions, hooks, auto-formatting)
          → I create .claude/rules/ (per-directory enforcement for API, frontend, security, etc.)
          → .claude/skills/ contains the AI_SKILLS framework (copy-pasted by user)
          → I initialize git (main → develop → milestone-1)
          → I scaffold the project using official CLI tools
          → I generate CLAUDE.md for session memory

  Step 2: Workscope (Optional — ask user)
          → If YES: 32 discovery questions, hidden challenges, tech stack recommendation
          → Output: AI_DOCS/planning/workscope.md
          ✓ Gate 0: You approve the workscope
          → If SKIP: Go directly to Tech Spec (Step 4)

  Step 3: Estimation (Optional, needs the claude-sales-skills collection)
          → Dual estimate via /estimation when that skill is installed
          → Output: estimation spreadsheet (often supplied by pre-sales)

  Step 4: Technical Specification + Architecture
          → 23-section spec split into linked files
          → API contracts defined (the bridge between frontend & backend)
          → Architecture decisions documented as ADRs
          → System design, sequence diagrams, database schema
          → Output: AI_DOCS/planning/tech-spec.md + spec/ folder
          → Output: AI_DOCS/architecture/ (api-contract, ADRs, diagrams)
          ✓ Gate 1: You approve the tech spec

  Step 5: Milestone Planning
          → I ask: Design-First or Feature-by-Feature?
          → Milestones defined with git branches
          → Output: AI_DOCS/planning/milestone-plan.md

PHASE 2 — DESIGN (Per milestone, not all at once)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Step 6: Design DNA
          → I suggest colors, fonts, and feel based on your audience
          → Favicon and app icons
          → Responsive breakpoints defined
          ✓ Gate 2: Component library ready

  Step 7: Screen Design (current milestone only)
          → Mobile + Tablet + Desktop layouts for each screen
          → Components registered in component-registry.md
          ✓ Gate 3: Designs approved for this milestone

PHASE 3 — BUILD (Feature by feature)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Step 8: Code Quality Pre-Check
          → 17-point checklist before coding starts
          ✓ Gate 1.5: Quality pre-check passed

  Step 9: Development
          → Feature branches: feat/m1-[name]
          → API contract checked before every API call
          → PRs to milestone branch

  Step 10: QA Testing
          → Tests traced back to tech spec
          ✓ Gate 4: QA sign-off

PHASE 4 — RELEASE
━━━━━━━━━━━━━━━━━
  Step 11: Deployment
          → I prepare the runbook. You run it manually.
          → Git: milestone → develop → main (tagged)
          ✓ Gate 5: Production sign-off

  Step 12: Next Milestone
          → milestone-2 branches from milestone-1
          → Repeat Phase 2-4

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
At every gate, you review and approve before I proceed.
Nothing moves forward without your sign-off.

Ready to start? Let's begin with your project requirements.
```

After showing this guide, proceed to initialization.

---

## Initialization & Memory Logic
> [!NOTE]
> **Centralized Source**: This skill handles the core initialization logic for the entire framework. All other skills should refer back to this logic if memory files are missing.

> [!CRITICAL]
> **Idempotent Initialization**: Before proceeding, ensure core memory files exist. **SKIP copying if file already exists.**

1.  **Verify Directory**: Ensure `AI_DOCS/memory/` exists. Create if missing.
2.  **Initialize Memory (IDEMPOTENT)**: For each file below, create ONLY IF it does NOT exist:
    
    | Runtime Path | Purpose | Skip If Exists |
    |--------------|---------|----------------|
    | `AI_DOCS/memory/project-context.md` | Master project state — stack, library, stage, gates | YES |
    | `AI_DOCS/memory/task-ledger.md` | Global milestone summary (one-line-per-milestone) — what's done, in-progress, next | YES |
    | `AI_DOCS/memory/decision-log.md` | All key decisions with options considered and rationale | YES |
    | `AI_DOCS/memory/gate-status.md` | Gate pass/fail status with timestamps | YES |

    Initialize `project-context.md` with the template from [memory-protocol](../memory-protocol/SKILL.md).
    Initialize `decision-log.md` as an empty log table.
    Initialize `gate-status.md` with all gates set to PENDING.
    Initialize `task-ledger.md` with the milestone summary structure. Per-task detail lives in milestone capsules (`AI_DOCS/milestones/M<NN>-<slug>/tasks.md`) created by `/plan`.

3.  **Validate Structure**: All outputs MUST adhere to `session-management/templates/output-structure.md`.

> [!WARNING]
> **DO NOT overwrite existing files!** User may have modified them. Always check existence first.

> [!TIP]
> **Session Restore Protocol**: If context is lost, read `project-context.md` (stack, stage, gates), `session-state.md` (active milestone + task), `task-ledger.md` (milestone summary), the active milestone capsule's `tasks.md` (task detail), `decision-log.md` (rationale).
> See [memory-protocol](../memory-protocol/SKILL.md) for the full read/write contract.

---

### Phase 1: Critique (MANDATORY GATE)

> [!CRITICAL]
> **STOP AND THINK**: Before generating any plans, you must CRITIQUE the user's request.

1.  **Analyze requirements**: Identify ambiguity, missing edge cases, and security risks.
2.  **Explicitly ask**: If anything is vague, ask the user for clarification.
3.  **Output**: Write a short "Critique Summary" in the chat before proceeding.

### Step 1: Analyze Requirement Completeness
- Check for **User Roles** (Who will use this system?)
- Check for **Tech Stack** (Next.js? Python? React? Database preferences?)
- Check for **Visual Preferences** (Design system? Color scheme? Brand guidelines?)
- Check for **Technology Standards File** (Does `session-management/templates/technology-standards.md` exist?)
- Check for **Project Type** (POC, MVP, or Production-Grade?)

### Step 1.5: Tech Stack & Tool Selection (Gate 1.5)

> [!IMPORTANT]
> **Present all options with trade-offs. Never assume or default. Wait for user to choose.**
> See [workscope](../workscope/SKILL.md) Phase 2 for the full options presentation format if building from scratch.
> For existing projects: read `AI_DOCS/memory/project-context.md` — stack is already confirmed.

**For new projects**, present options per category and ask the user to choose:
- Frontend framework (Next.js / React+Vite / Angular / Vue+Nuxt)
- Mobile framework (React Native / Flutter / Native / N/A)
- Backend (Node.js+NestJS / Node.js+Express / Python+FastAPI / Python+Django / Go)
- Database (MongoDB / PostgreSQL / MySQL / Hybrid)
- Cloud (AWS / GCP / Azure / DigitalOcean / client servers)
- Component Library (Shadcn/ui / MUI / Ant Design / React Native Paper / etc.)

**After user confirms**, write all choices to `AI_DOCS/memory/project-context.md` and append each choice to `AI_DOCS/memory/decision-log.md`.

---

### Step 1.54: Claude Code Settings & Rules (NEW PROJECT ONLY)

**Claude Code Settings & Rules**: See [SETUP-TEMPLATES.md](SETUP-TEMPLATES.md) for detailed settings.json configuration (permissions, denied commands, excluded files) and rules setup (per-directory enforcement files by tech stack).

Create `.claude/settings.json` before any git or scaffold operations. Copy from `session-management/templates/claude-settings.json`. Then create `.claude/rules/` with rule files matching the confirmed tech stack.

---

### Step 1.55: Git Repository Initialization (NEW PROJECT ONLY)

**Git Init & Branching**: See [SCAFFOLDING.md](SCAFFOLDING.md) for full git init commands, .gitignore template, and branching model setup (main/develop/milestone-1).

Reference: [github-ops](../github-ops/SKILL.md) for full branching protocol.

---

### Step 1.6: Project Scaffolding (NEW PROJECT ONLY)

**Scaffold CLI Commands**: See [SETUP-TEMPLATES.md](SETUP-TEMPLATES.md) for official CLI commands (frontend, backend, mobile, database) and all post-scaffold quality tooling (Husky, ESLint, Prettier, .env.example, PR template, CI).

**Project Structure Conventions**: See [SCAFFOLDING.md](SCAFFOLDING.md) for monorepo, multi-repo, and single-app structure options.

After scaffolding and tooling setup, make the **first commit**:
```bash
git add .
git commit -m "chore: scaffold [stack] base project with quality tooling"
```

---

### Step 1.7: MCP Server Configuration

**MCP Server Setup** (governed by `.claude/rules/mcp-rules.md`, run by `mcp-connector`): free (Enforced) servers are written to `.mcp.json` automatically. Credentialed (Gated) servers are offered and require approval. Active set recorded in `stack.md` → `## MCP Servers`. See [SCAFFOLDING.md](SCAFFOLDING.md) for the mapping matrix.

---

### Step 2: Identify Gaps
- If ANY of the above are missing or ambiguous, **ASK the user to clarify** immediately.
- **Default Project Type to MVP** if unspecified.

### Step 3: Generate CLAUDE.md (MANDATORY)

After all gaps are filled and tech stack is confirmed, run the `claude-md` skill to generate `CLAUDE.md` at the project root:

1. Confirm `AI_DOCS/memory/project-context.md` is populated
2. Run [project-context](../project-context/SKILL.md) skill to generate `CLAUDE.md`
3. Confirm `CLAUDE.md` was created at project root

This ensures every future Claude Code session starts with full project context without needing to ask the user to re-explain the project.

### Step 4: Propose Workflow Start

Once all gaps are filled and CLAUDE.md is created, ask the user:

> "Project initialized. CLAUDE.md created. What's next?
>
> 1. **Workscope** — Run 32 discovery questions, surface hidden challenges, generate scope doc (recommended for client projects)
> 2. **Skip to Tech Spec** — Go directly to 23-section technical specification (faster, for internal/solo projects)
> 3. **Estimation first**: build the role-hours estimate before the spec (when budget or timeline is needed upfront)
>
> Which would you like?"

**If Workscope**: Run `workscope` skill → Gate 0 → then Tech Spec
**If Skip to Tech Spec**: Run `tech-specification` skill directly → Gate 1
**If Estimation**: Run the `estimation` skill if installed (ships with claude-sales-skills) → then Workscope or Tech Spec

---

## ➕ WORKFLOW B: Feature Add-on (Planned Enhancement)

**Trigger**: User wants to add a NEW feature to an existing, documented project.
**Prerequisite**: `AI_DOCS/planning/frd.md` already exists.

> [!NOTE]
> This is for **planned features** that need to go through the full PRD/FRD process.
> For **mid-flight unplanned features**, use Workflow C instead.

### Step 1: Context Restoration
1. Read `AI_DOCS/memory/project-context.md` → Current stage, active milestone, confirmed stack
2. Read `AI_DOCS/memory/session-state.md` → Active task, last decision, next action
3. Read `AI_DOCS/memory/task-ledger.md` → Milestone summary (which milestones are DONE/DOING/TODO)
4. Read active milestone's `tasks.md` → Last completed task, what's next in this milestone
5. Read `AI_DOCS/memory/decision-log.md` (last 5 entries) → Recent decisions
4. Read `AI_DOCS/planning/tech-spec.md` → Existing requirements and approved scope

### Step 2: Scope the New Feature
1.  Ask user: "Please describe the new feature in detail."
2.  Determine if it's:
   - A **Major Feature** (needs new Milestone) → Create new `M[#]_[Name]/`
   - A **Minor Feature** (fits existing Milestone) → Add to existing Milestone

### Step 3: Tech Spec Amendment
1. **Update** `AI_DOCS/planning/tech-spec.md`:
   - Update Section 2 (Scope) to include the new feature
   - Update relevant feature sections (UI, API, Schema, Test Cases, Sequence Diagrams)
   - Append to Change Log at the bottom of the spec
2. **Ask user for approval** before proceeding
3. **Append to** `AI_DOCS/memory/decision-log.md`: note the feature addition and rationale

### Step 5: Update Task Tracking
1. **Update** active milestone's `tasks.md` — add new feature as a `TODO` row; update `task-ledger.md` milestone progress
2. Proceed with normal Design → Develop → Test flow

---

## 🔄 WORKFLOW C: Change Request (Mid-Flight Unplanned Feature)

**Trigger**: User requests a feature that is NOT in the current FRD while development is in progress.
**Reference**: Full protocol in [change-request](change-request/SKILL.md) skill

> [!WARNING]
> **STOP IMMEDIATELY if user asks for a feature not in tech-spec.md!**
> Do NOT write code until this protocol is complete.

### CR Detection Signals
- "Can you also add..."
- "I forgot to mention..."
- "One more thing..."
- "Actually, let's include..."
- Any feature request not traceable to an FR-ID

### CR Protocol Execution

**Announce**: "CR Protocol Triggered. Executing..."

### Step CR-1: Tech Spec Update First (The Law)
1. **Analyze Context**: Determine which section of `tech-spec.md` this belongs to.
2. **Update Tech Spec**: Open `AI_DOCS/planning/tech-spec.md`.
   - Update Section 2 (Scope), relevant feature sections, Section 18 (Test Cases), Section 19 (Sequence Diagrams)
   - Append to Change Log
3. **Append to** `AI_DOCS/memory/decision-log.md`: note the change request and reason.

#### Step CR-2: Update Task Tracking
1. Open the active milestone's `tasks.md` and add the new feature as a `TODO` row. Update `task-ledger.md` progress count for this milestone.
   - Use format: `[ ] [feature name] — [brief description]`
2. Update `AI_DOCS/memory/project-context.md` active milestone if needed

#### Step CR-3: Execution Order
**PROHIBITED** from writing production code until:
1. Tech spec section for this feature is written and shows the design intent (if UI involved)
2. API contracts documented in tech spec
3. User approval received

**Example Response**:
```
CR Protocol Triggered.

Step 1: Updated tech-spec.md
- Added Section: Profile Picture Upload
- API: POST /api/users/:id/avatar
- Acceptance: JPEG/PNG only, max 5MB

Step 2: Added to active milestone's tasks.md
- `| T-NN | Profile Picture Upload — backend API + frontend form | TODO | ... |`

Step 3: Awaiting your approval before coding.
```

---

## ▶️ WORKFLOW D: Session Restore (Resume Work)

**Trigger**: User wants to continue where they left off, OR AI context was lost.

> [!TIP]
> Use this protocol when starting a new session on an existing project.

### Step 1: Read Core Memory Files

```
1. Open AI_DOCS/memory/session-state.md → Find: Active milestone, Active task, Next action
   Also open AI_DOCS/memory/task-ledger.md → Find: Milestone progress overview

2. Open AI_DOCS/memory/implementation-plan.md
   → Find: Project Context, Technology Selection, Key Decisions
```

### Step 2: Restore Context Hierarchy

| Priority | File | What It Tells You |
|----------|------|-------------------|
| **P0** | `project-context.md` | Stack, library, stage, active milestone, all gate status |
| **P1** | `session-state.md` + `task-ledger.md` + active milestone `tasks.md` | What was I working on? What's next? |
| **P2** | `decision-log.md` (last 5) | Why things were decided this way |
| **P3** | `AI_DOCS/planning/tech-spec.md` | Full project requirements and scope |
| **P4** | `AI_DOCS/design/design-dna.md` | Theme, colors, typography decisions |
| **P5** | `AI_DOCS/design/component-registry.md` | All built components and import paths |

### Step 3: Verify State

Confirm you know: project name/type, full tech stack, component library, design DNA, active milestone, active task, SDLC stage, all gate statuses, and next action. **If any are unclear, ask the user.**

### Step 4: Sync CLAUDE.md

Check if `CLAUDE.md` exists. If out of sync with `project-context.md`, run [project-context](../project-context/SKILL.md) to update. If missing, generate it.

### Step 5: Resume Work

Update `session-state.md` with restore timestamp. Announce to user: project, stack, active milestone, active task, stage, and next action. Ask "Ready to continue?"

---

## 👋 WORKFLOW E: Developer Onboarding (New Team Member)

**Trigger**: A new developer joins an existing project. They say "I'm new to this project", "Onboard me", "I just joined", or `AI_DOCS/` exists but user says they haven't worked on this before.

### Step 1: Read Project Context

```
1. Read CLAUDE.md → project name, stack, current stage
2. Read AI_DOCS/memory/project-context.md → active milestone, branch, gates
3. Read AI_DOCS/memory/session-state.md + task-ledger.md → what's being worked on
```

### Step 2: Ask Configuration Questions

Ask the new developer:
1. Do you have the `.env` file from your team lead? (If not, show `.env.example` contents)
2. Do you need the AI Skills framework? (`.claude/skills/` — copy from shared location)
3. Check active milestone branch from `project-context.md`

### Step 3: Automated Setup

Run: `npm install` (or equivalent), `npx husky install`, `git checkout [milestone-branch]`, verify `.env` exists.

### Step 4: Context Briefing

Announce: project name/type, stack, active milestone, current branch, next task assignment. Point them to key files: `tech-spec.md`, `api-contract.md`, `component-registry.md`, `design-dna.md`. Note that coding rules are auto-enforced via `.claude/rules/` and to read `.github/PULL_REQUEST_TEMPLATE.md` before first PR.

---

## 🤖 WORKFLOW F: AI-Enable Existing Project

**Trigger**: User has an existing working project and wants to add AI memory/context without changing code.

> [!NOTE]
> Depth levels (Minimal, Standard, Full) are defined in the Triage Routing section. This is the workflow entry point.

### Step F-1: Scan Existing Codebase
Read `package.json` / `requirements.txt` / `pubspec.yaml` to detect:
- Framework and key libraries
- Scripts (start, build, test)
- Any existing README or docs

### Step F-2: Ask Minimal Questions
1. What is this project? (name, purpose, target users)
2. What's the current state? (what's built, what's in progress)
3. What tech stack is confirmed? (validate against scan)

### Step F-3: Initialize AI_DOCS Structure
Create only if not exists:
- `AI_DOCS/memory/project-context.md` — fill from scan + user answers
- `AI_DOCS/memory/session-state.md` — current state
- `AI_DOCS/memory/task-ledger.md` — milestone summary (seeded by /plan)
- `AI_DOCS/memory/decision-log.md` — empty log
- `AI_DOCS/requirements/` — directory for raw client source documents (move a legacy root `requirement.md` here if one exists, and log the move in `decision-log.md`)
- `AI_DOCS/ingested/` — directory for markdown conversions of ingested sources (populated by `markitdown` as sources are added)
- `AI_DOCS/planning/tasks/` — directory for task-planner
- `CLAUDE.md` — project root (run `claude-md` skill)

### Step F-4: Startup Protocol (Mandatory)
Every skill run on this project from now on MUST read these files at startup before taking any action:
1. `AI_DOCS/memory/project-context.md`
2. `AI_DOCS/memory/gate-status.md`
3. `AI_DOCS/memory/task-ledger.md` (milestone summary)
4. `AI_DOCS/memory/session-state.md`
5. Active milestone's `AI_DOCS/milestones/M<NN>-<slug>/tasks.md` (task detail)

### Depth levels (chosen in Triage Routing)

| Level | Adds |
|---|---|
| Minimal | `CLAUDE.md`, `project-context.md`, `session-state.md`, `AI_DOCS/planning/tasks/`. Ask: project name and type, tech stack, current stage, active milestone or focus area |
| Standard | Minimal, plus a codebase scan (framework, libraries, folder structure, existing API routes and DB models) written into `project-context.md`, and `AI_DOCS/architecture/api-contract.md` listing discovered endpoints marked "reverse-engineered, not formally verified" |
| Full | Standard, plus `AI_DOCS/planning/tech-spec.md` generated from the code (overview, features from routes, API contracts from handlers, schema from models/migrations), every section tagged `[REVERSE-ENGINEERED]`, and the `guardrails` skill run to generate `.claude/rules/` for the confirmed stack |

### Step F-5: Summary
Announce what was created and suggest next action:
```
✅ AI-enabled: [project name]
Memory files created in AI_DOCS/memory/
CLAUDE.md generated at project root.

When you give me any task, I'll:
1. Create a plan in AI_DOCS/planning/tasks/ first
2. Execute step by step
3. Update memory after each step
4. Offer git commit when done

Ready. Describe your first task or run /task-planner.
```

---

## Framework Reference

**Execution order**: workscope (Gate 0) -> tech-specification (Gate 1) -> design-system (Gate 2/3) -> build (Gate 4) -> qa-testing (Gate 5)

**Critical Rules** (see [CORE_CONCEPTS.md](CORE_CONCEPTS.md) for full definitions):
1. **Memory-Based Task Tracking**: Milestone status in `AI_DOCS/memory/task-ledger.md` (global summary) and per-milestone task status in `AI_DOCS/milestones/M<NN>-<slug>/tasks.md` — Status: TODO / DOING / DONE / BLOCKED / SKIPPED
2. **Shadow Mirror**: Design in `AI_DOCS/design/src/`, production in `apps/` or `src/`
3. **Container Pattern**: Import design components, never copy-paste-edit
4. **No Shortcuts**: Never create code without updating docs first (no Ghost Features)
5. **Multi-Workflow Awareness**: Always detect which workflow before taking action

**Project Type Rigor**:
- **POC**: 1-2 page PRD, 10-20 requirements, 1-3 screens, 98% coverage (lines, branches, functions)
- **MVP**: 5-10 page PRD, 50-100 requirements, 10-15 screens, 98% coverage (lines, branches, functions)
- **Production-Grade**: 15-30+ page PRD, 100-300+ requirements, full design system, 98% coverage (lines, branches, functions)

**Success Criteria**: All decisions logged, project-context current, task-ledger.md and milestone capsules current, gate-status current, session-state.md current, all code traces to tech-spec, all components registered, all features spec'd before coded.

**Memory Integration**: All skills use [memory-protocol](../memory-protocol/SKILL.md). Every response ends with Suggested Next Actions (3 options).

*Part of AI_PROMPT Framework — Multi-Workflow Architecture*
<!-- Version: 1.6.1 | 2026-10-14 | Estimation-first option describes the ADF estimation v6 skill (no dual estimate, no sales-collection dependency). -->

<!-- Version: 1.6.2 | 2026-10-21 | effort set per the v4.28.0 cost policy -->

<!-- Version: 1.7.0 | 2026-10-22 | v4.32.0: project-kickoff merged in as the Triage Routing section (question flow, routing table, Workflow F depth levels), entry check and detection matrix repointed -->
