# Context Efficiency Rules

> Loaded when a task is hands-on (investigation, building, auditing, migrating) or
> whenever the main session is under context pressure. The context window is the
> scarcest resource: performance degrades as it fills. These rules keep the main
> conversation lean by pushing heavy and cheap work into isolated subagent contexts.

## Rule 1: Mechanical and bulk work runs as a subagent, never inline

A skill invoked inline runs in the MAIN context: everything it reads stays in the
conversation. A subagent runs in its OWN context and returns only a summary. So
mechanical or bulk work (bulk lookups, document ingestion, wide scans) must be
dispatched to a subagent, not executed inline. Isolation is what protects the
main context. Price is the second lever: the session model plans and validates,
cheaper models execute (Rule 8).

## Rule 2: Delegate read-heavy investigation

When answering a question means reading many files, or sweeping directories, or
grepping the component registry / api-contract / AI_DOCS, dispatch the `explorer`
agent (read-only) or another read-only agent. Let it read; take back its
summary. Do not read a dozen files inline to gather context for a change.

- Locating where something happens, tracing a flow, gathering pre-change context: `explorer`.
- Domain review (code, security, API contract, components, design): the matching specialist agent (`code-reviewer`, `security-auditor`, `api-validator`, `component-inspector`, and the platform specialists).
- Broad open-ended searches across many naming conventions: `Explore` (the project override runs on Haiku).

## Rule 3: Ingest documents in a subagent

Converting or reading a large file or URL (PDF, DOCX, XLSX, PPTX, audio, a long
web page) pulls a large body of text into context. Run the ingestion inside a
subagent so only the resulting `.md` path plus a short summary returns to the main
session. The raw document body never enters the main window.

## Rule 4: Read narrowly even inline

When a read must happen inline, keep it small: grep before read, use Read with
offset/limit for the specific range, scope to the active milestone capsule, and
reference stable IDs (`M01:T-03`) instead of copying content between files. Full
schema and scoping: `skills/memory-protocol/SKILL.md`.

## Rule 5: Reset between unrelated work

Long sessions accumulate irrelevant context and degrade output. Between unrelated
tasks, prefer a fresh context. After two failed corrections on the same issue,
stop and restate the problem cleanly rather than piling more onto a polluted
window. Persist durable state to `AI_DOCS/` (the file is the memory) so a reset
loses nothing that matters.

## Rule 6: Parallelize independent subagents

When several investigations are independent, dispatch them in one batch so they
run concurrently and each keeps its reads out of the main window. Wait for the
conclusions, not the file dumps.

## Rule 7: The main session orchestrates

Keep the main session's own tool calls to routing, dispatch, gate decisions, user
conversation, and small surgical edits in the micro lane. Send everything else,
every read-heavy investigation and every edit-heavy implementation, to a subagent
whose raw tool output stays out of the main window, because main-window context is
the scarcest resource the session has, and its degradation drags down every later
decision, not just the task at hand.

## Rule 8: The session model plans and validates, cheaper models execute

Cost policy (v4.28.0). Thinking and output are billed at full price and never
cached, and every subagent starts cold, so the model and effort of each agent are
the largest cost levers. Quality is protected by keeping judgment on the session
model and validating whatever a cheaper model produces.

- **Haiku**: read-only lookup and grading (`explorer`, `Explore`, `skill-curator`).
- **Sonnet**: agents that execute a plan someone else wrote or scan a fixed checklist (`builder`, `test-writer`, `research-lead`, the `cq-*` scanners, `ap-data-reconciler`, `api-validator`, `component-inspector`, the platform specialists, `sec-hunter`). When dispatching an ad-hoc execution agent, pass `model: sonnet` (or `haiku` for pure lookup).
- **Session model** (no tag): planning, leads, Tier-1 authorities, reviewers (including `sec-verifier`), client-facing prose. Its review is the gate on every cheaper agent's output. The session default is **Opus** (`/model opus`).
- **Skills never carry `model:`.** Switching the main conversation's model rebuilds its prompt cache. Delegate to an agent instead.
- **Effort**: default `high`. `effort: xhigh` only on skills where depth pays off (planning, estimation, gates, code-quality and assessment reports), `medium` on mechanical skills and agents.
- **Fable is the exception, never the default.** It costs 2.5x Opus, needs 30-day data retention on the account, and its turns run longer. Use it for exactly two things: an R&D-class problem the operator names (novel architecture, a hard algorithm, a research spike), and security verification (`deep-security-audit` Phase 3 and 5 verifiers), both only after the operator says yes. Never pin `model: fable` in an agent file. Pass it at dispatch time, and if the dispatch is refused or the account lacks Fable, re-dispatch the same prompt on Opus. A session left on Fable by mistake is switched back with `/model opus`.
- Context is not the reason to route. Every current model (Haiku 5.5, Sonnet 5.5, Opus 5.5, Fable 5.1) has a 1M window. Price and judgment are the reasons. Haiku's price rises 5x above 100K prompt tokens, so keep Haiku work small.

## Rule 9: Fan-out budget and cache hygiene

- Delegate only when the read or edit set is large or the work is genuinely parallel. Small edits and short back-and-forth stay in the main session, where the cache is warm.
- Follow up with an existing agent through SendMessage instead of starting a fresh one, which re-reads everything. The exception is the one escalated fix attempt after the same-builder rounds, where a fresh agent one tier up starts clean on purpose (`/do` Phase 1 "On FAIL").
- Hand off by file. The task brief, the builder report and the review package are written under `AI_DOCS/.temp/handoff/<task-id>/` and the dispatch prompt carries the paths, never earlier tasks' history. A fresh agent then starts from exactly the files its task needs, and the orchestrator's context does not grow with every task.
- Verify, then count. An agent's "success" is a claim. The orchestrator compares it with `git diff --stat` and the actual changed files before the task counts as done (see `testing-rules.md` Verify Before Claim).
- One builder per ownership area. Never run two agents on the same investigation.
- Wrap long test and build commands: `bash .claude/scripts/quiet-run.sh <command>` prints failures and summaries only and keeps the full log in `AI_DOCS/.temp/quiet-run/`.
- Use `/clear` between unrelated tasks. Do not switch the main model mid-session. Keep MCP servers stable, since a server that connects and disconnects changes the tool list.
- Measure with `/context` (what loads every session) and `/usage` (cache hit rate and the cause of misses).

<!-- Version: 1.1.0 | 2026-08-20 | added Rule 7 (the main session orchestrates), the orchestrator-contract wording from PLAN-execution-speed.md Part 1 -->
<!-- Version: 1.1.1 | 2026-08-21 | Rule 1 retitled to mechanical-and-bulk work; model-tier phrasing removed (agents and skills carry no model tags, everything inherits the CLI session model; isolation is the rationale for subagents) -->
<!-- Version: 1.2.0 | 2026-10-21 | Rule 1 no longer says agents carry no model tags. New Rule 8 (session model plans and validates, Haiku/Sonnet execute, skills never carry model:, effort policy) and Rule 9 (fan-out budget, quiet-run.sh, cache hygiene, /context and /usage). -->
<!-- Version: 1.2.1 | 2026-10-22 | Rule 8 lists sec-hunter (Sonnet) and sec-verifier (session model) from deep-security-audit -->
<!-- Version: 1.3.0 | 2026-10-22 | Rule 9 gains handoff-by-file under AI_DOCS/.temp/handoff/<task-id>/ and verify-claim-against-diff, with the fresh-agent exception for the third fix round. Ideas from obra/superpowers subagent-driven-development. -->
<!-- Version: 1.4.0 | 2026-10-22 | Rule 8: Opus is the session default, Fable allowed only for operator-approved R&D problems and security verification, passed at dispatch time with an Opus fallback, never pinned. Context window is not a routing reason (all current models are 1M). Rule 9 wording: one escalated fix attempt, not a numbered round. -->
