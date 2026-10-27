#!/usr/bin/env bash
# hooks/scrub.sh — Secrets scrubber (Cross-Cutting Secrets Policy)
# Reads stdin, writes redacted stdout.
# Pattern catalogue at rules/secrets-patterns.md; keep this script in sync.
#
# The assignment rules at the end (AWS secret key, password) keep the key, the
# separator and any opening quote, and replace only the value. They never
# consume a closing quote, so a scrubbed metrics.jsonl line stays valid JSON.
# The password rules run quoted forms first (the value may contain spaces),
# then the bare form. They live here only: in pre-commit-scan.sh they would
# block every `password: string` line of ordinary code. The AWS rule uses `#`
# as its delimiter because GNU sed reads `[\/]` as "backslash or slash".

set -uo pipefail

sed -E \
  -e 's/sk-ant-[A-Za-z0-9_-]{20,}/[REDACTED_ANTHROPIC_KEY]/g' \
  -e 's/sk-proj-[A-Za-z0-9_-]{20,}/[REDACTED_OPENAI_PROJECT_KEY]/g' \
  -e 's/sk-[A-Za-z0-9]{20,}/[REDACTED_OPENAI_KEY]/g' \
  -e 's/sk_live_[A-Za-z0-9]{24,}/[REDACTED_STRIPE_LIVE_KEY]/g' \
  -e 's/AKIA[0-9A-Z]{16}/[REDACTED_AWS_ACCESS_KEY]/g' \
  -e 's/ASIA[0-9A-Z]{16}/[REDACTED_AWS_SESSION_KEY]/g' \
  -e 's/ghp_[A-Za-z0-9]{36}/[REDACTED_GITHUB_PAT]/g' \
  -e 's/gho_[A-Za-z0-9]{36}/[REDACTED_GITHUB_OAUTH]/g' \
  -e 's/ghs_[A-Za-z0-9]{36}/[REDACTED_GITHUB_SERVER]/g' \
  -e 's/github_pat_[A-Za-z0-9_]{22,}/[REDACTED_GITHUB_FINE_GRAINED_PAT]/g' \
  -e 's/xox[bpoas]-[0-9A-Za-z-]{20,}/[REDACTED_SLACK_TOKEN]/g' \
  -e 's/(postgres|postgresql|mysql|mongodb|redis|amqp):\/\/[^:@ ]+:[^@ ]+@[^\/ ]+/\1:\/\/[REDACTED_CONN]/g' \
  -e 's/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/[REDACTED_JWT]/g' \
  -e 's/-----BEGIN [A-Z ]*PRIVATE KEY-----/[REDACTED_PRIVATE_KEY_BEGIN]/g' \
  -e 's/-----END [A-Z ]*PRIVATE KEY-----/[REDACTED_PRIVATE_KEY_END]/g' \
  -e 's/Bearer [A-Za-z0-9._-]{20,}/Bearer [REDACTED_BEARER]/g' \
  -e 's/[Bb]asic [A-Za-z0-9+\/=]{20,}/Basic [REDACTED_BASIC]/g' \
  -e 's/[Aa][Pp][Ii][_-]?[Kk][Ee][Yy][[:space:]]*[:=][[:space:]]*["'"'"']?[A-Za-z0-9._-]{20,}["'"'"']?/API_KEY=[REDACTED]/g' \
  -e 's#([Aa][Ww][Ss]_[Ss][Ee][Cc][Rr][Ee][Tt]_[Aa][Cc][Cc][Ee][Ss][Ss]_[Kk][Ee][Yy]\\?["'"'"']?[[:space:]]*[:=][[:space:]]*\\?["'"'"']?)[A-Za-z0-9+/=]{40,}#\1[REDACTED_AWS_SECRET_KEY]#g' \
  -e 's/([Pp][Aa][Ss][Ss][Ww][Oo][Rr][Dd]\\?["'"'"']?[[:space:]]*[:=][[:space:]]*\\?")([^"\\]|\\[^"]){6,}/\1[REDACTED_PASSWORD]/g' \
  -e 's/([Pp][Aa][Ss][Ss][Ww][Oo][Rr][Dd]\\?["'"'"']?[[:space:]]*[:=][[:space:]]*\\?'"'"')[^'"'"']{6,}/\1[REDACTED_PASSWORD]/g' \
  -e 's/([Pp][Aa][Ss][Ss][Ww][Oo][Rr][Dd]\\?["'"'"']?[[:space:]]*[:=][[:space:]]*)([^"'"'"'[:space:]\\]|\\[^"'"'"'[:space:]]){6,}/\1[REDACTED_PASSWORD]/g'
