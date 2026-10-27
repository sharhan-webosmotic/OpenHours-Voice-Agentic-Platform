# Secrets & Sensitive Data Policy

## Scope

Applies to:

1. **Telemetry writes** — any event appended to `AI_DOCS/memory/metrics.jsonl`
2. **Auto-memory writes** — any file written under `~/.claude/projects/<project>/memory/`
3. **Git commits** — any staged file, scanned by `pre-commit-scan.sh`
4. **Agent output** — any text returned by subagents that may be logged

Does **not** apply to (by design):

- Planning docs under `AI_DOCS/planning/` — these are the team's source of truth; committed as reviewable artifacts
- User prompts — never intercepted or modified

## Three boundaries

### Boundary 1 — Scrub at telemetry / memory write

`hooks/scrub.sh` runs on every write to:

- `AI_DOCS/memory/metrics.jsonl`
- `AI_DOCS/memory/hook-health.log`
- `~/.claude/projects/*/memory/project_*.md`

Patterns come from `rules/secrets-patterns.md`.

### Boundary 2 — Pre-commit scan

`hooks/pre-commit-scan.sh` installed as `.git/hooks/pre-commit`. Scans staged files; blocks commit on any match.

Install:

```bash
cp hooks/pre-commit-scan.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### Boundary 3 — Sensitive-section markers

Users can mark spans inside planning docs as sensitive:

```markdown
<!-- SENSITIVE: do-not-log -->
Database: postgres://prod-ro@db.internal:5432/app
<!-- /SENSITIVE -->
```

Scrubbers strip these sections entirely before write. Any doc containing a `<!-- SENSITIVE: ... -->` marker that isn't closed triggers a warning.

## Pattern catalogue

See `rules/secrets-patterns.md` for the full regex list.

Current coverage (v3.1):

- API keys: Anthropic, OpenAI, AWS, GitHub (PAT/OAuth/server), Slack
- Connection strings: Postgres, MySQL, MongoDB, Redis, AMQP
- Tokens: JWT, Bearer, Basic
- Private keys: PEM (RSA/EC/OpenSSH)
- Generic: `api_key=<value>` assignment syntax

## Git hygiene

At `/session-management` (Workflow A) the framework adds these entries to `.gitignore`:

```
# Framework — contains potentially sensitive state
AI_DOCS/memory/metrics.jsonl
AI_DOCS/memory/session-state.md
AI_DOCS/memory/hook-health.log
AI_DOCS/memory/reports/
AI_DOCS/memory/session-reads.log
.claude/settings.local.json
.claude-project-id
```

## Opt-out

Set in `.claude/settings.local.json`:

```json
{
  "telemetry": { "enabled": false },
  "scrubbing": { "enabled": true }
}
```

**Never disable scrubbing.** It's the last line of defense.

## Extending patterns per-project

Create `AI_DOCS/security/project-secrets-patterns.md`. Same format as the built-in catalogue. Scrubbers load it (if present) after the built-in set.

Example project extension:

```markdown
| `CUST-[0-9]{9}-[A-Z]{3}` | Internal customer ID | `[REDACTED_CUSTOMER_ID]` |
```

## Testing

Canary fixture at `tests/fixtures/secrets/known-secrets.md` (created when test layers are authorized) contains one instance of every pattern. Scrubber must produce zero matches on the output.

## Audit trail

All redactions log a low-detail event:

```json
{"ts":"...","event":"scrub.redacted","count":2,"pattern_class":"api_key"}
```

The redacted content itself is never logged — only the count and class.

## Reporting a leak

If you notice an un-scrubbed secret in `metrics.jsonl` or a committed file:

1. Revoke the secret immediately
2. Add the matching pattern to `rules/secrets-patterns.md` + `hooks/scrub.sh`
3. Run `git filter-repo` to purge from history
4. File an issue documenting the gap
