---
paths:
  - "AI_DOCS/planning/**"
  - "AI_DOCS/milestones/**"
  - "AI_DOCS/memory/project-context.md"
---

# SDLC Methodology Rules

> Loaded by `milestone-planning` and `/do` (including its Phase 3) whenever a project's
> `sdlc_methodology` is set. The methodology is captured once in `/do` intake
> (Question 7) and stored as `sdlc_methodology:` in
> `AI_DOCS/memory/project-context.md`. This file defines each option and exactly
> what each one changes downstream, so the choice is not cosmetic: it reshapes
> how milestones are grouped, how often code is released, and whether work
> iterates or runs in sequence.
>
> Format: short, enforceable. Each methodology is a contract the planning and
> release skills must honor.

## Rule 1: The choice is mandatory and stored

`/do` asks the methodology question on every non-POC project. The answer is
written to `project-context.md` as `sdlc_methodology: <agile-scrum-devops | scrum | kanban | waterfall>`.
A project with no `sdlc_methodology` value defaults to `agile-scrum-devops` and a
note is appended to `decision-log.md` recording the default was applied.

## Rule 2: Recommended default is Agile + Scrum + DevOps

This is the framework default and the recommendation `/do` leads with. It is the
combination that fits most projects:

1. Requirements gathering: business goals + user stories, prioritized backlog.
2. Sprint planning (1-2 week sprints): select stories, define acceptance criteria.
3. Design: architecture + technical design, kept lightweight and iterative.
4. Development: coding standards, code reviews, version control.
5. Testing: unit, integration, automated regression.
6. CI/CD pipeline: automated build, test, and deploy (planned and created, executed only on approval, see Rule 7).
7. Release: deploy frequently in small increments.
8. Monitoring and feedback: track performance, errors, user feedback, feed back into the backlog.

When this methodology is set, downstream skills MUST:

- `milestone-planning`: size each milestone to roughly one sprint of work (1-2 weeks). Group its tasks under a sprint header with a sprint goal and per-task acceptance criteria. Keep no more than 2 milestones in flight (existing Critical Rule 1).
- `milestone-validation`: run regression + the milestone E2E suite at every milestone close (Definition of Done includes automated regression green).
- `deployment-planning` / `infra-planning`: design a CI/CD pipeline and produce its workflow files, but leave them disabled/unpushed until the user confirms full scope is done (Rule 7).
- Post-release: a monitoring/feedback step feeds findings back to the backlog via `change-request`.

## Rule 3: Scrum only

Same sprint cadence and ceremonies as Rule 2, without the DevOps continuous-delivery emphasis. Downstream effect:

- `milestone-planning`: sprint-sized milestones, sprint goals, story points/estimates per task, a backlog ordering. Ceremony artifacts (sprint review note at milestone close) are produced.
- Releases happen per the user's chosen branching promotion, not necessarily every sprint. CI/CD is still planned but release frequency is the user's call.

## Rule 4: Kanban

Continuous flow, no fixed-length sprints. Downstream effect:

- `milestone-planning`: milestones become flow buckets ordered by the dependency graph (`rules/vertical-slice-rules.md` + the data-dependency ordering). Tasks pulled by priority, not batched into sprints.
- Enforce a WIP limit: no more than 2 features `DOING` at once across the active milestone. Record the WIP limit in `project-context.md`.
- No sprint headers in `tasks.md`. Tasks carry a priority/pull order instead.

## Rule 5: Waterfall

Sequential phases, minimal iteration. Downstream effect:

- `milestone-planning`: milestones map to phases (requirements → design → build → test → deploy) and run strictly in order. A phase milestone does not start until the prior phase milestone is fully DONE and gated.
- No "2 milestones in flight" overlap: exactly one phase milestone is active.
- Design is completed for the whole scope before build begins (closer to Design-First in the milestone-planning approach question).
- Change is expensive: any mid-flight change routes through `change-request` with explicit re-baselining, and the user is told the sequential cost.

## Rule 6: Methodology does not override the within-milestone approach

`milestone-planning` Question Set A (Design-First / Feature-by-Feature / Hybrid)
governs execution order INSIDE a milestone and is independent of the SDLC
methodology, which governs how milestones are grouped and released. Both are
captured. They compose: for example Agile+Scrum+DevOps with Hybrid means
sprint-sized milestones, each built feature-by-feature with design leading by
1-2 features. Waterfall pins the within-milestone approach to Design-First.

## Rule 7: Deployment stays deferred regardless of methodology

No methodology authorizes deploying before the user confirms full scope is done.
DevOps means the pipeline is automated and ready, not that the framework ships
without approval. CI/CD workflow files may be planned and created, but remain
disabled/unpushed until the Gate 5 full-scope approval. AI never runs a deploy
command. See `ops-safety-rules.md` and the `deployment-planning` /
`deployment-execution` skills.

<!-- Version: 1.0.0 - 2026-06-23 - New rule: SDLC methodology selection (Agile+Scrum+DevOps default) and downstream consumption by milestone-planning, milestone-validation, deployment-planning. -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
<!-- Version: 1.0.1 | 2026-10-22 | v4.32.0: team-release retired, loader list now names /do Phase 3 instead -->
