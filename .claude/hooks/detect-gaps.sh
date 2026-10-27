#!/usr/bin/env bash
# Shell safety: no `set -e` — a missing directory or a failing detection probe
# must not abort the whole gap scan. No `set -u` either, deliberately: the
# HAS_* flags are all assigned before use, but GAPS is a bash array read via
# "${GAPS[@]}" (and sized via ${#GAPS[@]}) when it may still be empty. Under
# `set -u`, expanding an empty array that way throws "unbound variable" on
# bash < 4.4 (a documented bash bug, fixed in 4.4/2016), and this hook has to
# run correctly on whatever bash ships with a given machine's Git Bash/WSL
# install, which isn't guaranteed to be >= 4.4. Comment-only until that's
# verified across every environment this hook runs in.

# ADF Gap Detection Hook — runs on SessionStart
# Scans the project for missing docs relative to code maturity
# Suggests the correct skill to fill each gap

GAPS=()
HAS_SRC=false
HAS_CODE=false
HAS_NEXTJS=false

# Detect Next.js project
if [ -f "next.config.js" ] || [ -f "next.config.ts" ] || [ -f "next.config.mjs" ] || [ -f "next.config.cjs" ]; then
  HAS_NEXTJS=true
fi

# Detect code presence
if [ -d src ] || [ -d app ] || [ -d lib ] || [ -d pages ] || [ -d components ]; then
  HAS_SRC=true
fi
if find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.py" 2>/dev/null | grep -v node_modules | grep -v ".claude" | grep -q .; then
  HAS_CODE=true
fi

# Detect AI_DOCS presence
HAS_SPECS=false
HAS_GATE=false
HAS_MILESTONE=false
HAS_ARCH=false
HAS_TASK=false

[ -f AI_DOCS/memory/task-ledger.md ] && HAS_TASK=true
[ -f AI_DOCS/memory/gate-status.md ] && HAS_GATE=true
[ -d AI_DOCS/planning/spec ] && [ "$(ls AI_DOCS/planning/spec 2>/dev/null | wc -l)" -gt 0 ] && HAS_SPECS=true
[ -d AI_DOCS/architecture ] && [ "$(ls AI_DOCS/architecture 2>/dev/null | wc -l)" -gt 0 ] && HAS_ARCH=true
[ -d AI_DOCS/milestones ] && [ "$(ls AI_DOCS/milestones 2>/dev/null | wc -l)" -gt 0 ] && HAS_MILESTONE=true

# --- Gap checks ---

# Empty project
if [ "$HAS_CODE" = false ] && [ "$HAS_SPECS" = false ]; then
  GAPS+=("FRESH PROJECT: No code or specs found → run /session-management to initialize")
fi

# Code exists but no spec
if [ "$HAS_CODE" = true ] && [ "$HAS_SPECS" = false ]; then
  GAPS+=("NO TECH-SPEC: Code exists but no AI_DOCS/planning/spec/ → run /tech-specification")
fi

# Code exists but no architecture doc
if [ "$HAS_CODE" = true ] && [ "$HAS_ARCH" = false ]; then
  GAPS+=("NO ARCHITECTURE: Code exists but no AI_DOCS/architecture/ → run /architecture")
fi

# Code exists but no gate tracking
if [ "$HAS_CODE" = true ] && [ "$HAS_GATE" = false ]; then
  GAPS+=("NO GATE TRACKING: No gate-status.md found → run /gate-enforcement to initialize")
fi

# Specs exist but no milestone
if [ "$HAS_SPECS" = true ] && [ "$HAS_MILESTONE" = false ]; then
  GAPS+=("NO MILESTONES: Specs exist but no milestone plan → run /milestone-planning")
fi

# Check for package.json without testing setup
if [ -f package.json ]; then
  if ! grep -q '"test"' package.json 2>/dev/null && ! [ -d __tests__ ] && ! [ -d tests ] && ! [ -d test ]; then
    GAPS+=("NO TESTS: package.json found but no test setup → run /qa-testing or /webapp-testing")
  fi
fi

# Check for Python project without tests
if find . -name "*.py" 2>/dev/null | grep -v node_modules | grep -v ".claude" | grep -q .; then
  if ! [ -d tests ] && ! find . -name "test_*.py" 2>/dev/null | grep -q .; then
    GAPS+=("NO PYTHON TESTS: Python code found but no test files → run /python-testing")
  fi
fi

# Check for deployment without CI
if [ -f package.json ] || find . -name "*.py" 2>/dev/null | grep -q .; then
  if ! [ -f .github/workflows/ci.yml ] && ! [ -f .github/workflows/deploy.yml ]; then
    GAPS+=("NO CI/CD: No GitHub Actions workflow found, run /deployment-planning")
  fi
fi

# --- Next.js-specific gap checks ---

if [ "$HAS_NEXTJS" = true ]; then
  # App Router: missing error boundaries
  if [ -d "app" ]; then
    if [ ! -f "app/error.tsx" ] && [ ! -f "app/error.jsx" ]; then
      GAPS+=("NEXT.JS: No app/error.tsx — missing root error boundary → run /nextjs for guidance")
    fi
    if [ ! -f "app/global-error.tsx" ] && [ ! -f "app/global-error.jsx" ]; then
      GAPS+=("NEXT.JS: No app/global-error.tsx — missing global error boundary")
    fi
    if [ ! -f "app/not-found.tsx" ] && [ ! -f "app/not-found.jsx" ]; then
      GAPS+=("NEXT.JS: No app/not-found.tsx — missing custom 404 page")
    fi
  fi

  # Missing nextjs-rules reference
  if ! grep -r "nextjs-rules" .claude/rules/ > /dev/null 2>&1; then
    : # rule file exists — no gap
  fi

  # Remind about the specialist
  if [ "$HAS_CODE" = true ]; then
    echo ""
    echo "  Next.js project detected — nextjs-specialist agent and /nextjs skill available"
  fi
fi

# Report
if [ ${#GAPS[@]} -gt 0 ]; then
  echo ""
  echo "=== ADF Gap Detection ==="
  for gap in "${GAPS[@]}"; do
    echo "  ⚠  $gap"
  done
  echo "========================="
fi

exit 0
