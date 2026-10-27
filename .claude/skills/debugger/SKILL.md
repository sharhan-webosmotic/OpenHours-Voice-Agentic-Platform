---
name: debugger
description: "Trace issues across code, design, mock data, build, and runtime layers. Use when debugging, investigating errors, or figuring out why something is broken or not working. Also triggers on: 'Fix'."
next_skill: null
mcp_integrations: [playwright, context7, next-devtools, sequential-thinking]
skill_id: SK-041
context_budget:
  load_kb: 30
  scope: task
version: 1.3.0
dependencies:
  required: []
  optional: [error-handling, build]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---
# Debugger

> Trace problems across ALL layers. Find root cause. Suggest fix.

---

## 🚨 Initialization & Memory Logic
> [!NOTE]
> **Gated Approach**: Memory initialization handled by [session-management](../session-management/SKILL.md). Gate status checked before skill handoff.

---

## Trace Layers

```
1. Code      → Syntax, logic, types
2. Design    → Design-code mismatch
3. Mock      → Data shape, missing fields
4. Build     → Compile errors, deps
5. Run       → Runtime, browser console
6. Network   → API calls, responses
```

---

## MCP Acceleration (per mcp-rules.md Rule 4.3)

Before reasoning blind about a layer, reach for the matching MCP server. All are free/Enforced.

| Layer | MCP | Use |
|---|---|---|
| Run (browser) | `playwright` | Load the page at the app's dev URL+port, screenshot, read console + network, reproduce the bug live instead of guessing |
| Network | `playwright` / `chrome-devtools` | Inspect actual request/response, status, headers |
| Library behaviour | `context7` | Pull the exact, version-specific API docs — kill "this method doesn't exist" guesses |
| External docs | native WebFetch | Read error-message docs, changelogs, issue threads |
| Next.js runtime | `next-devtools` | Discover the running server, route info, runtime errors |
| DB state | DB MCP (gated, approved) | Query the actual dev DB row that the bug touches — never prod |

**Canvas-rendered targets.** Some applications (spreadsheet and document editors above all) render
their content to a `<canvas>`, so DOM text extraction and element queries return the surrounding
shell only. The result is a near-empty read, NOT an error, which is what makes it expensive: the
natural response is to retry with a different selector, then a different extraction tool, then an
export or print URL, all of which also fail or are blocked. Detect the case in one cheap check
first: a page carrying a canvas element whose extracted body text is far shorter than what is
visibly rendered is canvas-rendered. For those, read by screenshot plus region zoom, and navigate
by the application's own addressing (a direct link to a specific sheet, tab, or cell range) rather
than by scrolling blindly. Do not trust a text-extraction result from such a page, including an
empty one.

Always target the project's configured dev URL/port and dev environment (see `stack.md` → `## MCP Servers` and the env/port config). Never point a debug MCP at staging or production.

## Process

```
User: "Something is broken"
    ↓
1. Identify symptoms
2. Check each layer systematically
3. Find root cause
4. Suggest optimized fix
5. Verify fix works
```

## MCP Integration

| Tool | Use For |
|------|---------|
| next-devtools | Next.js errors, routes, MCP |
| sequential-thinking | Complex multi-step analysis |
| browser_eval | Console logs, network |

## Hypothesis discipline

Checking every layer finds where the symptom shows up. Choosing the cause is a separate step, and guessing several fixes at once is what turns a one-line bug into a long session. Work with one hypothesis at a time:

1. **State it** in the form "I think X because Y", where Y is something observed (a log line, a diff, a failing request), not a hunch.
2. **Run the smallest test of it.** One log line, one query, one changed value, one isolated call. Change one variable at a time so the result means something.
3. **Read the result.** Confirmed: continue. Refuted: write down what that rules out and form the next hypothesis from the new evidence, never by stacking a second guess on the first.
4. **Write a failing reproduction test before any fix.** The test fails for the reason in the hypothesis, the fix makes it pass, and it stays in the suite as the regression test (see `rules/testing-rules.md` for the red-green proof).

### Stop rule: three failed fixes means question the architecture

Count fix attempts per issue. After 3 failed fix attempts on the same issue, stop fixing. Each fix that reveals a new problem in a different place, or needs a larger refactor to work, is a sign the design is wrong, not the line being edited. Do this instead:

- Write down what was tried and what each attempt showed.
- Route to a `solutions-architect` review, or ask the user via `/ask`, with that list attached.
- Do not attempt a fourth fix until the architecture question has an answer.

This sits alongside the `/do` auto-fix ladder: the ladder bounds rounds in a task, this rule bounds guessing inside one bug.

## Output Template

```markdown
## Debug Trace

**Symptom**: [What user reported]

**Layer Check**:
- Code: ✅/❌ [Finding]
- Design: ✅/❌ [Finding]
- Mock: ✅/❌ [Finding]
- Build: ✅/❌ [Finding]
- Run: ✅/❌ [Finding]

**Root Cause**: [Specific issue]

**Suggested Fix**:
[Code/config change needed]

Apply fix? (Y/N)
```

## Defect ledger (MANDATORY on confirmed bugs)

When the root cause is confirmed AND the broken code belongs to a task already stamped DONE, append one row to `AI_DOCS/quality/defect-log.md` (create with the header on first use, schema in /do Phase 1):

```
| D-<NNN> | <date> | <phase: qa/audit/staging/production> | <severity> | <M:T ref> | <symptom one-liner> | <root cause one-liner> | <yes if found at audit or later> | <fix ref> | pending retro |
```

Verification failures on a task still in progress are normal development, not defects — do not log those. The ledger feeds `/do status` (escaped-defect rate vs the <1% target) and `/retrospective` (every escaped defect must produce a rule/gate update).

## Rules
1. Check ALL layers, not just obvious one
2. Use MCP tools for deep tracing
3. Suggest OPTIMIZED fix (not just working)
4. Verify fix resolves issue
5. Confirmed post-DONE bugs get a defect-log row BEFORE the fix is applied (the row survives even if the fix session dies)

## Rules Integration
> - `.claude/rules/development-rules.md` — verify code follows architecture and naming rules
> - `.claude/rules/security-rules.md` — check for security violations during debugging
> - `.claude/rules/api-rules.md` — verify API contract compliance when debugging API issues

<!-- Version: 1.3.0 | 2026-10-22 | Hypothesis discipline (one hypothesis at a time, smallest test, failing reproduction test before any fix) and a three-failed-fixes stop rule that routes to solutions-architect or /ask. Ported from obra/superpowers systematic-debugging. -->
