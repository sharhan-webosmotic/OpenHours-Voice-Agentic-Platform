# Coordination Rules
> ADF v3.0 | Governs agent collaboration, gate verdicts, and parallel/sequential use.

---

## Review Mode

**Config file**: `AI_DOCS/review-mode.txt`

| Mode | Behavior |
|------|---------|
| `full` | Every gate ID fires its full director prompt. All 3 Tier-1 agents for PHASE-GATE. |
| `lean` | Only `PHASE-GATE` triggers a full director panel. Single-reviewer gates are advisory only. **Default.** |
| `solo` | All gates suppressed. For spikes, POCs, and rapid exploration only. Never use solo for production milestones. |

---

## Collaboration Protocol (All Agents)

Every agent follows this decision sequence before writing anything:

```
1. QUESTION   — State what you need to decide, what information you have
2. OPTIONS    — Present 2–3 distinct approaches with trade-offs
3. DECISION   — State the recommended option and rationale
4. DRAFT      — Show the proposed output/artifact
5. APPROVAL   — Ask: "Shall I proceed with this approach?"
```

No agent writes to project files without completing this sequence for non-trivial decisions.

---

## Gate Verdict Format

Every agent gate response **must** start with one of these on line 1:

```
APPROVE
CONCERNS: [summary]
REJECT: [reason]
```

This enables calling skills to machine-read the verdict without parsing prose.

---

## Parallel vs Sequential Agent Use

**Parallel** (issue several at once via multiple `Agent` tool calls):
- Multiple independent code reviews
- Multi-director PHASE-GATE reviews
- Team orchestration skills (team-security)
- Exploration agents reading different parts of codebase
- The MAVS validator fan-out at milestone close (milestone-validation)
- Task Briefs for queued tasks (explorer/research-lead, while the current builder runs)
- A /do Parallel wave: worktree-isolated `builder` agents on provably independent tasks
  (no blockedBy edge, disjoint files-to-touch, no locked artifact, no shared entity write)

**Sequential** (one at a time, wait for result):
- When each step's output feeds the next step's input
- When gate verdict must be received before implementation starts
- When a specialist's output feeds into the lead's review

### Agent concurrency cap (machine-aware, BLOCKING for parallel fan-out)

A parallel fan-out must be CAPPED, not unbounded. An over-spawn exhausts memory or
process slots and stalls the host. The cap is detected at RUNTIME on the actual
machine (the framework ships to many hosts with very different cores and RAM, see
`README.md`), so it is NEVER a hardcoded number.

Before any parallel fan-out of 3+ agents, run the detector and read the two caps:

```bash
eval "$(bash .claude/scripts/agent-capacity.sh)"
# -> CORES, RAM_GB, LIGHT_CAP, HEAVY_CAP for THIS host
```

- **LIGHT_CAP** — max concurrent READ-ONLY / analysis agents (code review, security
  grep, contract diff, doc reading, exploration). Cores-bound. Spawn at most
  `LIGHT_CAP` at once, queue the rest, and start the next as each finishes.
- **HEAVY_CAP** — max concurrent agents that run a BROWSER, test runner, throwaway
  DB, or a build (e2e-testing, e2e-testing, schema-validation, api-conformance,
  the geometry dump). Memory-bound and much smaller. A heavy agent also counts as
  ~2 LIGHT slots toward the overall budget.

Sizing (computed by the script, shown here for transparency, do not hardcode):
`LIGHT_CAP = clamp(min(CORES-2, RAM_GB/2), 2, 12)`,
`HEAVY_CAP = clamp(min(CORES/4, RAM_GB/4), 1, 4)`. Memory is the binding constraint,
so a low-RAM host gets a small HEAVY_CAP even with many cores.

Rule: a skill that fans out runs the detector first, then dispatches in waves of at
most the relevant cap. Mixed batches use HEAVY_CAP if any agent in the wave is heavy.
The user may override per project by exporting `ADF_LIGHT_CAP` / `ADF_HEAVY_CAP`.

**Builder waves are HEAVY.** A /do Parallel wave member runs a full verify battery
(tests + build, plus a worktree checkout), so the wave size is capped by HEAVY_CAP
(practically 2-3). Wave MERGES are strictly sequential regardless of the cap: one
merge at a time, full battery re-run per merge, never a concurrent merge. Do not run
a builder wave concurrently with the headed Playwright MAVS suite on a low-RAM host
(both are HEAVY).

---

## Anti-Patterns (Never Do These)

- **Bypassing gate hierarchy** — don't proceed past a gate without an APPROVE verdict
- **Shadow decisions** — don't implement architectural choices without `solutions-architect` sign-off
- **Monolithic tasks** — don't give an agent a task spanning 5+ subsystems; break it up
- **Inline gate prompts in skills** — always reference gate IDs from `governance-gates.md`
- **Skipping session-state.md** — never end a session with WIP state only in conversation
