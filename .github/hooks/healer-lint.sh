#!/bin/bash
# Healer Linting Hook
# Runs oxfmt and oxlint with auto-fix on both warehouse projects before healer applies fixes
# Reports results back to the agent

set -e

REPO_ROOT="/Users/ulf/Documents/GitHub/west"
PROJECTS=("warehouse-backend" "warehouse-frontend")

echo "🔍 [HEALER-LINT] Starting auto-fix workflow for code quality..."
echo ""

for PROJECT in "${PROJECTS[@]}"; do
  PROJECT_PATH="$REPO_ROOT/$PROJECT"
  
  if [ ! -d "$PROJECT_PATH" ]; then
    echo "⚠️  [HEALER-LINT] $PROJECT not found at $PROJECT_PATH, skipping"
    continue
  fi
  
  echo "📁 [HEALER-LINT] Processing $PROJECT..."
  
  cd "$PROJECT_PATH"
  
  # Run tsgo type checking with --noEmit --incremental
  echo "  🔍 Running tsgo (type checking with incremental)..."
  if npm run type-check &> /dev/null 2>&1; then
    echo "  ✅ tsgo: Type checking passed"
  else
    echo "  ⚠️  tsgo: Type checking found issues (non-blocking, healer will handle)"
  fi
  
  # Run oxfmt
  echo "  📝 Running oxfmt..."
  if npx oxfmt --write . 2>&1; then
    echo "  ✅ oxfmt: Fixed formatting"
  else
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 127 ]; then
      echo "  ⏭️  oxfmt: Not available (native binding issue - try: npm install again)"
    else
      echo "  ⚠️  oxfmt: No changes needed or warnings (non-blocking)"
    fi
  fi
  
  # Run oxlint with type-aware checks and auto-fix
  echo "  🔗 Running oxlint (type-aware with auto-fix)..."
  if npx oxlint --fix . 2>&1; then
    echo "  ✅ oxlint: Fixed linting issues"
  else
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 127 ]; then
      echo "  ⏭️  oxlint: Not available (native binding issue - try: npm install again)"
    else
      echo "  ⚠️  oxlint: Some issues remain (non-blocking, healer will handle)"
    fi
  fi
  
  cd "$REPO_ROOT"
  echo ""
done

echo "✨ [HEALER-LINT] Auto-fix workflow complete"
echo "📋 [HEALER-LINT] Ready for healer to apply substantive fixes"
exit 0
