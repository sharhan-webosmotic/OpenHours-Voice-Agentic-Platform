# Observability Standards

> **Purpose**: Define logging, metrics, and tracing standards for AI skill workflows
> **Audience**: AI agents during execution and debugging
> **When**: Throughout all skill execution

---

## Core Principle

> [!CRITICAL]
> **Every skill execution must be observable and debuggable.**

---

## 1. Skill Execution Events

### 1.1 Required Events

| Event | When | Data |
|-------|------|------|
| `skill.start` | Skill begins | skill_id, timestamp, input_summary |
| `skill.end` | Skill completes | skill_id, duration, status, output_summary |
| `gate.check` | Gate evaluated | gate_id, pass/fail, criteria_results |
| `handoff.emit` | Skill handoff | from_skill, to_skill, files_passed |

### 1.2 Event Format

```json
{
  "event": "skill.start",
  "timestamp": "2026-02-05T01:35:00Z",
  "skill_id": "SK-005",
  "skill_name": "build",
  "session_id": "sess_abc123",
  "context": {
    "milestone": "M1",
    "task": "T01"
  }
}
```

---

## 2. Metrics

### 2.1 Core Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `skill.duration_ms` | Histogram | Time per skill execution |
| `gate.pass_rate` | Gauge | Percentage of gates passed |
| `token.usage` | Counter | Tokens consumed per skill |
| `error.count` | Counter | Errors by skill and type |

### 2.2 Tracking in task.md

Add metrics section to task.md:

```markdown
## Metrics
| Skill | Duration | Tokens | Status |
|-------|----------|--------|--------|
| prd-generation | 45s | ~2000 | ✅ |
```

---

## 3. Error Tracking

### 3.1 Error Levels

| Level | When | Action Required |
|-------|------|-----------------|
| `INFO` | Normal operation | Log only |
| `WARN` | Recoverable issue | Log + consider retry |
| `ERROR` | Skill failed | Log + stop + report |
| `FATAL` | System failure | Log + escalate immediately |

### 3.2 Error Format

```markdown
## Error Log

### [TIMESTAMP] ERROR in [SKILL]
- **Type**: [ValidationError/NetworkError/etc]
- **Message**: [Error message]
- **Context**: [What was happening]
- **Recovery**: [Attempted recovery or none]
```

---

## 4. Trace Correlation

### 4.1 Session Tracing

Each session gets a `session_id` tracked across all skills:

```
session_id: sess_20260205_001
├── skill: session-management
├── skill: prd-generation
├── skill: prd-generation
└── skill: build
```

### 4.2 Implementation

In `AI_DOCS/memory/implementation-plan.md`:

```markdown
## Session Trace
- Session ID: sess_20260205_001
- Started: 2026-02-05 01:00
- Skills executed: [list]
```

---

## 5. Performance Benchmarks

### 5.1 Expected Durations

| Skill | Expected | Warning | Critical |
|-------|----------|---------|----------|
| session-management | < 30s | 1m | 2m |
| prd-generation | < 2m | 5m | 10m |
| prd-generation | < 5m | 10m | 20m |
| build | < 30m | 1h | 2h |

### 5.2 Token Budgets

| Skill | Typical | Max |
|-------|---------|-----|
| session-management | 2K | 5K |
| prd-generation | 5K | 15K |
| prd-generation | 10K | 30K |
| build | 20K | 50K |

---

## 6. Debugging Workflow

### When Skill Fails

1. **Check the active milestone's** `tasks.md` (and the `AI_DOCS/memory/task-ledger.md` summary)
2. **Review last gate** - what criteria failed?
3. **Check handoff** - was context passed correctly?
4. **Examine tokens** - was budget exceeded?
5. **Invoke `error-handling`** skill for recovery

---

*Part of AI_SKILLS Framework v2.0*
*Last Updated: 2026-02-05*
