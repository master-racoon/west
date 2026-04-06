#!/usr/bin/env bash
# context-check.sh — Validate AI context files against actual codebase
# Run: make context-check (or ./context-check.sh from repo root)

set -euo pipefail

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

error()   { echo -e "${RED}✗ ERROR:${NC} $1"; ((ERRORS++)); }
warn()    { echo -e "${YELLOW}⚠ WARN:${NC} $1"; }
ok()      { echo -e "${GREEN}✓${NC} $1"; }
section() { echo -e "\n━━━ $1 ━━━"; }

# ─── 1. Check Key Files from copilot-instructions.md exist ───

section "Key Files existence check"

KEY_PATHS=(
  "warehouse-backend/src/app.ts"
  "warehouse-backend/src/db/schema.ts"
  "warehouse-backend/src/authorization/middleware.ts"
  "warehouse-backend/src/utils/errors.ts"
  "warehouse-backend/src/routes"
  "warehouse-backend/src/tests/helpers.ts"
  "warehouse-frontend/src/lib/api.ts"
  "warehouse-frontend/src/hooks/queries"
  "Makefile"
  ".github/copilot-instructions.md"
)

for path in "${KEY_PATHS[@]}"; do
  if [[ -e "$path" ]]; then
    ok "$path"
  else
    error "Missing: $path (referenced in copilot-instructions.md Key Files table)"
  fi
done

# ─── 2. Backend routes: actual vs documented ───

section "Backend routes coverage"

if [[ -d "warehouse-backend/src/routes" ]]; then
  ACTUAL_ROUTES=$(ls warehouse-backend/src/routes/*.ts 2>/dev/null | xargs -I{} basename {} .ts | sort || true)
  ACTUAL_COUNT=$(echo "$ACTUAL_ROUTES" | grep -c . || echo "0")
  echo "  Current routes: $ACTUAL_COUNT files"
  if [[ -n "$ACTUAL_ROUTES" ]]; then
    echo "  Files: $(echo $ACTUAL_ROUTES | tr '\n' ' ')"
  else
    warn "No route files found yet (expected after initial development)"
  fi
else
  warn "warehouse-backend/src/routes directory not yet created"
fi

# ─── 3. Context files freshness ───

section "Context file freshness (>60 days = warning)"

STALE_DAYS=60
NOW=$(date +%s)

check_freshness() {
  local file="$1"
  if [[ -f "$file" ]]; then
    local mod_time
    mod_time=$(stat -f %m "$file" 2>/dev/null || stat -c %Y "$file" 2>/dev/null)
    local age_days=$(( (NOW - mod_time) / 86400 ))
    if (( age_days > STALE_DAYS )); then
      warn "$file — last modified $age_days days ago"
      ((WARNINGS++))
    fi
  fi
}

# Check main context files
check_freshness ".github/copilot-instructions.md"

if (( WARNINGS == 0 )); then
  ok "All context files are fresh (< $STALE_DAYS days)"
fi

# ─── 4. Cross-reference checks ───

section "Cross-reference checks"

# No additional cross-reference checks needed — copilot-instructions.md is the single source of truth

# ─── Summary ───

section "Summary"
echo "  Errors:   $ERRORS"
echo "  Warnings: $WARNINGS"

if (( ERRORS > 0 )); then
  echo -e "\n${RED}Context integrity check failed.${NC}"
  exit 1
elif (( WARNINGS > 0 )); then
  echo -e "\n${YELLOW}Context check passed with warnings.${NC}"
  exit 0
else
  echo -e "\n${GREEN}All context checks passed!${NC}"
  exit 0
fi
