# Experiment: do main-session hooks fire (and block) inside subagents?

Question that gates ADF v5 Stage 4: if we move file edits into builder subagents, do the
main-session `PreToolUse` governance hooks (enforce-do-routing, shell-lock, api-contract-lock,
chunk-scope, cost/ship gates) still fire and still block? If not, builder agents would bypass
governance. If yes, builder agents are safe to promote.

## Result (verified 2026-07-02, Claude Code v2.1.198): PASS

- Hooks FIRE inside subagents: a `PreToolUse` Write hook logged both of a subagent's Write
  attempts, each tagged `agent_type: writer`, `agent_id: a55b...`.
- Hooks BLOCK inside subagents: the hook returned exit 2 on the sentinel path; the file was
  never created and the block reason surfaced.
- Permissions ALSO apply inside subagents (independent layer): the non-sentinel write was held
  by the permission system, separate from the hook.

Conclusion: governance and permissions both survive when work moves into subagents. Builder
agents that apply edits remain subject to the same enforcement as the main session.

## How to re-run (on a new Claude Code version, to confirm the behavior still holds)

1. Make an isolated dir with its own `.claude/`:
   - `.claude/hook.js`: reads stdin JSON, appends `{tool, fp, agent_id, agent_type}` to `hook.log`,
     and `process.exit(2)` when the file path contains `BLOCKED-sentinel` (else exit 0).
   - `.claude/settings.json`: `PreToolUse` matcher `Write|Edit` → `node ".../hook.js"`.
   - `.claude/agents/writer.md`: a `writer` agent with `tools: Read, Write`.
2. From that dir:
   `claude -p 'Use the Task tool to dispatch subagent_type "writer" to create allowed.txt and BLOCKED-sentinel.txt (body ok).' --allowedTools "Task Write Read Edit" --max-turns 15`
3. Inspect: `hook.log` should contain entries with `agent_type: writer` (hook fired in the
   subagent), and `BLOCKED-sentinel.txt` should be absent (hook blocked it).

## Decision rule

- PASS (current) -> builder agents MAY apply edits; a lead+builder can run a full task in an
  isolated context while governance still enforces. Keep the L0 verify battery + code-review as
  the quality gate on the returned diff.
- If a future version FAILS this -> revert to mutations-in-L0-only, or embed the enforcement
  hooks into each builder agent's own frontmatter.
