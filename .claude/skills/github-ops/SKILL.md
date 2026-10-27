---
name: github-ops
description: "Manage git branching (main/develop/staging/milestone-N), the project's chosen branching strategy (1-branch-per-milestone vs per-feature; 2-tier vs 3-tier with staging), commit protocol, PR workflow, SemVer tagging, and releases. Reads AI_DOCS/deployment/git-strategy.md. Use when committing, creating branches, making PRs, merging, promoting, or tagging releases. Also triggers on: 'Push', 'Merge', 'Start milestone', 'Finish milestone', 'Promote to staging'."
mcp_integrations: [github]
next_skill: null
skill_id: SK-021
context_budget:
  load_kb: 30
  scope: task
version: 1.5.0
dependencies:
  required: [session-management]
  optional: [deployment-planning, deployment-execution, milestone-planning]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---
# GitHub Operations — Branching Strategy & Git Lifecycle

> **Purpose**: Enforce the project's Git branching model from day one through production release.
> **This skill is the law for all version control operations.**

## MCP Acceleration

Per `.claude/rules/mcp-rules.md`, use these MCP servers to work faster (free servers are auto-provisioned in the project `.mcp.json`, and gated servers need approval + `${ENV_VAR}` credentials):

- `github` (gated): create branches, PRs, issues, and releases through the GitHub API instead of manual shell git.

---

## Initialization & Memory Logic
> [!NOTE]
> Memory initialization handled by [session-management](../session-management/SKILL.md). Always read `AI_DOCS/memory/project-context.md` before any git operation.

---

## Consent Gate (MANDATORY)

> [!CRITICAL]
> This skill executes git commands on the user's behalf. It MUST NOT run unless explicitly enabled.

At project start (or first git operation request), ask once:

> "Do you want me to execute Git operations directly (commits, branches, PRs)?
> - **YES** — I will run git commands. Confirm GitHub PAT is configured if using MCP.
> - **NO** — I will show you the exact commands to run manually."

**If NO**: Output all commands in a fenced `bash` block. Never execute them.
**If YES**: Proceed with all operations below.

---

## Branching Strategy — read `git-strategy.md` FIRST (source of truth)

> [!CRITICAL]
> The branching model is NOT hardcoded. Read `AI_DOCS/deployment/git-strategy.md` (set in `/do` intake, Question 8) and apply the chosen strategy. The model in the next section is the DEFAULT; the project's recorded choice wins.

| ID | Strategy | Milestone branches | Promotion tiers |
|---|---|---|---|
| **S1** (recommended, default) | One branch per milestone | ALL of a milestone's features commit on `milestone-N` (no `feat/` branches) | milestone-N → develop → **staging** → main |
| **S2** | One branch per milestone, early-stage | same single `milestone-N` branch | milestone-N → develop → main (no staging) |
| **S3** | Per-feature branches (legacy) | `feat/mN-*` branches under `milestone-N` | milestone-N → develop → staging → main |

- Under **S1/S2**, skip the `feat/` branch lifecycle (Phase 2.1): commit features directly on `milestone-N` (still one commit per concern, still the commit format below). PRs are milestone → develop (→ staging → main).
- Under **S3**, use the full `feat/` lifecycle below.
- **Staging tier (S1/S3)**: `develop → staging` for QA, then `staging → main` for production. S2 skips `staging`.

### `git-strategy.md` template

```markdown
# Git Strategy
Chosen: S1 (one-branch-per-milestone, 3-tier)
Tiers: milestone-N -> develop -> staging -> main
Re-ask each milestone: yes

## Per-milestone promotion decisions
| Milestone | Decision | Date |
|---|---|---|
| M01 | develop -> staging -> main (released v1.0.0) | 2026-06-23 |
| M02 | held on develop (batch with M03) | ... |
```

### Per-milestone re-ask (MANDATORY)

At each milestone close, `/do` asks how to promote this milestone: promote per strategy now, hold on develop, switch strategy, or (early-stage) release develop → main directly. Record the answer in the table above and apply it. The strategy can evolve: a project may start S2 and add the staging tier (S1) once it matures.

---

## Pre-Flight: Gitignore Verification (BEFORE FIRST COMMIT)

> [!CRITICAL]
> Before any git operation, verify `.claude/skills/` is in `.gitignore`.
> Rules and settings ARE committed (team-wide). Skills framework is NOT.

**Check**:
```bash
grep -q "\.claude/skills/" .gitignore && echo "OK" || echo "MISSING — add .claude/skills/ to .gitignore"
```

**If missing, add**:
```bash
echo -e "\n# Claude Code — skills NOT committed, rules + settings ARE\n.claude/skills/\n.claude/settings.local.json" >> .gitignore
```

**Required `.gitignore` entries for all projects**:
```
.claude/skills/
.claude/settings.local.json
.env
.env.*
*.pem
*.key
node_modules/
dist/
build/
```

---

## Branching Model (The Law)

```
main
 └── develop
      ├── milestone-1
      │    ├── feat/m1-[short-name]
      │    ├── feat/m1-[short-name]
      │    └── feat/m1-[short-name]
      ├── milestone-2  ← branched FROM milestone-1 (NOT from develop)
      │    ├── feat/m2-[short-name]
      │    └── feat/m2-[short-name]
      └── milestone-N  ← always branched from milestone-(N-1)
```

### Branch Purposes

| Branch | Purpose | Who merges into it | Merge direction |
|---|---|---|---|
| `main` | Production-only. Represents deployed code. | Release PR (from `staging` in 3-tier, from `develop` in 2-tier) | `staging`/`develop` → `main` |
| `staging` | Pre-prod QA (3-tier only). Mirrors production for release testing. | Promotion PR from `develop` | `develop` → `staging` |
| `develop` | All milestone code. Integration branch. | Milestone completion PR | `milestone-N` → `develop` |
| `milestone-N` | All features for milestone N. | Feature PRs | `feat/mN-*` → `milestone-N` |
| `feat/mN-[name]` | Single feature or task. | Developer directly | → `milestone-N` via PR |

### Rules — Non-Negotiable

1. **NEVER commit directly to `main`**. Production code only arrives via PR from `develop`.
2. **NEVER commit directly to `develop`**. Only merged from completed milestone branches.
3. **NEVER create `milestone-2` from `develop`** — always branch from `milestone-1` so all M1 features are included.
4. **Every feature = a branch**. No exceptions, no "quick fixes" directly on milestone branches.
5. **Every merge = a PR**. Even if you are the only developer.

---

## Phase 1: Project Initialization (Run Once)

When a new project is initialized via `session-management` Workflow A:

```bash
git init
git add .
git commit -m "chore: initial project scaffold"
git branch -M main
git checkout -b develop
git checkout -b milestone-1
git checkout develop
```

> After this, the active working branch is `develop`. Feature branches are cut from `milestone-1`.

Write to `AI_DOCS/memory/project-context.md`:
```
## Git State
- Active Branch: milestone-1
- Develop Branch: develop
- Production Branch: main
- Current Milestone Branch: milestone-1
```

---

## Pre-merge security offer (every merge below)

Before any merge in sections 2.3, 3 and 5 (feature to milestone, milestone to develop, develop to staging or main), list the files the merge brings in (`git diff --name-only <target>...<source>`) and match them against the sensitive-area pattern in `skills/deep-security-audit/SKILL.md`. On a match, ask once, in that skill's offer format:

```
Security check: merge <source> -> <target> touched <N> sensitive files (<top 3 paths>).
Run a deep security audit now? Profile quick, about <A> agent calls, scope the merge diff.
[yes / no / later]
```

- **yes**: run `deep-security-audit` scoped to the merge diff, then continue with the merge only after `/audit` check 13 is not FAIL.
- **no** or **later**: log it to `decision-log.md` and merge. The offer never blocks by itself.
- Do not ask again for the same HEAD, or when `AI_DOCS/audit/security-summary.md` already covers it.
- For a merge into `main` that is the project's first production release, offer the `standard` profile instead.

---

## Phase 2: Feature Branch Lifecycle

### 2.1 Starting a Feature

When a developer begins a task from the active milestone's `tasks.md` (or `AI_DOCS/memory/task-ledger.md` milestone summary):

```bash
git checkout milestone-1          # or milestone-N for current milestone
git pull origin milestone-1       # sync before branching
git checkout -b feat/m1-[name]    # e.g., feat/m1-user-auth
```

**Branch naming rules**:
```
feat/m[N]-[short-kebab-name]

Examples:
  feat/m1-user-auth
  feat/m1-dashboard-layout
  feat/m2-payment-gateway
  fix/m1-login-validation       # bug fix on milestone branch
  chore/m1-env-setup            # setup/config work
```

**Branch prefix rules**:
| Prefix | When to use |
|---|---|
| `feat/` | New feature or user story |
| `fix/` | Bug fix |
| `refactor/` | Code restructure, no behavior change |
| `chore/` | Setup, config, dependencies |
| `docs/` | Documentation only |

### 2.2 Committing Work

**Every commit MUST follow this format**:

```
[TYPE]: Brief description (max 72 chars)

What: Detailed explanation of what changed
Why: Business/technical reason for the change
Impact: Files or modules affected

Refs: [FR-ID or Task ID from task.md]
Milestone: M[N]
```

**Types**: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`

**Examples**:
```
feat: implement JWT authentication middleware

What: Added NestJS guard with JWT validation on protected routes
Why: All API endpoints require authenticated access (FR-AUTH-001)
Impact: src/auth/, src/guards/, src/middleware/

Refs: FR-AUTH-001
Milestone: M1
```

**Rules**:
- Reference an FR-ID or Task ID in EVERY commit
- Never commit `console.log`, commented-out code, or `.env` files
- Commit `AI_DOCS/memory/` changes in a separate commit labeled `docs: update memory`

### 2.3 Completing a Feature (PR to Milestone Branch)

When a feature is done and passes code-quality + manual testing:

> [!IMPORTANT]
> **For ad-hoc fixes** (not part of a milestone task — e.g., user said "fix this bug" or "fix the error"):
> Show a diff/summary of all changes and ask **"Ready to push and create PR?"** before running any git push.
> **For planned milestone tasks**: follow user's direction — execute per the milestone plan.

```bash
git add [specific files]       # Never use git add -A blindly
git commit -m "feat: [summary]"
git push origin feat/m1-[name]
```

Then create a PR:
- **From**: `feat/m1-[name]`
- **To**: `milestone-1`
- **Title**: `[FR-ID] Brief description`
- **Body**: Use PR template below

**PR Body Template**:
```markdown
## Summary
- [What was built]
- [FR-IDs covered]

## Test Evidence
- [ ] Unit tests passing
- [ ] Manual smoke test done
- [ ] No console.log in production code
- [ ] Guardrails checked

## Memory Updated
- [ ] task.md updated
- [ ] component-registry.md updated (if UI work)
- [ ] decision-log.md updated (if new decision made)
```

---

### 2.4 Finishing a Branch (offer four options)

When work on a branch is complete and its tests pass, do not pick the ending for the user. Run the suite first (a failing suite means stop and fix, not offer), then present exactly these four options with a recommendation:

1. **Merge locally** into the base branch (the milestone branch, or `develop` for a plain feature).
2. **Push and open a PR** (default when the Consent Gate is YES and a remote exists, and the only choice when the base branch is protected).
3. **Keep the branch** as it is, with no merge and no push. Note it in `project-context.md` ## Git State so it is not forgotten.
4. **Discard it.** This deletes work, so list what would be lost (branch name, commit count, the commit subjects) and require the user to type `discard` before running `git branch -D`. Never discard on a bare "yes".

Per option:

| Option | Steps | Then |
|---|---|---|
| Merge locally | `git checkout <base>`, `git pull origin <base>`, `git merge --no-ff <branch>` | Re-run the test suite on the MERGED result (see below), then delete the branch with `git branch -d` only if tests pass |
| Push and PR | Show the diff summary and ask "Ready to push and create PR?" (push is an external operation), then push and open the PR per 2.3 | Keep the branch until the PR merges |
| Keep | Nothing to run | Record it and stop |
| Discard | Confirmation above, then `git checkout <base>` and `git branch -D <branch>` | Remove any worktree for the branch |

**Re-run the tests on the merged result.** A branch can pass alone and fail once combined with what landed on the base since it was cut. After a local merge, run the project's full test command (through `scripts/quiet-run.sh` for long suites) on the merged tree before saying the work is done. If it fails, the merge is not done: report the failure, and do not push or delete the branch. Reset only with the user's confirmation (the destructive git block applies).

If the Consent Gate answer is NO, print the commands for the chosen option instead of running them.

---

## Phase 3: Milestone Completion (Merge to Develop)

When ALL features in a milestone are merged to `milestone-N` and QA has signed off (Gate QA-PASS):

```bash
git checkout develop
git pull origin develop
git merge --no-ff milestone-1 -m "feat(M1): merge milestone-1 — [Milestone Name] complete"
git push origin develop
git tag -a v0.1.0 -m "Milestone 1 complete: [Milestone Name]"
git push origin --tags
```

Write to `AI_DOCS/memory/project-context.md`:
```
- milestone-1: COMPLETE — merged to develop [YYYY-MM-DD]
```

Update `AI_DOCS/memory/milestone-status.md`:
```
| M1 | [Name] | COMPLETE | [date] | develop |
```

> [!IMPORTANT]
> **Per-milestone promotion re-ask.** After merging to `develop`, do not auto-promote to staging/main. `/do` asks the user how to promote this milestone (per strategy now / hold on develop / switch strategy / release develop → main while early). Apply the answer and log it in `git-strategy.md`. Promotion past `develop` and any deploy stay deferred to Gate 5 or explicit per-milestone approval.

---

## Phase 4: Starting the Next Milestone

> [!CRITICAL]
> **ALWAYS branch next milestone from the PREVIOUS milestone, NOT from develop.**
> This ensures all features from M(N-1) are included in M(N).

```bash
git checkout milestone-1          # the completed milestone
git checkout -b milestone-2       # branch FROM milestone-1
git push origin milestone-2
```

Update `AI_DOCS/memory/project-context.md`:
```
- Current Milestone Branch: milestone-2
- Active Branch: milestone-2
```

---

## Phase 5: Production Release (3-tier: Develop → Staging → Main; 2-tier: Develop → Main)

When `develop` is stable, the release scope is complete, and the deployment checklist is cleared. For **3-tier (S1/S3)**, promote through `staging` and run QA there first:

```bash
# 3-tier only: promote to staging and run QA against the staging deploy
git checkout staging && git pull origin staging
git merge --no-ff develop -m "release-candidate: v[VERSION] to staging"
git push origin staging
# ... run the release E2E + smoke tests against the staging environment ...

# then promote to production (2-tier skips staging and merges develop -> main)
git checkout main && git pull origin main
git merge --no-ff staging -m "release: v[VERSION] — [release summary]"   # 2-tier: merge develop
git push origin main
git tag -a v[VERSION] -m "Release v[VERSION]: [summary]"
git push origin --tags
```

**Versioning (SemVer)**:
- `v1.0.0` — First production release (all M1 milestones)
- `v1.1.0` — New milestone/feature set
- `v1.1.1` — Hotfix on production
- `v2.0.0` — Major breaking change or full rewrite

---

## Phase 6: Hotfix on Production

If a critical bug is found on `main` after release:

```bash
git checkout main
git checkout -b fix/hotfix-[description]
# make fix
git commit -m "fix: [description] — hotfix"
git push origin fix/hotfix-[description]
# PR to main → merge
# Then backport to develop
git checkout develop
git merge --no-ff fix/hotfix-[description]
git push origin develop
```

---

## Branch State Reference

Always write the current git state to `AI_DOCS/memory/project-context.md` under `## Git State`:

```markdown
## Git State
- Production Branch: main
- Integration Branch: develop
- Current Milestone Branch: milestone-[N]
- Active Feature Branches: [list or "none"]
- Last Merged: [branch] → [target] on [date]
- Last Tag: v[X.Y.Z]
- Next Release Target: v[X.Y.Z]
```

---

## CLAUDE.md Git Section

When `claude-md` skill runs, it will include this section in CLAUDE.md:

```markdown
## Git Workflow
- Production: `main` (never commit directly)
- Integration: `develop` (merged from milestones only)
- Active milestone: `milestone-[N]`
- Feature branches: `feat/mN-[name]` → PR → `milestone-N`
- Milestone completion: `milestone-N` → PR → `develop`
- Release: `develop` → PR → `main` (tagged)
- Next milestone: branch from PREVIOUS milestone, not develop
```

---

## Quick Command Reference

| Action | Command |
|---|---|
| Start feature | `git checkout milestone-N && git checkout -b feat/mN-name` |
| Save progress | `git add [files] && git commit -m "feat: ..."` |
| Push feature | `git push origin feat/mN-name` |
| Complete milestone | `git checkout develop && git merge --no-ff milestone-N` |
| Start next milestone | `git checkout milestone-N && git checkout -b milestone-(N+1)` |
| Release to production | `git checkout main && git merge --no-ff develop` |
| Tag release | `git tag -a vX.Y.Z -m "Release vX.Y.Z"` |

---

## Rules Integration

> Claude Code auto-loads these rules when editing matching files:
> - `.claude/rules/development-rules.md` — git discipline, commit messages, branch naming

## Rules Summary

1. `main` = production. Touch only via tagged release PR.
2. `develop` = integration. Touch only via milestone completion PR.
3. `milestone-N` = M(N) staging. Touch only via feature PRs.
4. `feat/mN-*` = your daily workspace. Free to commit here.
5. Every merge uses `--no-ff` to preserve history.
6. Every release gets a SemVer tag.
7. `milestone-N+1` always branches FROM `milestone-N`.
8. Never `git add -A` without reviewing what's staged.
9. Never bypass commit message format.
10. Update `AI_DOCS/memory/project-context.md` ## Git State after every milestone event.

<!-- Version: 1.4.0 | 2026-10-22 | pre-merge security offer: merges that bring in auth, payment, tenant or other sensitive files ask once whether to run deep-security-audit (SK-169) -->
<!-- Version: 1.5.0 | 2026-10-22 | New 2.4 Finishing a Branch: four options (merge locally, push and open a PR, keep, discard with typed confirmation) and a full test run on the merged result before declaring done. Idea from obra/superpowers finishing-a-development-branch. -->
