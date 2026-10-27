# Agent Test Spec — [agent-name]

> Template for writing behavioral specs for agents. Copy to `agents/[tier]/[agent-name].md`.
> Fill in all 5 test cases. Delete this instruction block when done.

---

**Agent**: `[agent-name]`
**Tier**: [leadership | specialists]
**Agent path**: `.claude/agents/[agent-name].md`
**Gate verdicts**: [list gate IDs this agent can issue, e.g., SA-ARCH, SA-ADR]
**maxTurns**: [N]
**Spec author**: [name or "ADF team"]
**Spec date**: [YYYY-MM-DD]

---

## What This Agent Does

[1-2 sentences: the agent's role, what it reviews, and what it outputs]

## Assertions That Apply to All Test Cases

These must be true in every test case:

- [ ] Agent verdict appears on the FIRST line of output: `APPROVE`, `CONCERNS`, or `REJECT`
- [ ] Agent gives specific reasons — not generic feedback
- [ ] Agent does NOT edit or write code (read-only, unless explicitly allowed)
- [ ] Agent references specific files/sections it reviewed (not "I checked the codebase")
- [ ] Agent escalates appropriately (does not resolve issues outside its mandate)

---

## Test Case 1: [Approve Path — All Conditions Met]

**Context provided to agent**:
```
[List what the spawning skill or Claude provided: file contents, gate ID, question asked]
```

**Project state**:
```
[What files exist, what decisions have been made, what the current milestone is]
```

**Expected agent behavior**:
[Agent reviews the provided context, applies its criteria, and issues APPROVE]

**Assertions**:
- [ ] Output starts with `APPROVE`
- [ ] Specific criteria reviewed are listed
- [ ] Evidence cited (file names, line references, or specific decisions)
- [ ] No unnecessary scope expansion (agent stays in its lane)

---

## Test Case 2: [Concerns Path — Issues Found But Not Blocking]

**Context provided to agent**:
```
[Context where the design/code/scope is mostly fine but has some gaps or risks]
```

**Expected agent behavior**:
[Agent issues CONCERNS with specific list of issues that should be addressed]

**Assertions**:
- [ ] Output starts with `CONCERNS`
- [ ] Each concern is specific and actionable
- [ ] Concerns are prioritized or labeled (critical concern vs minor)
- [ ] Agent does NOT escalate to REJECT for resolvable issues

---

## Test Case 3: [Reject Path — Blocking Issue Found]

**Context provided to agent**:
```
[Context with a clear blocking issue: missing required artifact, security vulnerability, out-of-scope feature, etc.]
```

**Expected agent behavior**:
[Agent issues REJECT with clear explanation of what must be fixed before re-review]

**Assertions**:
- [ ] Output starts with `REJECT`
- [ ] Specific blocker is identified (not vague "not ready")
- [ ] Agent states what must change before it can APPROVE
- [ ] Agent does NOT proceed as if approved

---

## Test Case 4: [Incomplete Context — Missing Information]

**Context provided to agent**:
```
[Agent is spawned with insufficient context: missing files referenced, gate ID not specified, etc.]
```

**Expected agent behavior**:
[Agent should flag what context is missing before attempting review — not hallucinate or guess]

**Assertions**:
- [ ] Agent identifies specific missing information
- [ ] Agent asks for the missing context or states it cannot review without it
- [ ] Agent does NOT issue a verdict based on incomplete information

---

## Test Case 5: [Escalation — Issue Outside Agent's Mandate]

**Context provided to agent**:
```
[Agent encounters something that requires a different agent: e.g., solutions-architect agent finds a scope issue that belongs to product-director]
```

**Expected agent behavior**:
[Agent notes the out-of-scope issue and escalates to the correct agent rather than resolving it unilaterally]

**Assertions**:
- [ ] Agent flags the issue for the appropriate other agent
- [ ] Agent does NOT resolve issues outside its mandate
- [ ] Agent's own verdict is still issued for what IS in its mandate

---

## Notes / Known Limitations

[Anything that doesn't fit the test cases — known edge cases, deliberate design decisions, things NOT tested here]
