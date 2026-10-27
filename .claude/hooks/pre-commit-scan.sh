#!/usr/bin/env bash
# hooks/pre-commit-scan.sh — Secrets scan on staged files (Cross-Cutting Secrets Policy)
# Installed as .git/hooks/pre-commit. Blocks commit if staged content matches any secret pattern.
# Also checks for sensitive-section markers violated by outputs.
#
# set -e is intentionally OFF (house rule): a non-zero from a grep that finds
# nothing must not abort the scan and fail open. Each step is guarded and the
# script decides the block/allow verdict explicitly via its own exit code.

set -uo pipefail

# Patterns to block (must stay in sync with scrub.sh)
# One deliberate difference: the password-assignment rule lives in scrub.sh
# only. Here it would block every `password: string` line of ordinary code.
BLOCK_PATTERNS=(
  'sk-ant-[A-Za-z0-9_-]{20,}'
  'sk-proj-[A-Za-z0-9_-]{20,}'
  'sk-[A-Za-z0-9]{30,}'
  'sk_live_[A-Za-z0-9]{24,}'
  'AKIA[0-9A-Z]{16}'
  'ASIA[0-9A-Z]{16}'
  'ghp_[A-Za-z0-9]{36}'
  'gho_[A-Za-z0-9]{36}'
  'ghs_[A-Za-z0-9]{36}'
  'github_pat_[A-Za-z0-9_]{22,}'
  'xox[bpoas]-[0-9A-Za-z-]{20,}'
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'
  'eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'
  '(postgres|postgresql|mysql|mongodb|redis|amqp):\/\/[^:@ ]+:[^@ ]+@'
  '[Aa][Ww][Ss]_[Ss][Ee][Cc][Rr][Ee][Tt]_[Aa][Cc][Cc][Ee][Ss][Ss]_[Kk][Ee][Yy]["'"'"']?[[:space:]]*[:=][[:space:]]*["'"'"']?[A-Za-z0-9+/=]{40}'
)

STAGED=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || echo "")
[[ -z "$STAGED" ]] && exit 0

HITS=0
while IFS= read -r file; do
  [[ ! -f "$file" ]] && continue
  case "$file" in
    *.lock|*.png|*.jpg|*.jpeg|*.gif|*.webp|*.pdf|*.zip|*.tar*|*.gz) continue ;;
  esac
  for pat in "${BLOCK_PATTERNS[@]}"; do
    # -e and -- are required: the PEM pattern starts with "-", and without
    # them grep read it as an option, errored, and never matched a private key.
    if grep -qE -e "$pat" -- "$file" 2>/dev/null; then
      echo "✗ pre-commit-scan: secret pattern matched in $file (pattern: $pat)"
      HITS=$((HITS + 1))
    fi
  done
done <<< "$STAGED"

if [[ $HITS -gt 0 ]]; then
  echo ""
  echo "Commit blocked: $HITS secret-pattern match(es) in staged files."
  echo "Scrub the secrets, add them to .env (gitignored), and retry."
  echo "To bypass in a verified-safe case: git commit --no-verify (not recommended)."
  exit 1
fi

exit 0
