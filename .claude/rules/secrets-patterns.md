---
paths:
  - "**/.env*"
  - "hooks/**"
---

# Secrets Pattern Catalogue

Authoritative list of regex patterns the framework treats as secrets. Kept in sync with:

- `hooks/scrub.sh` — redaction at telemetry / memory boundaries
- `hooks/pre-commit-scan.sh` — git pre-commit scanner

## API keys

| Pattern | Matches | Replacement |
|---|---|---|
| `sk-ant-[A-Za-z0-9_-]{20,}` | Anthropic API key | `[REDACTED_ANTHROPIC_KEY]` |
| `sk-proj-[A-Za-z0-9_-]{20,}` | OpenAI project key | `[REDACTED_OPENAI_PROJECT_KEY]` |
| `sk-[A-Za-z0-9]{20,}` | OpenAI / generic `sk-` prefixed | `[REDACTED_OPENAI_KEY]` |
| `sk_live_[A-Za-z0-9]{24,}` | Stripe live secret key | `[REDACTED_STRIPE_LIVE_KEY]` |
| `AKIA[0-9A-Z]{16}` | AWS access key (long-term) | `[REDACTED_AWS_ACCESS_KEY]` |
| `ASIA[0-9A-Z]{16}` | AWS session key (temporary) | `[REDACTED_AWS_SESSION_KEY]` |
| `ghp_[A-Za-z0-9]{36}` | GitHub personal access token | `[REDACTED_GITHUB_PAT]` |
| `gho_[A-Za-z0-9]{36}` | GitHub OAuth | `[REDACTED_GITHUB_OAUTH]` |
| `ghs_[A-Za-z0-9]{36}` | GitHub server-to-server | `[REDACTED_GITHUB_SERVER]` |
| `github_pat_[A-Za-z0-9_]{22,}` | GitHub fine-grained personal access token | `[REDACTED_GITHUB_FINE_GRAINED_PAT]` |
| `xox[bpoas]-[0-9A-Za-z-]{20,}` | Slack bot/user/app token | `[REDACTED_SLACK_TOKEN]` |

## Connection strings

| Pattern | Matches | Replacement |
|---|---|---|
| `(postgres\|postgresql\|mysql\|mongodb\|redis\|amqp)://<user>:<pass>@<host>` | URL-form credentials | `<scheme>://[REDACTED_CONN]` |

## Bearer / Basic auth

| Pattern | Matches | Replacement |
|---|---|---|
| `Bearer [A-Za-z0-9._-]{20,}` | HTTP Authorization Bearer | `Bearer [REDACTED_BEARER]` |
| `[Bb]asic [A-Za-z0-9+/=]{20,}` | HTTP Authorization Basic | `Basic [REDACTED_BASIC]` |

## Tokens

| Pattern | Matches | Replacement |
|---|---|---|
| `eyJ<b64>.eyJ<b64>.<sig>` | JWT (three base64url segments) | `[REDACTED_JWT]` |

## Private keys

| Pattern | Matches | Replacement |
|---|---|---|
| `-----BEGIN [A-Z ]*PRIVATE KEY-----` | PEM private key header | `[REDACTED_PRIVATE_KEY_BEGIN]` |
| `-----END [A-Z ]*PRIVATE KEY-----` | PEM private key footer | `[REDACTED_PRIVATE_KEY_END]` |

## Generic patterns (lower confidence)

| Pattern | Matches | Replacement |
|---|---|---|
| `api[_-]?key[[:space:]]*[:=][[:space:]]*["']?[A-Za-z0-9._-]{20,}` | Assignment-style API_KEY | `API_KEY=[REDACTED]` |
| `aws_secret_access_key[[:space:]]*[:=][[:space:]]*["']?[A-Za-z0-9+/=]{40,}` (key in any letter case) | Assignment-style AWS secret access key | Key, separator and quotes are kept. The value becomes `[REDACTED_AWS_SECRET_KEY]` |
| `password[[:space:]]*[:=][[:space:]]*<value of 6 or more characters>` (key in any letter case, value quoted or bare) | Assignment-style password, including `DB_PASSWORD=...` and `"password": "..."` | Key, separator and quotes are kept. The value becomes `[REDACTED_PASSWORD]` |

The password row is applied by `hooks/scrub.sh` only. It is deliberately absent from `hooks/pre-commit-scan.sh`, where it would block every `password: string` line of ordinary code. The scanner matches the AWS secret access key row at exactly 40 characters.

## Sensitive-section markers

Framework-defined markers honored by scrubbers and consumers:

```markdown
<!-- SENSITIVE: do-not-log -->
Content between these markers is omitted from telemetry, memory, and cross-doc excerpting.
<!-- /SENSITIVE -->
```

Scrubbers strip marker-enclosed content entirely before write.

## Not scrubbed (intentionally)

- Email addresses — too many false positives; honor sensitive-section markers instead
- Customer IDs / UUIDs — domain-specific; users can add a project-level pattern file

## Adding project-specific patterns

Projects can extend the catalogue with `AI_DOCS/security/project-secrets-patterns.md`. The scrubber loads it (if present) after the built-in set.

## Compliance controls

Scan scope and policy applied by `/audit` (absorbed from the former `compliance/secrets.md`, v4.32.0). The patterns above are the catalogue. These controls say how they are applied.

- **Scan scope**: match anywhere outside `node_modules/`, `.git/`, `dist/`, `build/`, `.next/`, `__pycache__/`, `.venv/`.
- **Test allowlist**: fixtures in `tests/**` or `__tests__/**` are allowlisted only when the value is clearly a placeholder (for example `"test_token_xxx"`, `"sk_test_..."`).
- **Hard-fail**: every row in the API keys, Private keys and Tokens tables, plus hardcoded `secret=`/`password=` assignments in source. A JWT literal in source (not in a test) is a hard fail.
- **Concern (flag, not fail)**: a Bearer token in source or test, a generic `token = "..."` assignment of 20 or more characters, and any database URI with credentials in the URL (move it to an env var).
- All secrets live in env vars or a managed secret store (AWS Secrets Manager, Vault, Doppler).
- `.env.local` and `.env.*.local` are gitignored. `.env.example` (placeholders only) is committed.
- Rotate any leaked secret immediately on detection. Rotation, not deletion of git history, is the response.
- For compliance projects, log access to secrets (who, when, from where).

## Testing

Canary fixtures in `tests/fixtures/secrets/` (once test layers are authorized):

- `known-secrets.md` — file containing one of every pattern above
- Expected output after scrub: zero pattern matches

Proving test: `bash hooks/tests/secrets-scan-and-scrub.test.sh` drives `scrub.sh` and `pre-commit-scan.sh` in both directions (a secret is redacted or blocks the commit, clean input passes through).
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
<!-- Version: 1.0.1 | 2026-10-05 | Added the sk_live_, github_pat_, aws_secret_access_key and password-assignment rows that hooks/scrub.sh now redacts. The password row is scrubber-only. pre-commit-scan.sh gained ASIA, ghs_, amqp, sk_live_, github_pat_ and aws_secret_access_key, and its PEM pattern now matches. Proving test added -->
<!-- Version: 1.1.0 | 2026-10-22 | v4.32.0 merge: absorbed compliance/secrets.md (removed) as the Compliance controls section: scan scope, test allowlist, hard-fail vs concern tiers, storage and rotation policy. Pattern tables unchanged -->
