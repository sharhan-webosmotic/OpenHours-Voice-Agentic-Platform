# Telemetry

Local-only event stream used to measure framework effectiveness. No data leaves the machine.

## Where events are written

`AI_DOCS/memory/metrics.jsonl` — one JSON object per line, append-only.

The directory is `.gitignore`'d by default.

## Event schema

Every event has at minimum `ts` (ISO-8601 UTC) plus `event` (string identifier). Additional fields depend on the event type.

### `session.start`

```json
{"ts":"2026-04-21T14:22:10Z","event":"session.start","project_id":"<uuid>","phase":"3"}
```

### `session.end`

```json
{"ts":"2026-04-21T18:05:00Z","event":"session.end","project_id":"<uuid>","phase":"3"}
```

### `skill.invoke`

```json
{"ts":"...","event":"skill.invoke","skill":"design-system","phase":3}
```

### `skill.complete`

```json
{"ts":"...","event":"skill.complete","skill":"design-system","duration_ms":32100,"outcome":"success"}
```

### `skill.abandon`

```json
{"ts":"...","event":"skill.abandon","skill":"design-discovery","reason":"user_interrupted"}
```

### `skill.error`

```json
{"ts":"...","event":"skill.error","skill":"deployment","error":"missing_prerequisite","details":"tech-spec.md not locked"}
```

### `skill.deprecated_alias`

```json
{"ts":"...","event":"skill.deprecated_alias","old":"claude-md","new":"project-context"}
```

### `hook.anchor_block`

```json
{"ts":"...","event":"hook.anchor_block","file":"AI_DOCS/architecture/api-contract.md","tool":"Edit","task":"T-042"}
```

### `hook.anchor_warn`

```json
{"ts":"...","event":"hook.anchor_warn","file":"AI_DOCS/planning/tech-spec.md"}
```

### `hook.auto_disabled`

```json
{"ts":"...","event":"hook.auto_disabled","hook":"enforce-anchors","reason":"slow_p50_exceeded_threshold"}
```

### `gate.verdict`

```json
{"ts":"...","event":"gate.verdict","gate":"G2","verdict":"pass","reviewer":"solutions-architect"}
```

### `agent.spawn`

```json
{"ts":"...","event":"agent.spawn","agent":"code-reviewer","parent_skill":"team-security"}
```

### `agent.complete`

```json
{"ts":"...","event":"agent.complete","agent":"code-reviewer","duration_ms":18200,"outcome":"pass"}
```

### `validation.run`

```json
{"ts":"...","event":"validation.run","subtype":"lint","file":"src/button.tsx","outcome":"pass"}
```

### `validation.fail`

```json
{"ts":"...","event":"validation.fail","subtype":"typecheck","file":"src/api.ts","error":"TS2339"}
```

### `cost.estimate`

```json
{"ts":"...","event":"cost.estimate","skill":"brainstorm","estimated_tokens":12000,"estimated_usd":0.24}
```

## Privacy guarantees

- **Local only** — nothing uploaded, no network calls
- **Scrubbed** — `hooks/scrub.sh` runs on every event body before append; see `rules/secrets-patterns.md`
- **Opt-out** — set `"telemetry": { "enabled": false }` in `.claude/settings.local.json`
- **Gitignored** — `AI_DOCS/memory/metrics.jsonl` is never committed

## Querying

Use `jq` or `grep` for ad-hoc queries:

```bash
# All skill invocations today
jq -c 'select(.event=="skill.invoke" and (.ts | startswith("2026-04-21")))' \
  AI_DOCS/memory/metrics.jsonl

# Abandonment rate per skill (last 30 days)
jq -c 'select(.event | test("^skill\\.(invoke|abandon)$"))' AI_DOCS/memory/metrics.jsonl \
  | jq -s 'group_by(.skill) | map({skill: .[0].skill,
      invokes: (map(select(.event=="skill.invoke")) | length),
      abandons: (map(select(.event=="skill.abandon")) | length)})'
```

For a structured weekly roll-up, run `/framework-metrics` (to be authored in Wave 2).

## Retention

Default: no automatic pruning. Users can rotate manually.

```bash
# Archive events older than 90 days
awk -v cutoff="$(date -u -d '90 days ago' +%s)" '
  { ts_str = substr($0, index($0, "ts") + 5, 20);
    cmd = "date -u -d \""ts_str"\" +%s"; cmd | getline ts; close(cmd);
    if (ts < cutoff) print > "AI_DOCS/memory/metrics.archive.jsonl";
    else print > "AI_DOCS/memory/metrics.jsonl.new" }' \
  AI_DOCS/memory/metrics.jsonl
mv AI_DOCS/memory/metrics.jsonl.new AI_DOCS/memory/metrics.jsonl
```

## Hook wiring

Lifecycle events are emitted by:

- `hooks/session-start.sh` — `session.start`
- `hooks/session-end.sh` — `session.end`
- `hooks/log-event.sh` — called by other hooks + skills for specific events
- `hooks/enforce-anchors.sh` — `hook.anchor_block` / `hook.anchor_warn`

Skills invoke `hooks/log-event.sh` at their own boundaries. Example at the top of a SKILL.md workflow:

```bash
bash hooks/log-event.sh "\"event\":\"skill.invoke\",\"skill\":\"$SKILL_NAME\",\"model\":\"$MODEL\""
```
