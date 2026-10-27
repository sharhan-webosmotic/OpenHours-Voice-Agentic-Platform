<!-- adf-version: 4.19.0 -->
# ADF Developer Guide
> How to get maximum value out of the App Development Framework.
> Practical tips, request patterns, memory hygiene, and escape hatches.

If `README.md` is "what this framework is," this file is "how to actually use it well." Read it once end-to-end, then keep it open while you work for the first week.

---

## 1. Mental model — four pillars

ADF is built on four composable pieces. Understanding how they interact is 80% of using the framework well.

| Pillar | Purpose | Lives in | You invoke by |
|---|---|---|---|
| **Skills** | Reusable work units (e.g. `/workscope`, `/task-planner`, `/qa-testing`). 95 of them. | `.claude/skills/` | Slash-command: `/skill-name` |
| **Agents** | Specialized reviewers and experts. 47 of them, across three tiers. | `.claude/agents/` | Skills delegate; you can also request by name ("ask the solutions-architect to review") |
| **Hooks** | Lifecycle enforcement (session start/end, pre-compact, anchor checks, chunk scope) plus event-driven detectors (chunk-review queue, memory curator, drift detector, milestone audit, state refresher). 47 shipped today. | `.claude/hooks/` | Fire automatically on events |
| **Memory** | Persistent state on disk so sessions survive. `AI_DOCS/memory/` + `AI_DOCS/quality/` + a few siblings | You or skills write to it; some files (user-prompts, drift-report, curator-suggestions, pending-reviews, milestone-audit-queue) are fully automatic |

> **The file is the memory, not the conversation.** This one sentence explains 90% of ADF's design. Every decision, gate verdict, approval, or user preference that matters must end up in a file. The conversation is ephemeral.

---

## 2. First 30 minutes on a new project

Follow this checklist in order. It sets up the entire framework correctly:

1. **Clone + setup** (once):
   ```bash
   cd my-project
   git clone https://github.com/bhavesh-WebOsmotic/claude-skills .claude
   bash .claude/setup.sh
   ```
2. **Run `/session-management`** (its Triage Routing section): generates `CLAUDE.md`, the `AI_DOCS/` skeleton, and asks the 5 questions that set the Project Overrides (is this a POC? is i18n needed? etc.). The stable `.claude-project-id` already exists at this point: `setup.sh` created it in step 1.
3. **Run `/brainstorm` if you're still exploring** — or skip straight to `/workscope` if the idea is clear.
4. **Run `/workscope`** — defines scope with acceptance criteria. Written to `AI_DOCS/planning/workscope.md`.
5. **Run `/tech-specification`** — produces tech-spec + API contract. This is Gate 1 territory.
6. **Sanity check**: run `bash .claude/skill-lab/run-all-tests.sh` to confirm the framework itself is healthy (expected: 29/29 compliant).

After these six steps you have: a stable project ID, memory skeleton, scope, tech spec, API contract, and a verified framework. You are ready to build.

---

## 3. The eleven habits of highly effective ADF use

### 3.1 Never skip `/task-planner` for anything non-trivial

If a task needs more than one file change or more than 15 minutes of work, run `/task-planner` first. It produces a chunked plan where each chunk is:
- Self-contained (~50–200 lines of spec)
- Compaction-safe (the chunk file *is* the context)
- Resumable (crash at any point → next session opens the chunk and continues)

Skipping the planner is the single biggest source of context loss and rework. v3.3 adds a nudge (`task-router.sh`) so you see the reminder automatically.

### 3.2 Name decisions out loud, so they get logged

When you make a choice mid-conversation — "use Postgres", "skip E2E tests for this milestone", "tenant model is per-schema" — say it as a statement, not a question. This triggers Claude to append to `AI_DOCS/memory/decision-log.md`. The last 5 decisions are automatically included in every compaction snapshot (v3.3 `pre-compact.sh`).

Bad: *"should we use Postgres?"* (discussion, not logged)
Good: *"Let's use Postgres — append that to the decision log."* (explicit, logged)

### 3.3 Trust the chunk-scope enforcer; don't fight it

In v3.3, when a chunk is active, edits to files outside its `## Files Affected` are blocked. This feels annoying the first time. It's actually saving you from scope creep and token waste. Three correct responses:

- **Edit a listed file**: obvious, do the work.
- **Add the file to the chunk**: if you legitimately need to touch it, update the chunk's `Files Affected` and retry.
- **Mark chunk done and advance**: signals that the current chunk is complete.

If you genuinely need to escape (e.g. exploratory refactor), set `CHUNK_SCOPE_ENFORCE=off` in `.claude/settings.local.json` env block. Don't leave it off.

### 3.4 Compact proactively at 60–70% usage

Don't wait for Claude Code to force a compaction. Watch the context indicator; at 60–70%, run `/compact` yourself. Why: at 60% you have slack to write a good `session-state.md` first. At 95% you're scrambling. v3.2's `pre-compact.sh` is a safety net, not a substitute for proactive compaction.

### 3.5 Use subagents for heavy reads

Auditing 20 files? Reviewing a full tech-spec? Use the Explore subagent (`/skill-authoring` wraps this nicely, or just call it directly). The subagent gets its own context window, does the heavy reading, and hands back a summary. Your main thread stays lean.

Rule of thumb: if the work needs more than 4 Read calls, delegate.

### 3.6 Request pattern: *goal + constraints + file:line*

The most effective prompts have three parts:

```
Add rate limiting to /auth/reset-request (goal).
Use token-bucket with 5 req/min per IP; Redis-backed (constraints).
Pattern to mirror: src/middleware/rateLimit.ts:12-45 (file:line).
```

Compare with: *"add rate limiting"* — Claude has to guess all three and will often get two wrong. Specify them yourself and quality goes up dramatically while token usage goes down.

### 3.7 Read the chunk file before every chunk

When a complex task resumes, the instinct is to re-read `plan.md` and maybe `context.md` "to get oriented." Don't. Read only the chunk file you're executing. Everything else is linked by `file:line` for when you need it. This is the core mechanism that keeps per-chunk context under 2k tokens.

### 3.8 Gate verdicts are machine-readable — treat them that way

Every reviewer gate (PD-SCOPE, SA-ARCH, EL-FEASIBILITY, QA-TEST-COVERAGE, PHASE-GATE, among others in `docs/governance-gates.md`) returns a verdict on line 1: `APPROVE`, `CONCERNS`, or `REJECT`. The per-flow Gate FLOW uses its own vocabulary: its rows in `gate-status.md` read `Gate FLOW <flow-id>: PASS`, `PENDING`, or `WAIVED`. Automation (and your eye) should read only line 1 to decide flow. If you find yourself reading a 200-line gate report to extract the decision, you're reading the wrong part.

### 3.9 Use `/milestone-validation` once per milestone, not per feature

ADF v3.1 deliberately moved the heavy 17-point audit from per-feature to per-milestone. Per-feature validation ran 17 checks 17 times across a milestone; per-milestone runs them once with cumulative context. Respect this — don't invoke `/milestone-validation` mid-feature.

### 3.10 When a queue surfaces on SessionStart, act on it before new work

Every session's banner may show: Pending Chunk Reviews, Memory Curator Suggestions, Drift Report, Milestone Audit Queue. Each is a short note pointing at a fixable issue. Processing them takes minutes and prevents the slow rot that turns a 2-week project into a 3-month one.

Order of action:
1. Memory Curator — cheapest, often just a truncation command
2. Pending Chunk Reviews — invoke `code-reviewer` with the listed chunk files
3. Milestone Audit Queue — run `/project-audit` if a milestone just closed
4. Drift Report — skim Phase A/B/C; patch or plan as needed

### 3.11 Commit `AI_DOCS/` often

`AI_DOCS/` is not build artifact — it's your project's memory. Commit it with every significant work item, at minimum once per milestone. The Stop hook warns about uncommitted `AI_DOCS/` changes for a reason. Lost memory is lost work.

---

## 4. Request patterns that work

| Situation | Best opening |
|---|---|
| New idea, not yet scoped | `/brainstorm <one sentence>` |
| Clear idea, ready to scope | `/workscope` |
| Need to add a feature | `/task-planner Add [feature] so that [goal]` |
| Fix a bug | `/task-planner Fix [bug]: [expected vs actual]. Repro: [steps].` |
| Big refactor | `/task-planner Refactor [X] to [Y]. Must not break: [contract]. Affected files: [paths].` |
| Explore "should we do X?" | `Ask the solutions-architect: should we [X]? Constraints: [list].` |
| End-to-end pipeline | `/do <feature>` (Phase 1 lead dispatch), release via `/do` Phase 3 plus `gate-enforcement` Gate 5 |
| Debug a framework issue | `bash .claude/skill-lab/run-all-tests.sh --batch` |
| Restore context after break | `/session-management` |

### Prompts to avoid

| Anti-pattern | Why it hurts | Do this instead |
|---|---|---|
| *"Look at the code and tell me what's wrong"* | Unbounded read, token burn | Name the file, the symptom, the expected behavior |
| *"Build me an auth system"* | No scope, will sprawl | `/workscope` first, then `/task-planner` |
| *"Fix all the tests"* | Unbounded; likely suppresses real failures | Paste one failure, ask for root cause, then fix |
| *"Make it better"* | No criterion | State the criterion: *"faster on N=10k rows,"* *"fewer re-renders,"* *"smaller bundle"* |

---

## 5. Memory hygiene

### 5.1 The Task Ledger (v3.7 — the compaction-survival file to know)

`AI_DOCS/memory/task-ledger.md` is where the three most important facts about your current work live, in a form engineered to survive compaction verbatim:

```markdown
<!-- @active-begin -->
## Active
Started:      ISO-timestamp
Task ID:      T-YYYY-MM-DD-NNN (or "ad-hoc")
Request:      <your originating ask, verbatim, scrubbed of secrets>
Plan:         <path to plan.md + chunk count>
Status:       <1-liner: "N done (C1 title, C2 title), M in progress, K pending">
Next action:  <short sentence>

### Progress log
- <timestamp> · <CN title STATUS — brief detail>
<!-- @active-end -->

## Archive (last 20, most recent first)
- <date> · "request summary" · <task-id> · <chunks> · commit <hash>
```

**How it stays current without you thinking about it:**
- `/task-planner` writes the Active block when a new task is opened (`ledger-writer.sh --open`)
- `post-chunk-review-detect.sh` appends a Progress log line and regenerates Status every time a chunk flips to DONE (`ledger-writer.sh --progress`)
- `/task-planner` Phase 5 close moves Active → Archive (`ledger-writer.sh --close`) — clears Active for the next task
- `pre-compact.sh` injects the Active block as the FIRST section of every compaction snapshot

**Why this matters for 100% output:** before v3.7, the originating user request decayed out of context after ~20 turns. Now it's pinned on disk and re-injected on every compaction — along with the plan pointer and a 1-liner of what's done.

**Read the ledger first** when resuming. The four header fields (Request, Plan, Status, Next action) give you the full operational picture in 4 lines. Everything else in `AI_DOCS/memory/` is supporting detail.

**Ad-hoc workflows** (no `/task-planner`): by default, the ledger isn't auto-populated. To enable auto-seed on task-intent prompts, set `LEDGER_AUTOSEED_ADHOC=on` in `.claude/settings.local.json` env block.

**Manual intervention:** you can hand-edit the ledger at any time. The sentinels (`<!-- @active-begin -->` / `<!-- @active-end -->`) must stay — hooks only rewrite content between them. The Archive section is append-only from the top.

---

### 5.2 The memory files, ranked by importance

Human-authored or skill-authored memory (you write here, or skills write on your behalf):

| File | Importance | Who writes it | Read when |
|---|---|---|---|
| `AI_DOCS/memory/session-state.md` | **Critical** — survival anchor | You + skills after major actions | Always, on resume |
| `AI_DOCS/memory/decision-log.md` | **Critical** — why, not what | You + skills on every choice | On resume, mid-compact |
| `AI_DOCS/memory/gate-status.md` | High | Gate skills | Before any gate-dependent work |
| `AI_DOCS/memory/ai-cost-approvals.md` | Critical **if** LLM in code | `/ai-cost-guard` | Before committing LLM-API code |
| `AI_DOCS/memory/security-findings.md` | High | `/audit`, `/team-security` | Before release |
| `AI_DOCS/memory/project-context.md` | High | `/project-context` | Any skill startup |

Fully automatic (hooks write these — you read them, never hand-edit unless noted):

| File | Written by | Purpose |
|---|---|---|
| `AI_DOCS/memory/user-prompts.log` | `user-prompt-log.sh` (v3.3) | Append-only log of every user turn — last 3 surface in compaction snapshot |
| `AI_DOCS/memory/compaction-snapshot.md` | `pre-compact.sh` (v3.2) | Audit copy of what was injected post-compact |
| `AI_DOCS/memory/pending-reviews.jsonl` | `post-chunk-review-detect.sh` (v3.4) | Queue of chunks marked DONE but not reviewed; update `status` manually once reviewed |
| `AI_DOCS/memory/curator-suggestions.md` | `memory-curator.sh` (v3.4) | Hygiene advisories (stale logs, old snapshot, queue depth). Delete to silence until next 24h window. |
| `AI_DOCS/quality/drift-report.md` | `drift-detector.sh` (v3.5) | Route + test coverage drift findings. Auto-deleted when drift clears. |
| `AI_DOCS/memory/milestone-audit-queue.jsonl` | `milestone-audit-detect.sh` (v3.5) | PHASE-GATE approvals awaiting `/project-audit`; update `status` to `reviewed` after running audit |
| `AI_DOCS/memory/infra-cost-approvals.md` | `/infra-cost-guard` (v4.2) | Infra cost approval ledger — read by `infra-cost-gate.sh` to allow provisioning commands. Append-only. |
| `AI_DOCS/memory/metrics.jsonl` | `log-event.sh` (v3.1) | Local-only telemetry event stream |
| `AI_DOCS/memory/.prompt-counter` / `.curator-last-run` / `.drift-last-run` | Internal state | Hook rate-limit and counter files. Never commit. |

### 5.3 Pruning

Monthly (or at milestone close):

- Archive completed tasks: `AI_DOCS/planning/tasks/active/` → `.../completed/`
- Compress `decision-log.md` older than 90 days into a summary row
- Truncate `user-prompts.log` if it exceeds ~5 MB: `tail -2000 user-prompts.log > tmp && mv tmp user-prompts.log`
- Truncate `metrics.jsonl` similarly
- Regenerate `CLAUDE.md` via `/project-context` so it reflects current state

### 5.4 What NEVER goes in memory

- Secrets, tokens, connection strings (the `scrub.sh` catches most but prevention is better)
- Pasted content from spec/API docs — always use `file:line` references
- Generated code (lives in `src/`, not memory)
- Large logs or test output — summarize, then drop

---

## 6. Token budget discipline

### 6.1 Targets

| Task size | Budget | Approach |
|---|---|---|
| Quick status / one-liner edit | **< 3k tokens** | No subagent, no extra reads |
| Medium feature / spec section | **< 8k tokens** | Chunk plan, read only chunk file |
| Heavy audit / architecture review | **< 15k tokens** | Use subagent; main thread stays lean |

If you're exceeding these, investigate before continuing — usually means you're re-reading files that were already referenced, or not using chunked execution.

### 6.2 Where tokens leak

Ranked by frequency of the issue:

1. **Re-reading the full `plan.md` instead of just the chunk file** — habit 3.7 fixes this.
2. **Pasting spec content into prompts** — always `file:line` instead.
3. **Reading all 17 rule files "just in case"** — PostToolUse and anchor hooks already enforce the relevant rules. Let them.
4. **Loading all 88 `SKILL.md` files via `/help`-style queries** — use `.claude/skills/SKILL-REFERENCE.md` (auto-loaded on SessionStart) instead.
5. **Running subagents for trivial reads** — each subagent spawn has overhead; use them only when the read is >4 files.

### 6.3 Verifying your budget

Ask Claude explicitly at the end of a session: *"How many tokens did the last task consume? Was it within budget?"* If the answer consistently breaches budget, revisit your request pattern (Section 4).

---

## 7. The chunked execution protocol (deep dive)

This is the core mechanism for "100% output with minimum tokens." When used correctly, context loss during compaction becomes almost irrelevant.

### 7.1 Lifecycle of a chunked task

```
/task-planner "Add password reset flow"
  ↓
[plan.md + chunk-01..NN-*.md written to AI_DOCS/planning/tasks/active/<slug>/]
  ↓
For each chunk in order:
  1. Read ONLY chunk-NN-*.md (not plan.md, not context.md)
  2. Read file:line references listed in that chunk
  3. Implement
  4. Run verification command from the chunk spec
  5. Append verification output to chunk file ("Verification Evidence" section)
  6. Mark chunk Status: DONE; update plan.md `[x]`; update INDEX.md progress
  7. /compact if context > 60%
  8. Next chunk
  ↓
All chunks done → Phase 5 close (re-verify goal, move to completed/)
```

### 7.2 What makes a chunk good

Every chunk must have:

- **Exact file path + line range**: `src/services/authService.ts:L45-L80`, not "the auth file"
- **Specific change description**: "Add `redirectUrl` param to `loginUser()` and pass to `router.push()`"
- **Verification command**: `npm test src/auth.test.ts` and expect 0 failures
- **Self-contained context**: the chunk file has every reference needed

If a chunk reads "Implement user profile feature" — it's too big. Split.

### 7.3 Crash recovery

If a session dies mid-chunk:

1. Next session's `SessionStart` hook reads `INDEX.md` and shows the active task.
2. Open the active chunk file (only).
3. Check `## Verification Evidence` — was the verification run before the crash?
4. If yes + passed → mark done, advance. If no or failed → re-execute from that point.

This flow doesn't depend on the prior conversation surviving. That's the point.

---

## 8. Using specialized agents

ADF has 48 agents in three tiers. Use them when the named role adds value; call them out by name. The tables below are representative, not exhaustive: browse `.claude/agents/` for the full roster.

### Tier 1 — Leadership

| Agent | Call when |
|---|---|
| `solutions-architect` | Picking a stack, writing an ADR, defining service boundaries |
| `product-director` | Scope decisions, milestone readiness, change requests |
| `security-auditor` | Pre-release OWASP review, threat modeling, incident response |
| `business-strategist` | Pre-requirements feasibility: ICP, revenue model, hosting cost |

### Tier 2 — Leads & specialists

| Agent | Call when |
|---|---|
| `engineering-lead` | Sprint readiness, code standards enforcement, tech-debt |
| `qa-lead` | Test strategy, acceptance criteria review, coverage gates |
| `code-reviewer` | PR-quality reviews of specific changes |
| `test-writer` | Unit, integration, E2E test authoring |
| `api-validator` | checks code against `api-contract.md` cheaply |
| `component-inspector` | checks UI against component-registry.md |

### Tier 3 — Platform specialists

`react-specialist`, `nextjs-specialist`, `angular-specialist`, `vue-specialist`, `nodejs-specialist`, `nestjs-specialist`, `fastapi-specialist`, `flutter-specialist`, `react-native-specialist`.

Each loads only its platform's idioms. Call by name when the work is platform-specific: *"Ask the nextjs-specialist to review this RSC component."*

### 8.1 When to invoke an agent vs a skill

- **Skill**: when the *process* is the asset (workscope, tech-spec, qa-testing follow repeatable steps).
- **Agent**: when the *judgment* is the asset (solutions-architect evaluating a stack choice, code-reviewer finding subtle bugs).

Many skills spawn agents internally. The rule is: don't invoke both for the same work.

---

## 9. Team pipelines — the compound skills

ADF ships one compound review skill that chains multiple agents. Feature, design and release pipelines are run by `/do` itself (v4.32.0 retired `team-feature`, `team-design` and `team-release`):

| Pipeline | Runs | When |
|---|---|---|
| `/do` Phase 1 lead dispatch | Scope → architecture → implement → code review → QA, and the design pipeline with component compliance check | Every feature worth >2 hours, and when UI is on the critical path |
| `/do` Phase 3 plus `gate-enforcement` Gate 5 | Release readiness → security → PHASE-GATE → deploy prep | Before each milestone release |
| `/team-security` | Parallel OWASP + API drift + code review | Pre-release, and weekly on main |

These cost more tokens per invocation but deliver vastly higher quality than cobbling skills by hand. Use them for the real work; use individual skills for one-off questions.

---

## 10. Review modes: `full`, `lean`, `solo`

Set in `AI_DOCS/review-mode.txt` (one word).

| Mode | Default | Gates | Who reviews |
|---|---|---|---|
| `full` | Enterprise / production | All mandatory | All three Tier-1 leaders for PHASE-GATE |
| `lean` | **Default** | Core only | Single Tier-1 per gate |
| `solo` | Indie / POC | Advisory only | No gates block; you approve yourself |

Switch with one line: `echo solo > AI_DOCS/review-mode.txt`. Revisit after each milestone.

---

## 11. Debugging the framework

### 11.1 Hook didn't fire?

- Check `settings.json` in your project (v3.3 has the wiring — regenerate from `settings.template.json` if missing).
- Is the hook script executable? `ls -la .claude/hooks/*.sh` → should be `-rwxr-xr-x`. Wired hooks are started as `bash <script>`, so they run without the bit. It still matters on macOS and Linux: hooks call their helpers (`scrub.sh`, `log-event.sh`, `ledger-writer.sh`) only when those are executable, and git ignores a non-executable `hooks/git/post-merge`. Restore with `chmod +x .claude/hooks/*.sh .claude/hooks/git/*`.
- Run it manually: `bash .claude/hooks/<hook>.sh` with a mock input to stdin.
- Check `AI_DOCS/memory/metrics.jsonl` for the event — most hooks log via `log-event.sh`.

### 11.2 Framework version mismatch

- Compare `cat .claude/.adf-version` (the framework version on disk) with `cat .claude/.adf-version.previous` (the version `upgrade.sh` last migrated to). They should match.
- On mismatch, run `bash .claude/upgrade.sh --auto` manually.
- If `session-start.sh` reports `could not pull`, you're offline or your `.claude/` has a merge conflict. `cd .claude && git status` to diagnose.

### 11.3 Skills behaving oddly

- Run `bash .claude/skill-lab/run-all-tests.sh --batch`. Expected: 29/29 compliant.
- If a specific skill is broken, use `/skill-improve <skill-name>` to diagnose and fix.
- Check `AI_DOCS/audit/agent-log.md` for subagent failures.

### 11.4 Pre-compact snapshot missing or wrong

- Trigger manually: `bash .claude/hooks/pre-compact.sh` with your real `AI_DOCS/` present.
- Inspect `AI_DOCS/memory/compaction-snapshot.md` — this is the exact text that got injected last time.
- If empty, your `session-state.md` and other memory files are probably absent or malformed.

### 11.5 Chunk-scope too aggressive

- Disable for one session: export `CHUNK_SCOPE_ENFORCE=off` in `.claude/settings.local.json` env block.
- Permanently loosen for a chunk: add the file to the chunk's `## Files Affected`.
- If it's always wrong, your chunks are probably under-specified — check them against Section 7.2.

---

## 12. Common pitfalls

1. **Running `/task-planner` then ignoring the plan.** Happens when chunks feel too slow. Don't — if the plan feels wrong, update it, don't bypass it.
2. **Committing code without committing `AI_DOCS/`.** Breaks session resume for teammates. The Stop hook warns; listen to it.
3. **Pasting specs into prompts.** Use `file:line` references (Section 3.6, Section 5.3).
4. **Using `full` review mode on a solo POC.** Every gate becomes friction. Switch to `solo`.
5. **Skipping `/ai-cost-guard` before LLM integration.** Blocks at commit time anyway — do it upfront.
6. **Editing `CLAUDE.md` by hand.** It's generated — use `/project-context` to regenerate.
7. **Treating `session-state.md` as a one-time file.** It should update after every major action.
8. **Running `/milestone-validation` mid-feature.** See Section 3.9.
9. **Leaving `CHUNK_SCOPE_ENFORCE=off` globally.** You lose the benefit; turn it back on after the exploratory session.
10. **Asking the same question across sessions.** If you re-ask, it should be because memory didn't have the answer — fix the memory, don't accept the re-ask.

---

## 13. Escape hatches (use sparingly)

Every enforcement in ADF has an escape. Knowing them prevents fighting the framework:

| Mechanism | How to bypass | When |
|---|---|---|
| Chunk-scope block | `CHUNK_SCOPE_ENFORCE=off` env | Exploratory refactor |
| Anchor unread block | Set `enforcement_mode: advisory` in active-task.md frontmatter | Task frontmatter was overly strict |
| Api-contract locked | Run `/change-request` skill | API genuinely needs to change |
| Destructive git blocked | Run the command yourself (outside Claude) | You've verified the consequence |
| Gate rejection | Record override in `gate-status.md` with justification + user sign-off | Real business reason to proceed with known risk |
| Fast-validate noisy | Exclude paths via `excludedFiles` in settings | Third-party code generators |

Never silently bypass — always record why in `decision-log.md`. Future-you will thank present-you.

---

## 13a. Automation — the hooks that work while you work

Since v3.3, ADF has grown a layer of event-driven automation on top of the core skills/agents/memory model. Nothing here replaces your judgement — every automation is either (a) advisory (writes a file you read later) or (b) a nudge you can ignore. Understanding them makes the framework much cheaper to operate.

### What fires, when, and what it produces

| Hook | Event | Rate-limit | Produces | What you do |
|---|---|---|---|---|
| `version-check.sh` | SessionStart | once/session | Runs `upgrade.sh --auto` when the version or `settings.template.json` drifted, then stamps `.adf-version.previous` and `.adf-settings.hash` | Nothing, it is transparent |
| `drift-detector.sh` | SessionStart | 24h | `AI_DOCS/quality/drift-report.md` (A/B/C/D findings) | Fix promptly — since v4.2 findings BLOCK: /build refuses on Phase A/D, Gate 4D needs A/C/D clean, Gate 5 + /ship need a clean or acknowledged report |
| `session-start.sh` | SessionStart | none | Banner with state, gates, queues, previews | Scan for red flags |
| `detect-gaps.sh` | SessionStart | none | Suggests missing docs | Run the suggested skills |
| `user-prompt-log.sh` | UserPromptSubmit | none | Appends to `user-prompts.log` | Nothing — automatic |
| `task-router.sh` | UserPromptSubmit | none | Nudges to run `/task-planner` when no active plan | Run it or ignore |
| `session-state-refresher.sh` | UserPromptSubmit | every 15 prompts | Nudges to update `session-state.md` | 10-second refresh, or ignore |
| `enforce-anchors.sh` | PreToolUse (Edit/Write) | per-edit | Blocks edits when critical anchors unread | Read the anchors, retry |
| `enforce-chunk-scope.sh` | PreToolUse (Edit/Write) | per-edit | Blocks edits outside active chunk's Files Affected | Edit listed files, or update chunk |
| `(inline)` | PreToolUse (Edit) | per-edit | Blocks locked `api-contract.md`; destructive git | Use `/change-request` or run git manually |
| `enforce-single-aidocs.sh` | PreToolUse (Edit/Write/MultiEdit/Bash) | per-edit | Blocks creating a nested `AI_DOCS/` inside app code — exactly one `AI_DOCS/` at the project root | Write to the root `AI_DOCS/`, or `ADF_ALLOW_NESTED_AIDOCS=on` |
| `infra-cost-gate.sh` | PreToolUse (Bash) | per-command | Blocks terraform/cloud provisioning without a same-day `APPROVED` entry in `infra-cost-approvals.md` | Run `/infra-cost-guard`, record approval, retry |
| `post-chunk-review-detect.sh` | PostToolUse (Edit/Write) | per-edit, idempotent | Queues chunks on Status: DONE into `pending-reviews.jsonl` | Next session → code-reviewer runs |
| `milestone-audit-detect.sh` | PostToolUse (Edit/Write) | idempotent per milestone+date | Queues PHASE-GATE approvals into `milestone-audit-queue.jsonl` | Run `/project-audit` |
| `(inline)` | PostToolUse (Edit) | per-edit | Auto-formats TS/JS/CSS via Prettier + ESLint | Nothing |
| `(inline)` | PostToolUse (Read) | per-read | Appends to `session-reads.log` | Nothing — feeds anchor-enforce |
| `pre-compact.sh` | PreCompact | per-compact | Stdout snapshot + `compaction-snapshot.md` | Next-turn Claude reads automatically |
| `log-agent.sh` | SubagentStart/Stop | per-spawn | `AI_DOCS/audit/agent-log.md` | Forensic only |
| `memory-curator.sh` | Stop | 24h | `curator-suggestions.md` | Act on suggestions or ignore |
| `session-end.sh` | SessionEnd | once/session | Per-project memory pointer | Nothing |

### The two loops you're running

Operationally there are two feedback loops running in parallel:

**Loop 1 — per-turn (hot loop):**
```
UserPromptSubmit → user-prompt-log + task-router + session-state-refresher
  → Claude responds (may spawn subagent → log-agent)
  → Edit/Write → enforce-anchors + enforce-chunk-scope + (inline guards)
  → PostToolUse → format + post-chunk-review-detect + milestone-audit-detect
  → next turn
```

**Loop 2 — per-session / daily (cold loop):**
```
SessionStart → version-check + drift-detector (if 24h elapsed) + session-start.sh banner
  → ... work ...
  → PreCompact → pre-compact.sh snapshot
  → Stop (after every response) → uncommitted-work check + memory-curator (if 24h elapsed)
  → SessionEnd → session-end
```

The hot loop catches immediate errors (scope creep, unread anchors, secret commits). The cold loop catches slow rot (stale state, drift, milestone-close gaps).

### How to read the session-start banner in v3.6

Order of sections when everything is live:

```
1. Framework status (version, update check)
2. Project branch + agent/skill counts
3. Review mode
4. Tasks index (Active + Backlog + recent completions)
5. Active simple task status (if any)
6. Session state recovery (session-state.md contents)
7. Gate status (top 20 lines)
8. Pending Chunk Reviews (if queue non-empty)
9. Next Chunk Preview (if complex task has a pending chunk)
10. Memory Curator Suggestions (if curator found breaches in last 24h)
11. Drift Report summary (if drift-detector found findings in last 24h)
12. Milestone Audit Queue (if PHASE-GATE approvals waiting for /project-audit)
13. Pending migration prompt (if framework upgraded and breaking changes)
```

A clean banner (everything green, no queues, no drift, no migration) is ~8 lines. A busy banner with every queue populated is ~30-40 lines. Either way, Claude reads it once and knows the full operational state.

### The five nudges that make the difference

Ranked by impact on "100% output":

1. **task-router** — prevents the worst antipattern (coding without a plan).
2. **enforce-chunk-scope** — keeps per-chunk context small and on-topic.
3. **post-chunk-review-detect** — guarantees a review pass per chunk.
4. **drift-detector** — catches spec/code/test divergence daily, not at release.
5. **pre-compact.sh** — makes compaction near-lossless for load-bearing state.

If you disable all other enforcement and keep just these five, you get about 80% of the quality upside with minimal friction.

### When automation feels noisy

Each enforcement has an escape hatch (see Section 13). The right escalation path when a hook feels wrong:

1. **First**: check if you're using the framework wrong. Unread anchors, out-of-scope edits, and missing plans are usually signals, not errors.
2. **Second**: escape for the session (`CHUNK_SCOPE_ENFORCE=off` env, or `enforcement_mode: advisory` in task frontmatter).
3. **Third**: edit the hook's thresholds (memory-curator numeric thresholds, session-state-refresher interval).
4. **Last resort**: remove the hook entry from `settings.json`. This lasts only until the next upgrade run (every `git pull` in `.claude/`, or a SessionStart drift), which resets the `hooks` object to the template and writes a timestamped backup.

### Adding your own automation

If you want a custom hook (e.g. auto-invoke `team-security` weekly):

1. Write a bash script in `.claude/hooks/your-hook.sh`. Follow the pattern: read event JSON from stdin, never block, emit telemetry via `log-event.sh`, scrub secrets via `scrub.sh`.
2. Add a rate-limit timestamp file if the work is expensive.
3. Wire it in `.claude/settings.local.json` under the appropriate event. Do not wire it in `settings.json`: every upgrade run resets that file's `hooks` object to `settings.template.json` (with a timestamped backup) and would silently drop your hook. Claude Code merges hook entries across settings files, so a hook in `settings.local.json` runs alongside the framework's, and upgrades never touch that file.
4. Test in a tmpdir: mock the event JSON and confirm silent/correct behavior.
5. Document in your project's `CLAUDE.md` so teammates know it exists.

---

## 13b. Desktop notifications (v3.8)

Claude Code emits a `Notification` event whenever it needs your attention (approval prompts, long-running task milestones, errors). v3.8 wires this to cross-platform desktop toasts so you can look away from the terminal without missing cues.

### What fires, when

| Event | Default | Opt-in switch |
|---|---|---|
| `Notification` | **On** | — |
| `Stop` (turn complete) | Off | `ADF_NOTIFY_ON_STOP=1` |

### Platform specifics

| OS | Mechanism | Auto-installed by setup.sh? |
|---|---|---|
| **Windows** | `BurntToast` PowerShell module (preferred), raw `Windows.UI.Notifications` fallback, `NotifyIcon` balloon last-resort | Yes — `Install-Module BurntToast -Scope CurrentUser` runs automatically |
| **macOS** | Built-in `osascript` (zero install); `terminal-notifier` (via brew) used if present | No install needed |
| **Linux** | `notify-send` (libnotify-bin); `dunstify` if present | No — setup.sh prints the install command for your package manager |

### Disable entirely

Set this in `.claude/settings.local.json` (the gitignored one). Removing the `Notification` entry from `.claude/settings.json` does not last, because the next upgrade run resets the `hooks` object to the template:

```json
{
  "env": {
    "ADF_NOTIFY_DISABLED": "1"
  }
}
```

### Enable Stop-event notifications (useful for long tasks)

```json
{
  "env": {
    "ADF_NOTIFY_ON_STOP": "1"
  }
}
```

When enabled, Stop-event notifications pull the active task's `Request` from `AI_DOCS/memory/task-ledger.md` so the toast reads "Claude Code — task paused: <your original request>" instead of a generic "turn complete."

### Troubleshooting

**Windows: no notification appears.**
1. Check BurntToast is installed: `powershell -Command "Get-Module -ListAvailable BurntToast"`
2. If missing: `Install-Module BurntToast -Scope CurrentUser -Force`
3. Windows notifications may be muted in Focus Assist — Settings → System → Focus
4. First-run: Windows may prompt to allow notifications for "Claude Code" — approve it

**macOS: no notification appears.**
1. First run prompts to grant notification permission to "Script Editor" or "osascript" in System Settings → Notifications
2. Some terminal emulators (iTerm2 in particular) block child notifications — consider `brew install terminal-notifier`

**Linux: no notification appears.**
1. Install `libnotify-bin` (Debian/Ubuntu) or `libnotify` (Fedora/Arch)
2. Wayland + certain compositors ignore `notify-send` — try `dunstify` or the compositor's native tool
3. Test manually: `notify-send "test" "hello"` — if that works, the framework wiring should too

**"I don't want BurntToast installed on my machine."**
Run setup.sh with `--no-notifications`:

```bash
bash .claude/setup.sh --no-notifications
```

To switch notifications off after the fact, set `ADF_NOTIFY_DISABLED` as shown under "Disable entirely" above. Removing the `Notification` hook entry from `settings.json` only lasts until the next upgrade run. The framework never installs anything else you didn't consent to.

**"Every single notification event pops a toast — too noisy."**
Claude Code's `Notification` event fires sparingly (only when Claude is *asking for input*) — not on every turn. If you see spam, you likely enabled Stop-event notifications (`ADF_NOTIFY_ON_STOP=1`) without realizing; unset it.

---

## 14. FAQ

**Q: I'm on a solo POC with no team. Is ADF overkill?**
A: Switch to `solo` review mode (Section 10) and you get 90% of the benefit (memory, chunked execution, hooks) without gate friction. The framework scales down.

**Q: Can I use ADF with Cursor / VS Code Copilot / Codex?**
A: ADF is Claude Code-only today. `context-mode` (companion tool — see `README.md`) supports 12 platforms but solves a different problem.

**Q: My `git pull` in `.claude/` broke my custom skills.**
A: Custom skills should live in a directory that's excluded from `git pull`. Either place them in `<project>/.skills/` (outside `.claude/`) or fork `.claude/` and add as a second remote. See `UPGRADING.md`.

**Q: Can I disable telemetry?**
A: Yes. Add `{"telemetry": {"enabled": false}}` to `.claude/settings.local.json`. See `docs/telemetry.md`.

**Q: How do I contribute a new skill?**
A: Run `/skill-authoring`. It scaffolds a framework-compliant `SKILL.md` with all standard metadata (`license: Proprietary`, `metadata.author`, `compatibility`, `skill_id`).

**Q: A hook is slowing me down — how to measure?**
A: The anchor and chunk-scope gates log to `AI_DOCS/memory/hook-health.log` when a run exceeds their budget (5000 ms). When the last three logged runs are all above the budget, the gate disables itself and the session-start banner says so. Check the log and fix the root cause, then delete the log to re-arm the gate.

**Q: Should I commit `AI_DOCS/memory/user-prompts.log`?**
A: Up to you. If the repo is private and multi-developer, yes (useful context for teammates). If public or you share AI_DOCS upstream, consider adding `user-prompts.log` to `.gitignore` — it captures raw phrasing that can be sensitive.

**Q: What if I want to run the framework without any hooks firing?**
A: Set `"disableAllHooks": true` in `.claude/settings.local.json`. You lose enforcement but retain skills and agents. Deleting the `"hooks"` block from `settings.json` does not last: the next upgrade run restores it from the template and writes a timestamped backup of the previous file.

**Q: The drift detector flags routes my codebase doesn't actually expose (e.g. from internal helpers).**
A: Route extraction is regex-based and has false positives. Either (a) ignore the finding — the report is advisory; (b) move the helper into a file whose path doesn't end with `.ts`/`.js`/`.py`; or (c) edit `drift-detector.sh` to tighten the regex. Don't try to auto-exclude — the drift list is short enough to eyeball.

**Q: Chunk review queue keeps growing — nothing's clearing it.**
A: When `code-reviewer` runs in Chunk Review Mode, step 5 of its procedure (see `agents/code-reviewer.md`) is to rewrite the queue entry with `"status":"reviewed"` or `"status":"blocked"`. If Claude skipped that step, edit `AI_DOCS/memory/pending-reviews.jsonl` manually. Memory-curator surfaces the depth when it hits 3.

**Q: The session-state-refresher nudges me every 15 prompts. How do I quiet it?**
A: The counter resets automatically whenever `session-state.md` mtime changes, so the clean fix is to write a one-line refresh. If you want it less frequent, edit `NUDGE_INTERVAL` at the top of `hooks/session-state-refresher.sh`. If you want to disable it entirely, remove its `UserPromptSubmit` entry from `settings.json`, and expect to repeat that after each upgrade run, which restores the template hooks.

**Q: Phase C of the drift report flags a criterion that IS covered by a test (different wording).**
A: Keyword matching is heuristic. Two fixes: rename the test's `describe`/`it` block to contain the spec's keywords (robust long-term), or edit the criterion's wording in `tech-spec.md` to match the test (quick). Phase C is designed to be noisy so you don't miss real gaps — tune by matching wording, not by silencing.

**Q: The milestone-audit-detect queued an entry for a gate that was already audited.**
A: It only fires on the *transition* to APPROVED, so a fresh queue entry means a genuinely new approval. If you already audited and just forgot to update the queue, edit the JSONL line: change `"status":"pending"` → `"status":"reviewed"`.

**Q: Which memory files should I commit vs gitignore?**
A: **Commit**: `session-state.md`, `decision-log.md`, `gate-status.md`, `security-findings.md`, `ai-cost-approvals.md`, `project-context.md`, `compaction-snapshot.md`, and both queue files (`pending-reviews.jsonl`, `milestone-audit-queue.jsonl`) if you want teammates to see them. **Gitignore**: `metrics.jsonl` (telemetry noise), `.prompt-counter`, `.curator-last-run`, `.drift-last-run`, `.curator-last-run`, `session-reads.log`. **Your call**: `user-prompts.log` (useful handover, but contains raw phrasing — sensitive for public repos).

**Q: How do I know which ADF version added a specific hook?**
A: Run `grep -n "v3\\." hooks/*.sh | head -40` — each hook's comment block names its introducing version. Or read `UPGRADING.md`.

---

## 15. Further reading

- `README.md` — inventory and install
- `UPGRADING.md` — version history with migration notes
- `docs/context-management.md` — anchor pattern, budget rules
- `docs/governance-gates.md` — gate definitions, verdict format
- `docs/agent-coordination-map.md` — which agents talk to which
- `docs/skill-decision-tree.md` — "which skill for my situation"
- `docs/skill-authoring-guide.md` — building a custom skill
- `docs/telemetry.md` — what metrics.jsonl records, how to opt out
- `docs/secrets-policy.md` — redaction patterns
- `skills/task-planner/SKILL.md` — the chunked-execution reference
- `skills/memory-protocol/SKILL.md` — every skill's memory startup/shutdown protocol
- `agents/code-reviewer.md` — includes Chunk Review Mode for v3.4+
- `hooks/pre-compact.sh` — the compaction snapshot mechanism
- `hooks/drift-detector.sh` — route/contract/test drift logic (readable; tweakable)
- `UPGRADING.md` — per-version migration notes with verification commands

---

## Appendix: the five questions you should be able to answer at any time

If a session dies right now and tomorrow's you opens the laptop, you should be able to answer these from files alone — not memory, not chat history:

1. **What's the task, and why?** → `task-ledger.md` Active block (Request + Plan)
2. **What's done and what's next?** → `task-ledger.md` Active block (Status + Next action + Progress log)
3. **What phase are we in?** → `session-state.md`, `project-context.md`
4. **What gates are approved, pending, blocked?** → `gate-status.md`
5. **What were the last decisions we made?** → `decision-log.md` last 5 rows

The Task Ledger answers questions 1 and 2 in a single file — that's the whole point of v3.7. If any of these don't have an answer on disk, stop and record it now. That's the entire discipline.
