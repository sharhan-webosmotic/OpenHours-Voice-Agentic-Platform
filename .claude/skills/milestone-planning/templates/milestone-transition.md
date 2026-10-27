# Milestone Transition Protocol

> **Purpose**: Define the exact steps for completing one milestone and starting the next.
> **When to use**: When all features in milestone-N are merged, QA has passed, and the team is ready to begin milestone-(N+1).
> **Skill**: milestone-planning (run this checklist)

---

## Pre-Transition Checklist (Before closing M[N])

### Code
- [ ] All `feat/mN-*` branches merged into `milestone-N` via PR
- [ ] No open PRs targeting `milestone-N`
- [ ] All failing tests resolved
- [ ] Code quality gate passed (Gate 1.5)
- [ ] QA sign-off received (Gate 4)

### Documentation
- [ ] `AI_DOCS/milestones/M<NN>-<slug>/tasks.md`: all M[N] tasks marked `[x]`
- [ ] `AI_DOCS/planning/tech-spec.md` — all M[N] sections implemented (no gaps)
- [ ] `AI_DOCS/design/component-registry.md` — all M[N] components registered
- [ ] `AI_DOCS/memory/decision-log.md` — all M[N] decisions recorded

### Git
- [ ] `milestone-N` merged into `develop` via PR (`--no-ff`)
- [ ] Release tag created on `develop` (e.g., `v0.N.0`)
- [ ] `develop` is stable and all CI checks pass

---

## Transition Steps

### Step 1: Close Out Milestone-N in Memory

Update `AI_DOCS/memory/project-context.md`:
```
## SDLC State
- Previous Milestone: M[N] — [Name] — COMPLETE [YYYY-MM-DD]
- Active Milestone: M[N+1] — [Name] — IN PROGRESS
- Current Stage: Development
```

Update `AI_DOCS/memory/milestone-status.md`:
```
| M[N] | [Name] | COMPLETE | [YYYY-MM-DD] | Merged to develop. Tag: v0.N.0 |
| M[N+1] | [Name] | IN PROGRESS | [YYYY-MM-DD] | Branched from milestone-N |
```

### Step 2: Create Next Milestone Branch (from previous milestone)

> [!CRITICAL]
> Branch `milestone-(N+1)` FROM `milestone-N`, NOT from `develop`.
> This ensures ALL features from M[N] are inherited by M[N+1].

```bash
git checkout milestone-[N]
git checkout -b milestone-[N+1]
git push origin milestone-[N+1]
```

### Step 3: Update task.md for New Milestone

Archive completed milestone section (mark as ARCHIVED) and add new section:

```markdown
## M[N+1] — [Milestone Name]
Status: IN PROGRESS
Branch: milestone-[N+1]
Started: [YYYY-MM-DD]

### Tasks
- [ ] T-M[N+1]-01 — [first task]
- [ ] T-M[N+1]-02 — [second task]
```

### Step 4: Update gate-status.md

Reset design/development gates for new milestone:
```
Gate 3 (Design Approved — M[N+1]): PENDING
Gate 4 (QA Sign-off — M[N+1]): PENDING
```
> Gates 0 and 1 do NOT reset — workscope and tech-spec are cumulative, not per-milestone.

### Step 5: Update CLAUDE.md

Run `claude-md` skill to regenerate CLAUDE.md with:
- Active milestone updated to M[N+1]
- Git state updated
- Gate status updated

### Step 6: Announce Transition

Announce to user:

```
Milestone M[N] — [Name] — CLOSED
✓ All features merged to milestone-[N]
✓ milestone-[N] merged to develop
✓ Tagged: v0.[N].0

Milestone M[N+1] — [Name] — STARTED
✓ Branch created: milestone-[N+1] (from milestone-[N])
✓ task.md updated with M[N+1] tasks
✓ CLAUDE.md updated

Ready to start feature development on milestone-[N+1].
First feature branch: feat/m[N+1]-[first-feature]
```

---

## Notes

- **Never skip the gate checks** before transitioning. QA sign-off is mandatory.
- **Design can be partial** — not all M[N+1] screens need to be designed before development starts. Design leads development by at least 1 sprint.
- **Tech spec is cumulative** — do not create a new tech-spec.md for M[N+1]. Amend the existing one using the change-request protocol.
- **Component registry carries over** — all M[N] components are available in M[N+1] by inheritance.
