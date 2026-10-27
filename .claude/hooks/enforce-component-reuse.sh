#!/usr/bin/env bash
# hooks/enforce-component-reuse.sh: Block forking a UI component that already exists.
#
# The reuse-first rule (rules/component-reuse-rules.md) is enforced inside /build,
# but this PreToolUse backstop catches the concrete fork signal the skill can miss:
# creating a NEW component file whose role already exists as a same-named component
# file somewhere else in the project (a second Button.tsx in a different folder).
# Editing an existing component, or creating the first one of its name, is allowed.
#
# Escape: ADF_ALLOW_DUP_COMPONENT=on (for a genuinely intended distinct component;
# the user must opt in for the session).
#
# Runs on: PreToolUse for Write | Edit | MultiEdit.
# Exit codes: 0 (allow) or 2 (block). Nothing else. No `set -e`. No jq required.

set -uo pipefail

AI_DOCS_DIR="${AI_DOCS:-AI_DOCS}"

# Explicit opt-out for the session.
if [[ "${ADF_ALLOW_DUP_COMPONENT:-off}" == "on" ]]; then exit 0; fi

INPUT=$(cat 2>/dev/null || echo "")
[[ -z "$INPUT" ]] && exit 0

FILE=$(printf '%s' "$INPUT" | bash "$(dirname "$0")/json-field.sh" file_path 2>/dev/null)
[[ -z "$FILE" ]] && exit 0

FILE_NORM=$(printf '%s' "$FILE" | tr '\\' '/' | tr -s '/')

# Only consider component files: under a components dir, PascalCase basename,
# a UI component extension. This keeps the gate narrow (low false positives).
case "$FILE_NORM" in
  *"/components/"*) : ;;
  *) exit 0 ;;
esac

BASE="${FILE_NORM##*/}"                       # e.g. Button.tsx
case "$BASE" in
  [A-Z]*.tsx|[A-Z]*.jsx|[A-Z]*.vue|[A-Z]*.dart) : ;;
  *) exit 0 ;;                                  # not a PascalCase component file
esac

# Platform-variant files (Button.ios.tsx, Card.native.tsx) are legitimate: the
# infix makes the basename distinct, so they won't collide below. Nothing to do.

# If the target already exists on disk, this is an EDIT, not a new component → allow.
[[ -e "$FILE" || -e "$FILE_NORM" ]] && exit 0

NAME="${BASE%.*}"                              # Button
EXT="${BASE##*.}"                              # tsx

# Resolve repo root by walking up to the folder containing AI_DOCS/ (else cwd).
ROOT="."
if [[ "$FILE_NORM" == */* ]]; then
  DIR="${FILE_NORM%/*}"; HOPS=0
  while [[ -n "$DIR" && "$DIR" != "." && "$DIR" != "/" && $HOPS -lt 25 ]]; do
    if [[ -d "$DIR/$AI_DOCS_DIR" ]]; then ROOT="$DIR"; break; fi
    PARENT="${DIR%/*}"; [[ "$PARENT" == "$DIR" ]] && break; DIR="$PARENT"; HOPS=$((HOPS + 1))
  done
fi

# Look for an existing component file of the same basename at a DIFFERENT path.
# AI_DOCS is pruned: prototypes and draft screens kept there (design/flows,
# design/draft-screens) are not application components and must not block the
# real one from being created.
EXISTING=$(find "$ROOT" \
  \( -name node_modules -o -name .git -o -name .claude -o -name "$AI_DOCS_DIR" -o -name dist -o -name build -o -name .next -o -name .venv -o -name __pycache__ \) -prune \
  -o -type f -name "$NAME.$EXT" -print 2>/dev/null | head -5)

if [[ -n "$EXISTING" ]]; then
  cat <<EOF >&2

========================================
  ADF COMPONENT-REUSE BLOCK
========================================
New component: $FILE
A component named "$NAME" already exists:
$EXISTING

The reuse-first rule (component-reuse-rules.md) forbids forking. Either:
  1. Reuse / extend the existing "$NAME" (add optional props), or
  2. If this is genuinely a different component, give it a distinct role name
     and register it in AI_DOCS/design/component-registry.md, or
  3. If a duplicate is truly intended, the user opts in for the session:
       export ADF_ALLOW_DUP_COMPONENT=on   (then retry)

From hooks/enforce-component-reuse.sh.
========================================
EOF
  exit 2
fi

# Track H (shell fidelity): once the app-shell is LOCKED, block re-implementing a
# locked chrome ROLE under a different name outside the locked layout dir (e.g. a
# NavBar/Sidebar/DataGrid when TopNav/SideNav/DataTable are the locked components).
# The locked shell itself (src/components/layout/**) is guarded by enforce-shell-lock.sh.
GATE_STATUS="$ROOT/$AI_DOCS_DIR/memory/gate-status.md"
# Same read as enforce-shell-lock.sh v4: the App-shell row's own status cell
# decides, and LIFTED wins. When no such row exists, a RECORDED "SHELL LOCKED"
# marker line still counts (the shape /do appends), but a sentence that only
# mentions the marker does not (hooks/gate-status-read.sh).
SHELL_ARMED=0
if [[ -f "$GATE_STATUS" ]]; then
  SHELL_ROW=$(grep -i '^[[:space:]]*|[[:space:]]*App-shell lock[[:space:]]*|' "$GATE_STATUS" 2>/dev/null | head -1)
  if [[ -n "$SHELL_ROW" ]]; then
    SHELL_STATUS=$(printf '%s' "$SHELL_ROW" | awk -F'|' '{print $4}' | tr '[:upper:]' '[:lower:]')
    case "$SHELL_STATUS" in
      *lifted*|*unlocked*) ;;
      *locked*) SHELL_ARMED=1 ;;
    esac
  elif bash "$(dirname "$0")/gate-status-read.sh" marker "$GATE_STATUS" "SHELL LOCKED" >/dev/null 2>&1; then
    SHELL_ARMED=1
  fi
fi
if (( SHELL_ARMED == 1 )); then
  case "$FILE_NORM" in
    */components/layout/*) : ;;
    *)
      NAME_LC=$(printf '%s' "$NAME" | tr '[:upper:]' '[:lower:]')
      case "$NAME_LC" in
        *navbar*|*topnav*|*topbar*|*sidenav*|*sidebar*|*drawer*|*appshell*|*datagrid*|*datatable*|*paginat*)
          cat <<EOF >&2

========================================
  ADF SHELL-FIDELITY BLOCK
========================================
New chrome component: $FILE
The app-shell is LOCKED. "$NAME" re-implements a chrome role the locked shell
already provides (TopNav / SideNav / AppShell / DataTable / Pagination).

Compose the screen from the locked shell instead of building new chrome. If the
shell genuinely lacks this, evolve it via /change-request (then it re-locks), or
opt in for the session: export ADF_ALLOW_DUP_COMPONENT=on

From hooks/enforce-component-reuse.sh (Track H).
========================================
EOF
          exit 2 ;;
      esac
      ;;
  esac
fi

exit 0
