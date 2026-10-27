#!/usr/bin/env bash
# hooks/infra-cost-gate.sh — Infra cost approval gate (v1.0, ADF 4.2).
#
# PreToolUse[Bash] guard. Blocks cost-incurring infrastructure provisioning
# commands unless AI_DOCS/memory/infra-cost-approvals.md contains an APPROVED
# entry dated today (UTC). Pairs with the /infra-cost-guard skill (SK-146),
# which produces the cost table, collects the user's written approval, and
# appends the ledger line this hook greps for:
#
#   [YYYY-MM-DD] <env> <summary> — APPROVED by user — Est. $X/month ...
#
# Blocked command families:
#   terraform/tofu apply|destroy, pulumi up|destroy, cdk deploy|destroy,
#   CloudFormation stack mutations, direct instance/db/cache/cluster creation
#   via aws / gcloud / az.
#
# Escape hatch: ADF_INFRA_APPROVED=on (must be logged in decision-log.md).
# Fail-open contract: only a positive command match WITH a missing approval
# exits 2. Anything unexpected (no AI_DOCS/, unreadable stdin) exits 0.

set -uo pipefail

[ "${ADF_INFRA_APPROVED:-}" = "on" ] && exit 0
[ -d AI_DOCS ] || exit 0

INPUT=$(cat 2>/dev/null || true)
[ -n "$INPUT" ] || exit 0

# Read the command through json-field.sh (jq when present, a decoding sed
# fallback otherwise). Grepping the raw payload also matched the tool call's
# description text, so a harmless command described with the words of a gated
# one was blocked. The raw payload stays only as the last resort when nothing
# can be extracted, so a parse failure degrades to enforcement.
CMD=$(printf '%s' "$INPUT" | bash "$(dirname "$0")/json-field.sh" command 2>/dev/null)
[ -n "$CMD" ] || CMD="$INPUT"

# A global flag may carry a quoted value with a space in it:
#   terraform -chdir="/d/My Project/infrastructure/dev" apply
PATTERN="(terraform|tofu)[[:space:]]+(-[^[:space:]\"']*(\"[^\"]*\"|'[^']*')?[[:space:]]+)*(apply|destroy)\\b"
PATTERN="$PATTERN|pulumi[[:space:]]+(up|destroy)\b"
PATTERN="$PATTERN|cdk[[:space:]]+(deploy|destroy)\b"
PATTERN="$PATTERN|cloudformation[[:space:]]+(deploy|create-stack|update-stack|delete-stack)\b"
PATTERN="$PATTERN|aws[[:space:]]+ec2[[:space:]]+run-instances"
PATTERN="$PATTERN|aws[[:space:]]+(rds|elasticache|eks|ecs)[[:space:]]+create-"
PATTERN="$PATTERN|gcloud[[:space:]]+compute[[:space:]]+instances[[:space:]]+create"
PATTERN="$PATTERN|gcloud[[:space:]]+sql[[:space:]]+instances[[:space:]]+create"
PATTERN="$PATTERN|gcloud[[:space:]]+container[[:space:]]+clusters[[:space:]]+create"
PATTERN="$PATTERN|az[[:space:]]+(vm|sql|aks|postgres|mysql)[[:space:]]+create"

printf '%s' "$CMD" | grep -qE "$PATTERN" || exit 0

LEDGER="AI_DOCS/memory/infra-cost-approvals.md"
TODAY=$(date -u +%Y-%m-%d 2>/dev/null)
[ -n "$TODAY" ] || exit 0

if [ -f "$LEDGER" ] && grep -q "\[$TODAY\].*APPROVED" "$LEDGER" 2>/dev/null; then
  exit 0
fi

{
  echo ""
  echo "========================================"
  echo "  INFRA COST GATE"
  echo "========================================"
  echo "  Cost-incurring infra command detected,"
  echo "  but no infra cost approval is recorded"
  echo "  for today in:"
  echo "    $LEDGER"
  echo ""
  echo "  ACTION REQUIRED:"
  echo "  1. Run /infra-cost-guard — cost table,"
  echo "     risk flags, optimization options."
  echo "  2. Get the user's written approval."
  echo "  3. Append the APPROVED ledger entry"
  echo "     (dated $TODAY)."
  echo "  Then re-run this command."
  echo ""
  echo "  Emergency escape: ADF_INFRA_APPROVED=on"
  echo "  (must be logged in decision-log.md)."
  echo "========================================"
} >&2
exit 2
