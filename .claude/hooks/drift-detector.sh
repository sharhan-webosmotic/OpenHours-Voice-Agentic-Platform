#!/usr/bin/env bash
# hooks/drift-detector.sh — Advisory drift scanner (v3.5).
#
# Runs on SessionStart, rate-limited to once per 24h (timestamp in
# AI_DOCS/memory/.drift-last-run). Three phases, each independent — skips if
# its input files are missing.
#
# Phase A: routes in code that are NOT in api-contract.md   (forgotten to document)
# Phase B: routes in api-contract.md that are NOT in code   (planned but not built)
# Phase C: acceptance criteria in tech-spec with no matching test file keyword
# Phase D: unresolved <!-- STALE --> markers in planning docs (change not fully propagated)
# Phase E: api-contract endpoints but no authz-matrix.yaml  (RBAC correctness unverified)
# Phase F: migrations but no database-schema.md             (schema-validation has nothing to diff)
# Phase G: UI data-perm attributes with no authz-matrix cell (frontend-RBAC drift)
# Phase H: a core declared/installed library is installed but unused (adoption)
# Phase I: a registered enforcing control is not actually wired, or never proven
# Phase J: a milestone's cited requirement source has grown since the plan was cut
#
# Writes AI_DOCS/quality/drift-report.md when drift is found; deletes it when
# clean. Pure-bash, no agents invoked — session-start.sh surfaces the report.
#
# The SCANNER never blocks anything (heuristic regex has false positives, every
# finding carries file:line for verification). Enforcement lives in the
# consumers (since v4.2): /build refuses tasks on Phase A/D findings, Gate 4D
# requires Phase A/C/D clean at milestone close, and Gate 5 + /ship require a
# fresh clean (or explicitly acknowledged) report before deploy. Gates force a
# fresh scan with: rm AI_DOCS/memory/.drift-last-run && bash this-file.

set -uo pipefail

AI_DOCS_DIR="${AI_DOCS:-AI_DOCS}"
# D-056: the script read PROJECT_DIR (Phase H) without ever defaulting it, so
# under `set -u` any invocation outside the SessionStart hook env died with
# "PROJECT_DIR: unbound variable" after the phases had already run. Default it
# here so the script is runnable by hand, which is how it gets verified.
PROJECT_DIR="${PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-$PWD}}"
LAST_RUN_FILE="$AI_DOCS_DIR/memory/.drift-last-run"
REPORT_FILE="$AI_DOCS_DIR/quality/drift-report.md"
CONTRACT_FILE="$AI_DOCS_DIR/architecture/api-contract.md"
SPEC_FILE="$AI_DOCS_DIR/planning/tech-spec.md"

# Rate-limit — once per 24h.
NOW_EPOCH=$(date -u +%s)
DAY=86400
if [[ -f "$LAST_RUN_FILE" ]]; then
  LAST=$(cat "$LAST_RUN_FILE" 2>/dev/null | tr -d '[:space:]')
  if [[ -n "$LAST" ]] && (( NOW_EPOCH - LAST < DAY )); then
    exit 0
  fi
fi

# Only meaningful inside a real project.
#
# D-056: this listed only src/app/backend/api, a single-app layout. A pnpm or
# npm WORKSPACE puts its code under apps/ and packages/, so on every monorepo
# this hook exited here on every SessionStart and never scanned anything. The
# failure was silent and indistinguishable from a clean scan, so seven milestone
# closes read "no report" as "no drift" and four recorded a drift verdict no
# scan had produced. Record which roots matched, so the report can state what
# was actually scanned instead of leaving it implied.
SCAN_ROOTS=()
for _r in src app backend api apps packages; do
  [[ -d "$_r" ]] && SCAN_ROOTS+=("$_r")
done
if (( ${#SCAN_ROOTS[@]} == 0 )); then
  exit 0
fi

mkdir -p "$(dirname "$REPORT_FILE")" 2>/dev/null

# ── Phase A + B helpers: route extraction ──────────────────────────────────────
# Extract (METHOD, PATH) tuples from source code. Supports:
#   Express/Fastify:  router.get('/path',  app.post("/path",
#   NestJS:           @Get('/path')        @Post("/path")
#   FastAPI:          @app.get("/path")    @router.put("/path")
# Output format: "METHOD PATH FILE:LINE"
extract_routes_from_code() {
  # Search common code directories, skip node_modules/dist/build.
  local roots=()
  for d in src app backend api services packages; do
    [[ -d "$d" ]] && roots+=("$d")
  done
  [[ ${#roots[@]} -eq 0 ]] && return 0

  # Express / Fastify style: router.get('/path'),  app.post("/path")
  grep -rn -E '\.(get|post|put|patch|delete)[[:space:]]*\(' "${roots[@]}" \
    --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' \
    --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build \
    --exclude-dir=.next --exclude-dir=coverage 2>/dev/null \
    | sed -nE "s/^([^:]+):([0-9]+):.*\.(get|post|put|patch|delete)[[:space:]]*\([[:space:]]*['\"]([^'\"]+)['\"].*/\U\3\E \4 \1:\2/p"

  # NestJS / Spring style decorators: @Get('/path')
  grep -rn -E '@(Get|Post|Put|Patch|Delete)[[:space:]]*\(' "${roots[@]}" \
    --include='*.ts' --include='*.java' --include='*.kt' \
    --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build 2>/dev/null \
    | sed -nE "s/^([^:]+):([0-9]+):.*@(Get|Post|Put|Patch|Delete)[[:space:]]*\([[:space:]]*['\"]([^'\"]+)['\"].*/\U\3\E \4 \1:\2/p"

  # FastAPI / Flask style: @app.get("/path"), @router.post("/path")
  grep -rn -E '@[[:alnum:]_]+\.(get|post|put|patch|delete)[[:space:]]*\(' "${roots[@]}" \
    --include='*.py' --exclude-dir=__pycache__ --exclude-dir=venv --exclude-dir=.venv 2>/dev/null \
    | sed -nE "s/^([^:]+):([0-9]+):.*@[[:alnum:]_]+\.(get|post|put|patch|delete)[[:space:]]*\([[:space:]]*['\"]([^'\"]+)['\"].*/\U\3\E \4 \1:\2/p"
}

# Extract (METHOD, PATH) tuples from api-contract.md.
# Accepts:
#   ## POST /api/users
#   | POST /api/users |
#   - POST /api/users —
# Uses awk throughout — prior sed-based implementation broke when the file
# path contained slashes (delimiter clash in the replacement).
extract_routes_from_contract() {
  [[ ! -f "$CONTRACT_FILE" ]] && return 0
  awk -v f="$CONTRACT_FILE" '
    {
      if (match($0, /(GET|POST|PUT|PATCH|DELETE)[[:space:]]+\/[a-zA-Z0-9_\/:{}\-]+/)) {
        chunk = substr($0, RSTART, RLENGTH)
        split(chunk, parts, /[[:space:]]+/)
        if (parts[1] && parts[2]) {
          printf "%s %s %s:%d\n", parts[1], parts[2], f, NR
        }
      }
    }
  ' "$CONTRACT_FILE"
}

# Normalize a path for matching: lowercase, strip trailing slash, collapse
# :param and {param} to <param>.
normalize_path() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' \
    | sed -E 's|/$||; s|:[a-zA-Z_][a-zA-Z0-9_]*|<param>|g; s|\{[a-zA-Z_][a-zA-Z0-9_]*\}|<param>|g'
}

# ── Build the report incrementally ─────────────────────────────────────────────
REPORT_BUF=""
rbuf() { REPORT_BUF+="$1"$'\n'; }

rbuf "# Drift Report"
rbuf ""
rbuf "Generated: $(date -u +'%Y-%m-%d %H:%M UTC')  "
rbuf "Scanned roots: ${SCAN_ROOTS[*]}  "
rbuf "Scope: code in the scanned roots above vs api-contract.md and tech-spec.md."
rbuf ""
rbuf "This file is **advisory**. All findings are heuristic — verify before acting."
rbuf ""

TOTAL_FINDINGS=0

# ── Phase A: code routes missing from contract ─────────────────────────────────
CODE_ROUTES=$(extract_routes_from_code | sort -u)
CONTRACT_ROUTES=$(extract_routes_from_contract | sort -u)

PHASE_A_FINDINGS=""
if [[ -n "$CODE_ROUTES" ]]; then
  # Build a normalized lookup of contract routes.
  CONTRACT_KEYS=""
  if [[ -n "$CONTRACT_ROUTES" ]]; then
    CONTRACT_KEYS=$(printf '%s\n' "$CONTRACT_ROUTES" | awk '{ print $1 "|" $2 }' | while IFS='|' read -r m p; do
      printf '%s %s\n' "$m" "$(normalize_path "$p")"
    done | sort -u)
  fi

  PHASE_A_FINDINGS=$(printf '%s\n' "$CODE_ROUTES" | while IFS=' ' read -r method path location; do
    [[ -z "$method" || -z "$path" ]] && continue
    key="$method $(normalize_path "$path")"
    if ! printf '%s\n' "$CONTRACT_KEYS" | grep -qFx "$key"; then
      printf -- '- [ ] %s %s — not documented in api-contract.md (%s)\n' "$method" "$path" "$location"
    fi
  done)
fi

if [[ -n "$PHASE_A_FINDINGS" ]]; then
  A_COUNT=$(printf '%s\n' "$PHASE_A_FINDINGS" | grep -c '^- \[ \]' || true)
  A_COUNT=${A_COUNT:-0}
  TOTAL_FINDINGS=$(( TOTAL_FINDINGS + A_COUNT ))
  rbuf "## A) Routes in code but NOT in api-contract.md ($A_COUNT)"
  rbuf ""
  rbuf "$PHASE_A_FINDINGS"
  rbuf ""
fi

# ── Phase B: contract routes missing from code ─────────────────────────────────
PHASE_B_FINDINGS=""
if [[ -n "$CONTRACT_ROUTES" ]]; then
  CODE_KEYS=""
  if [[ -n "$CODE_ROUTES" ]]; then
    CODE_KEYS=$(printf '%s\n' "$CODE_ROUTES" | awk '{ print $1 "|" $2 }' | while IFS='|' read -r m p; do
      printf '%s %s\n' "$m" "$(normalize_path "$p")"
    done | sort -u)
  fi

  PHASE_B_FINDINGS=$(printf '%s\n' "$CONTRACT_ROUTES" | while IFS=' ' read -r method path location; do
    [[ -z "$method" || -z "$path" ]] && continue
    key="$method $(normalize_path "$path")"
    if ! printf '%s\n' "$CODE_KEYS" | grep -qFx "$key"; then
      printf -- '- [ ] %s %s — declared in contract but no implementation found (%s)\n' "$method" "$path" "$location"
    fi
  done)
fi

if [[ -n "$PHASE_B_FINDINGS" ]]; then
  B_COUNT=$(printf '%s\n' "$PHASE_B_FINDINGS" | grep -c '^- \[ \]' || true)
  B_COUNT=${B_COUNT:-0}
  TOTAL_FINDINGS=$(( TOTAL_FINDINGS + B_COUNT ))
  rbuf "## B) Routes in api-contract.md but NOT in code ($B_COUNT)"
  rbuf ""
  rbuf "$PHASE_B_FINDINGS"
  rbuf ""
fi

# ── Phase C: acceptance criteria without matching test keyword ─────────────────
PHASE_C_FINDINGS=""
if [[ -f "$SPEC_FILE" ]]; then
  # Extract lines under any "Acceptance Criteria" heading at any level (##, ###, etc.)
  # and both - [ ] / - [x] checkbox states.
  CRITERIA=$(awk '
    /^#+[[:space:]]*Acceptance Criteria/ { inblock=1; next }
    /^#+[[:space:]]/ && inblock { inblock=0 }
    inblock && /^[[:space:]]*-[[:space:]]*\[[x ]\]/ { print }
  ' "$SPEC_FILE" 2>/dev/null)

  if [[ -n "$CRITERIA" ]]; then
    # For each criterion, extract 2-3 meaningful keywords (non-stopwords, 4+ chars)
    # and check if ANY test file contains at least one keyword.
    PHASE_C_FINDINGS=$(printf '%s\n' "$CRITERIA" | while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      # Strip markdown + checkbox.
      text=$(printf '%s' "$line" | sed -E 's/^[[:space:]]*-[[:space:]]*\[[x ]\][[:space:]]*//; s/[`*_]//g')
      # Split, keep words 5+ chars, drop common filler.
      kws=$(printf '%s\n' "$text" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '\n' \
            | awk 'length >= 5' \
            | grep -vE '^(should|shall|must|will|return|response|request|system|value|within|using|after|before|allow)$' \
            | head -3 | tr '\n' '|' | sed 's/|$//')
      [[ -z "$kws" ]] && continue

      found=""
      # Search test-conventional locations.
      for testdir in tests test __tests__ spec src; do
        [[ ! -d "$testdir" ]] && continue
        if grep -rilE "($kws)" "$testdir" \
             --include='*.test.*' --include='*.spec.*' --include='*_test.*' \
             --exclude-dir=node_modules --exclude-dir=dist 2>/dev/null | grep -q . ; then
          found=1
          break
        fi
      done
      if [[ -z "$found" ]]; then
        # Truncate text for report readability.
        display=$(printf '%s' "$text" | cut -c1-120)
        printf -- '- [ ] "%s" — no test file matches keywords [%s]\n' "$display" "${kws//|/, }"
      fi
    done)
  fi
fi

if [[ -n "$PHASE_C_FINDINGS" ]]; then
  C_COUNT=$(printf '%s\n' "$PHASE_C_FINDINGS" | grep -c '^- \[ \]' || true)
  C_COUNT=${C_COUNT:-0}
  TOTAL_FINDINGS=$(( TOTAL_FINDINGS + C_COUNT ))
  rbuf "## C) Acceptance criteria without matching test ($C_COUNT)"
  rbuf ""
  rbuf "Keyword matching is heuristic — a criterion may be covered by a test whose name uses different wording. Investigate before acting."
  rbuf ""
  rbuf "$PHASE_C_FINDINGS"
  rbuf ""
  rbuf "**Remediation (one-click):**"
  rbuf ""
  rbuf '```'
  rbuf "/task-planner Create tests for the uncovered acceptance criteria listed in AI_DOCS/quality/drift-report.md (Phase C). Delegate to the test-writer agent; mirror the project's existing test conventions."
  rbuf '```'
  rbuf ""
  rbuf "Alternative: rename existing test \`describe\`/\`it\` blocks to reflect the spec wording so they match the keyword scan."
  rbuf ""
fi

# ── Phase D: unresolved STALE markers in planning artifacts ────────────────────
# change-request marks dependent docs with <!-- STALE: reason, since DATE --> while
# propagating a change. A leftover marker means a planning doc is out of sync.
PHASE_D_FINDINGS=""
D_SCAN_DIRS=()
for d in "$AI_DOCS_DIR/planning" "$AI_DOCS_DIR/design" "$AI_DOCS_DIR/infra" "$AI_DOCS_DIR/architecture"; do
  [[ -d "$d" ]] && D_SCAN_DIRS+=("$d")
done
if [[ ${#D_SCAN_DIRS[@]} -gt 0 ]]; then
  PHASE_D_FINDINGS=$(grep -rn -- '<!-- STALE' "${D_SCAN_DIRS[@]}" --include='*.md' 2>/dev/null \
    | sed -E 's/^([^:]+):([0-9]+):.*/- [ ] \1:\2 — unresolved STALE marker; run \/change-request to finish propagation/' )
fi

if [[ -n "$PHASE_D_FINDINGS" ]]; then
  D_COUNT=$(printf '%s\n' "$PHASE_D_FINDINGS" | grep -c '^- \[ \]' || true)
  D_COUNT=${D_COUNT:-0}
  TOTAL_FINDINGS=$(( TOTAL_FINDINGS + D_COUNT ))
  rbuf "## D) Unresolved STALE markers in planning docs ($D_COUNT)"
  rbuf ""
  rbuf "A change was started but not fully propagated. These planning docs are out of sync. Gate 1, /build, and /ship treat unresolved STALE markers as blockers."
  rbuf ""
  rbuf "$PHASE_D_FINDINGS"
  rbuf ""
  rbuf "**Remediation:**"
  rbuf ""
  rbuf '```'
  rbuf "/change-request Finish propagating the pending change; update each STALE artifact in AI_DOCS/quality/drift-report.md (Phase D) and clear its marker."
  rbuf '```'
  rbuf ""
fi

# ── Phase E: RBAC authorization-matrix coverage (advisory) ─────────────────────
# api-contract has endpoints but no authz-matrix.yaml -> RBAC correctness is unverified.
PHASE_E_FINDINGS=""
_CONTRACT="$AI_DOCS_DIR/architecture/api-contract.md"
_AUTHZ="$AI_DOCS_DIR/architecture/authz-matrix.yaml"
if [[ -f "$_CONTRACT" && ! -f "$_AUTHZ" ]]; then
  if grep -qiE '\b(GET|POST|PUT|PATCH|DELETE)\b' "$_CONTRACT" 2>/dev/null; then
    PHASE_E_FINDINGS="- [ ] api-contract.md has endpoints but no authz-matrix.yaml — RBAC correctness is unverified; run /authz-matrix to generate the role x action AND role x field matrix + the per-role tests at both layers (API denial + Playwright UI element-finding, including cross-tenant negatives and masked/none fields)"
  fi
elif [[ -f "$_AUTHZ" ]]; then
  # The matrix exists but may be missing the field-level section (older matrix).
  if ! grep -qE '^[[:space:]]*fields[[:space:]]*:' "$_AUTHZ" 2>/dev/null; then
    PHASE_E_FINDINGS="- [ ] authz-matrix.yaml has the action matrix but no \`fields:\` section — field-level RBAC (read/write/masked/none per role) is unverified; re-run /authz-matrix to add it"
  fi
fi
if [[ -n "$PHASE_E_FINDINGS" ]]; then
  TOTAL_FINDINGS=$(( TOTAL_FINDINGS + 1 ))
  rbuf "## E) RBAC authorization matrix not generated (1)"
  rbuf ""
  rbuf "The role and permission matrix is still prose. Without authz-matrix.yaml and its generated tests, a wrong-role guard or a cross-tenant leak passes the build (presence-grep is not correctness)."
  rbuf ""
  rbuf "$PHASE_E_FINDINGS"
  rbuf ""
fi

# ── Phase F: DB schema spec coverage (advisory) ────────────────────────────────
# Migrations exist but there is no database-schema.md for schema-validation to diff against.
PHASE_F_FINDINGS=""
_SCHEMA="$AI_DOCS_DIR/architecture/database-schema.md"
_HAS_MIGRATIONS=""
for d in migrations prisma/migrations alembic/versions db/migrate; do
  [[ -d "$d" ]] && { _HAS_MIGRATIONS=1; break; }
done
if [[ -n "$_HAS_MIGRATIONS" && ! -f "$_SCHEMA" ]]; then
  PHASE_F_FINDINGS="- [ ] migrations exist but architecture/database-schema.md is missing — schema-validation cannot diff code against the spec; create the S7 schema doc"
fi
if [[ -n "$PHASE_F_FINDINGS" ]]; then
  TOTAL_FINDINGS=$(( TOTAL_FINDINGS + 1 ))
  rbuf "## F) DB schema spec missing (1)"
  rbuf ""
  rbuf "Migrations are present but there is no database-schema.md to validate them against. schema-validation runs up/down/up plus a spec diff, and it needs the spec."
  rbuf ""
  rbuf "$PHASE_F_FINDINGS"
  rbuf ""
fi

# ── Phase G: frontend <-> RBAC sync (advisory) ─────────────────────────────────
# UI controls carry data-perm="resource.action" / data-perm-field="resource.field".
# Every such attribute must map to a cell in authz-matrix.yaml, so the frontend stays in
# sync with the RBAC contract (the same way it consumes api-contract.md). A data-perm the
# matrix does not define means the UI gates on a permission with no contract behind it.
PHASE_G_FINDINGS=""
_AUTHZ_G="$AI_DOCS_DIR/architecture/authz-matrix.yaml"
if [[ -f "$_AUTHZ_G" ]]; then
  _PERMS=$(grep -rhoE 'data-perm(-field)?="[^"]+"' src components app pages web 2>/dev/null \
            | sed -E 's/.*="([^"]+)".*/\1/' | sort -u)
  _MISSING=""
  while IFS= read -r _p; do
    [[ -z "$_p" ]] && continue
    grep -qF "$_p" "$_AUTHZ_G" 2>/dev/null || _MISSING="$_MISSING $_p"
  done <<< "$_PERMS"
  if [[ -n "${_MISSING// /}" ]]; then
    PHASE_G_FINDINGS="- [ ] UI data-perm attributes with no authz-matrix cell:${_MISSING} — the frontend gates a control on a permission the matrix does not define. Add the cell via /authz-matrix or fix the attribute (frontend-RBAC drift)."
  fi
fi
if [[ -n "$PHASE_G_FINDINGS" ]]; then
  TOTAL_FINDINGS=$(( TOTAL_FINDINGS + 1 ))
  rbuf "## G) Frontend-RBAC drift (1)"
  rbuf ""
  rbuf "A permission-gated UI control references a permission the authz-matrix does not define. The frontend must stay in sync with the RBAC contract: every data-perm maps to a matrix cell (the reverse direction, a matrix capability with no UI, is proven at runtime by the authz validator's Playwright layer)."
  rbuf ""
  rbuf "$PHASE_G_FINDINGS"
  rbuf ""
fi

# ── Phase H: tech-stack adoption (advisory at session start, BLOCKING at close) ─
# A core library is installed but not used where it belongs. Best-effort static
# backstop for the code-reviewer's adoption dimension (tech-stack-selection Rule 9).
# /do's milestone-close drift gate treats Phase H findings as blocking: adopt the
# library or remove the package before the milestone closes. The whole-tree unused
# scan with real tools (knip/deptry/go mod tidy) runs in /audit check 12.
PHASE_H_FINDINGS=""
_PKG="$PROJECT_DIR/package.json"
if [[ -f "$_PKG" ]]; then
  _has() { grep -q "\"$1\"" "$_PKG" 2>/dev/null; }
  # D-056: these three paths do not exist in a workspace layout, so `_used` was
  # always false there. Combined with a root package.json that lists no app
  # dependencies, Phase H silently found nothing on every monorepo. Search the
  # roots that actually matched instead of a fixed single-app guess.
  _used() { grep -rqE "$1" "${SCAN_ROOTS[@]/#/$PROJECT_DIR/}" 2>/dev/null; }
  # RTK Query installed but no createApi/useXQuery/useXMutation usage anywhere.
  if _has "@reduxjs/toolkit" && ! _used "createApi|use[A-Z][A-Za-z]+(Query|Mutation)\("; then
    PHASE_H_FINDINGS="${PHASE_H_FINDINGS}- [ ] \`@reduxjs/toolkit\` is installed but no RTK Query usage (\`createApi\` / \`useXQuery\` / \`useXMutation\`) was found. Server data should use RTK Query, not raw fetch. Adopt it or record the exception in stack.md (tech-stack-selection Rule 9).\n"
  fi
  # react-hook-form installed but components still track form fields with useState.
  if _has "react-hook-form" && ! _used "useForm\(" && _used "useState"; then
    PHASE_H_FINDINGS="${PHASE_H_FINDINGS}- [ ] \`react-hook-form\` is installed but no \`useForm(\` usage was found while \`useState\` is present. Forms should use react-hook-form + zodResolver, not useState fields. Adopt it (tech-stack-selection Rule 9).\n"
  fi
fi
if [[ -n "$PHASE_H_FINDINGS" ]]; then
  TOTAL_FINDINGS=$(( TOTAL_FINDINGS + 1 ))
  rbuf "## H) Tech-stack adoption (installed but unused)"
  rbuf ""
  rbuf "A declared/installed core library is not used where it belongs. The code-reviewer agent names the exact adoption change per file; this is the static backstop."
  rbuf ""
  # NEVER pipe into this loop: `rbuf` appends to a shell variable, and a piped
  # while-loop runs in a SUBSHELL, so every bullet is written to a copy and
  # discarded. The section header still printed and the finding still counted,
  # which is why it read as working. Found 2026-08-18 while adding Phase I.
  # A here-string keeps the loop in the current shell.
  while IFS= read -r _l; do [[ -n "$_l" ]] && rbuf "$_l"; done <<< "$(printf '%b' "$PHASE_H_FINDINGS")"
  rbuf ""
fi

# ── Phase I: control registry reconciliation (advisory) ────────────────────────
#
# FF-028. Nine separate times, one project recorded a control as active and
# enforcing while the control had in fact never executed once: a lock hook whose
# arming marker was never stamped, a merge gate keyed on a substring that never
# matched, a settings entry still pointing at a superseded implementation while
# its replacement had zero references, a suite migrating one database and
# querying another. Every previous fix hardened a control's LOGIC. None of them
# proved the control FIRES, which is exactly what no test covers, because tests
# get written against a control's function rather than against its invocation.
#
# This phase reads AI_DOCS/quality/control-registry.md (one row per enforcing
# control: name, trigger, the file that wires it, the date its firing was last
# proven) and flags two things a human will not notice on their own: a control
# whose wiring file no longer references it, and a proof older than the control's
# own last modification. Advisory, never blocking: a stale proof date is a
# prompt to re-prove, not a reason to stop work.
CONTROL_REGISTRY="$AI_DOCS_DIR/quality/control-registry.md"
PHASE_I_FINDINGS=""

# _ctl_path CELL: print the existing file a registry path cell names, or nothing.
# A cell is relative to the project root. A framework file is also accepted
# relative to .claude/, because already-seeded registries carry `hooks/...` and
# `settings.json` without that prefix.
_ctl_path() {
  [[ -z "$1" ]] && return 0
  if [[ -f "$PROJECT_DIR/$1" ]]; then
    printf '%s' "$PROJECT_DIR/$1"
  elif [[ -f "$PROJECT_DIR/.claude/$1" ]]; then
    printf '%s' "$PROJECT_DIR/.claude/$1"
  fi
}

# _ctl_changed_on FILE: print the day FILE last changed, as YYYY-MM-DD.
# Git does not preserve mtimes, so on a fresh clone every control looks newer
# than any proof date. The last commit date is the answer when git tracks the
# file and the working copy carries no uncommitted edit. The mtime is the
# fallback (untracked file, local edit, no git).
_ctl_changed_on() {
  local _dir _base _day=""
  _dir=$(dirname "$1")
  _base=$(basename "$1")
  if git -C "$_dir" -c core.fileMode=false diff --quiet HEAD -- "$_base" 2>/dev/null; then
    _day=$(git -C "$_dir" log -1 --date=short --format=%cd -- "$_base" 2>/dev/null)
  fi
  [[ "$_day" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || _day=$(date -r "$1" +%Y-%m-%d 2>/dev/null)
  printf '%s' "$_day"
}

if [[ -f "$CONTROL_REGISTRY" ]]; then
  # Only the table under "## Registry" holds controls. Reading the whole file
  # turned the template's "What Phase I checks" table into four more controls
  # with no proof date. A registry without that heading is read whole, as before.
  if grep -q '^## Registry' "$CONTROL_REGISTRY" 2>/dev/null; then
    _registry_rows=$(awk '/^## Registry/{f=1; next} /^## /{f=0} f' "$CONTROL_REGISTRY" 2>/dev/null)
  else
    _registry_rows=$(cat "$CONTROL_REGISTRY" 2>/dev/null)
  fi
  # Rows look like: | name | trigger | wiring file | control file | last proven |
  while IFS= read -r _row; do
    [[ "$_row" =~ ^\|[[:space:]]*[A-Za-z] ]] || continue
    [[ "$_row" =~ ^\|[[:space:]]*(Control|-{2,}) ]] && continue
    _name=$(printf '%s' "$_row" | awk -F'|' '{gsub(/^ +| +$/,"",$2); print $2}')
    # A trailing parenthetical is a note, not part of the path:
    # "settings.json (from settings.template.json)" names settings.json.
    _wiring=$(printf '%s' "$_row" | awk -F'|' '{gsub(/^ +| +$/,"",$4); gsub(/`/,"",$4); sub(/ *\([^)]*\) *$/,"",$4); print $4}')
    _control=$(printf '%s' "$_row" | awk -F'|' '{gsub(/^ +| +$/,"",$5); gsub(/`/,"",$5); print $5}')
    _proven=$(printf '%s' "$_row" | awk -F'|' '{gsub(/^ +| +$/,"",$6); print $6}')
    [[ -z "$_name" ]] && continue
    _wiring_file=$(_ctl_path "$_wiring")
    _control_file=$(_ctl_path "$_control")
    # The D-088 shape: the wiring file exists but no longer mentions the control.
    # The .claude/ copy is checked as well, so a project file of the same name
    # (a root settings.json) cannot hide the framework one behind a bare path.
    if [[ -n "$_wiring" && -n "$_wiring_file" ]]; then
      _needle=$(basename "${_control:-$_name}")
      if [[ -n "$_needle" ]] && ! grep -qF "$_needle" "$_wiring_file" 2>/dev/null \
         && ! grep -qF "$_needle" "$PROJECT_DIR/.claude/$_wiring" 2>/dev/null; then
        PHASE_I_FINDINGS="${PHASE_I_FINDINGS}- [ ] Control \`${_name}\` is registered as wired by \`${_wiring}\`, but that file contains no reference to \`${_needle}\`. Either the wiring was replaced and the registry not updated, or the control is not actually installed. This is the shape that hid a dead lock hook for sixteen days.\n"
      fi
    elif [[ -n "$_wiring" ]]; then
      PHASE_I_FINDINGS="${PHASE_I_FINDINGS}- [ ] Control \`${_name}\` names \`${_wiring}\` as its wiring file, which does not exist.\n"
    fi
    # A proof older than the control itself proves nothing about the current code.
    # Both sides are compared as days: a control changed and proven on the same
    # day counts as proven.
    if [[ -n "$_control_file" && -n "$_proven" && "$_proven" != "never" ]]; then
      _proven_day=$(printf '%s' "$_proven" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)
      [[ -z "$_proven_day" ]] && _proven_day=$(date -d "$_proven" +%Y-%m-%d 2>/dev/null || true)
      _changed_day=$(_ctl_changed_on "$_control_file")
      if [[ -n "$_proven_day" && -n "$_changed_day" && "$_changed_day" > "$_proven_day" ]]; then
        PHASE_I_FINDINGS="${PHASE_I_FINDINGS}- [ ] Control \`${_name}\` was last proven to fire on ${_proven_day}, but \`${_control}\` has been modified since (last change ${_changed_day}). Re-run its proving-it-fires test.\n"
      fi
    fi
    if [[ "$_proven" == "never" || -z "$_proven" ]]; then
      PHASE_I_FINDINGS="${PHASE_I_FINDINGS}- [ ] Control \`${_name}\` has never been proven to fire. A control that has only been proven to ALLOW good input cannot be distinguished from an absent one.\n"
    fi
  done <<< "$_registry_rows"
fi
if [[ -n "$PHASE_I_FINDINGS" ]]; then
  TOTAL_FINDINGS=$(( TOTAL_FINDINGS + 1 ))
  rbuf "## I) Control registry reconciliation"
  rbuf ""
  rbuf "A registered enforcing control looks wired but may not be. Verify each against its trigger, then update \`quality/control-registry.md\`."
  rbuf ""
  while IFS= read -r _l; do [[ -n "$_l" ]] && rbuf "$_l"; done <<< "$(printf '%b' "$PHASE_I_FINDINGS")"
  rbuf ""
fi

# ── Phase J: milestone requirement-source drift (advisory) ─────────────────────
#
# FF-034. A milestone was planned against an external findings document holding
# 28 rows. The document later grew to 50. Every gate stayed green, because every
# gate checks the plan against the CODE and none checks the plan against its
# SOURCE. The 22 new rows were invisible until a human re-read the file.
#
# A capsule that cites an external source records its state at plan time as:
#   Source fingerprint: <path> · <item count> · <date>
# This phase re-counts and flags a mismatch. Advisory: a grown source is normal
# and usually means a new milestone, not a broken one.
PHASE_J_FINDINGS=""
if [[ -d "$AI_DOCS_DIR/milestones" ]]; then
  while IFS= read -r _capsule; do
    _fp=$(grep -m1 '^Source fingerprint:' "$_capsule" 2>/dev/null || true)
    [[ -z "$_fp" ]] && continue
    _src=$(printf '%s' "$_fp" | awk -F'·' '{gsub(/^.*Source fingerprint:[[:space:]]*/,"",$1); gsub(/^ +| +$/,"",$1); gsub(/`/,"",$1); print $1}')
    _cnt=$(printf '%s' "$_fp" | awk -F'·' '{gsub(/[^0-9]/,"",$2); print $2}')
    [[ -z "$_src" || -z "$_cnt" ]] && continue
    if [[ ! -f "$PROJECT_DIR/$_src" ]]; then
      PHASE_J_FINDINGS="${PHASE_J_FINDINGS}- [ ] \`$(basename "$(dirname "$_capsule")")\` cites \`${_src}\` as its requirement source, which no longer exists.\n"
      continue
    fi
    _now=$(grep -cE '^[[:space:]]*[0-9]+\.' "$PROJECT_DIR/$_src" 2>/dev/null || printf '0')
    if [[ "$_now" != "$_cnt" ]]; then
      PHASE_J_FINDINGS="${PHASE_J_FINDINGS}- [ ] \`$(basename "$(dirname "$_capsule")")\` was planned against \`${_src}\` at ${_cnt} items. It now has ${_now}. Reconcile the difference into scope before closing the milestone: new items are invisible to every other gate.\n"
    fi
  done < <(find "$AI_DOCS_DIR/milestones" -name 'capsule.md' 2>/dev/null)
fi
if [[ -n "$PHASE_J_FINDINGS" ]]; then
  TOTAL_FINDINGS=$(( TOTAL_FINDINGS + 1 ))
  rbuf "## J) Milestone requirement-source drift"
  rbuf ""
  rbuf "A milestone's cited requirement source has moved since the plan was cut."
  rbuf ""
  while IFS= read -r _l; do [[ -n "$_l" ]] && rbuf "$_l"; done <<< "$(printf '%b' "$PHASE_J_FINDINGS")"
  rbuf ""
fi

# ── Write the report ───────────────────────────────────────────────────────────
#
# D-056: a zero-finding run used to DELETE the report, which made "scanned, all
# clean" byte-identical to "never ran". Every consumer (Gate 4D, Gate 5, /ship,
# /build) then read an absent file as a pass. A clean run now writes a report
# that says so, and names the roots it scanned, so the verdict carries positive
# evidence that the scan happened. A control whose silence means two different
# things is not a control.
if (( TOTAL_FINDINGS == 0 )); then
  {
    printf '# Drift Report\n\n'
    printf 'Generated: %s  \n' "$(date -u +'%Y-%m-%d %H:%M UTC')"
    printf 'Scanned roots: %s  \n' "${SCAN_ROOTS[*]}"
    printf 'Contract: %s | Spec: %s\n\n' "$CONTRACT_FILE" "$SPEC_FILE"
    printf '## No drift found\n\n'
    printf 'All phases ran and reported zero findings.\n\n'
    printf 'This file is the POSITIVE record that the scan executed. Its absence\n'
    printf 'means the scan did NOT run, and must never be read as a clean verdict.\n\n'
    printf -- '---\n\n'
    printf 'Total findings: **0**. Next scan: in 24h.\n'
  } > "$REPORT_FILE" 2>/dev/null || true
else
  rbuf "---"
  rbuf ""
  rbuf "Total findings: **$TOTAL_FINDINGS**. Next scan: in 24h."
  printf '%s' "$REPORT_BUF" > "$REPORT_FILE" 2>/dev/null || true
fi

# Stamp the run.
printf '%s' "$NOW_EPOCH" > "$LAST_RUN_FILE" 2>/dev/null || true

# Telemetry.
LOG_EVENT="$(dirname "$0")/log-event.sh"
if [[ -f "$LOG_EVENT" ]]; then
  bash "$LOG_EVENT" "\"event\":\"hook.drift_scan\",\"findings\":$TOTAL_FINDINGS" 2>/dev/null || true
fi

exit 0
