#!/bin/bash

# Env Example Completeness Hook
# Stop hook that verifies .env.example contains all required env vars.
# Prevents: E-04 (missing env vars → runtime failures)
#
# Checks TWO sources (both required):
# 1. PROJECT_KNOWLEDGE.md env vars section — planned infrastructure (S3, mail, OAuth, etc.)
# 2. process.env.KEY and configService.get('KEY') in backend code — implemented vars

CLAUDE_PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
HOOK_INPUT=$(cat)
BACKEND_DIR="$CLAUDE_PROJECT_DIR/backend"

# Only run if backend directory exists
[ -d "$BACKEND_DIR/src" ] || exit 0

# Extract tool name and file paths from hook input
TOOL_NAME=$(echo "$HOOK_INPUT" | jq -r '.tool_name // ""')
TOOL_INPUT=$(echo "$HOOK_INPUT" | jq -r '.tool_input // {}')

# Only process file modification tools
case "$TOOL_NAME" in
    Write|Edit|MultiEdit)
        ;;
    *)
        exit 0
        ;;
esac

# Extract file paths
if [ "$TOOL_NAME" = "MultiEdit" ]; then
    FILE_PATHS=$(echo "$TOOL_INPUT" | jq -r '.edits[].file_path // empty')
else
    FILE_PATHS=$(echo "$TOOL_INPUT" | jq -r '.file_path // empty')
fi

# Only check if backend files were modified
BACKEND_MODIFIED=false
echo "$FILE_PATHS" | while read -r file_path; do
    if echo "$file_path" | grep -q "backend/src/"; then
        BACKEND_MODIFIED=true
        break
    fi
done

# Also check if .env.example itself was modified
echo "$FILE_PATHS" | grep -q "backend/.env.example" && exit 0

# Check if .env.example exists
if [ ! -f "$BACKEND_DIR/.env.example" ]; then
    echo "⚠️  backend/.env.example does not exist!" >&2
    echo "   Create it with all environment variables used in backend/src/" >&2
    exit 1
fi

# Source 1: Extract env var names from PROJECT_KNOWLEDGE.md
# Looks for lines matching `| `VAR_NAME` |` pattern in the env vars table
PROJECT_KNOWLEDGE="$CLAUDE_PROJECT_DIR/.claude-project/docs/PROJECT_KNOWLEDGE.md"
PKG_KEYS=""
if [ -f "$PROJECT_KNOWLEDGE" ]; then
    PKG_KEYS=$(grep -oE '`[A-Z][A-Z_]+`' "$PROJECT_KNOWLEDGE" | tr -d '`' | \
        grep -E '^[A-Z_]{3,}$' | grep -v '^VITE_' | sort -u)
fi

# Source 2: Extract env var names from process.env.* usage in code
PROCESS_ENV_KEYS=$(grep -roh 'process\.env\.\([A-Z_]*[A-Z]\)' "$BACKEND_DIR/src" --include='*.ts' 2>/dev/null | \
    sed 's/process\.env\.//' | sort -u)

# Source 3: Extract env var names from configService.get('KEY') usage
CONFIG_SERVICE_KEYS=$(grep -roEh "configService\.get(<[^>]*>)?\(['\"]([A-Z_]+)['\"]\)" "$BACKEND_DIR/src" --include='*.ts' 2>/dev/null | \
    grep -oE "'[A-Z_]+'" | tr -d "'" | sort -u)

# Combine all keys from all sources
ALL_KEYS=$(echo -e "$PKG_KEYS\n$PROCESS_ENV_KEYS\n$CONFIG_SERVICE_KEYS" | sort -u | grep -v '^$')

# Check each key against .env.example
MISSING_KEYS=""
MISSING_COUNT=0
for key in $ALL_KEYS; do
    if ! grep -q "^${key}=" "$BACKEND_DIR/.env.example" 2>/dev/null && \
       ! grep -q "^#.*${key}" "$BACKEND_DIR/.env.example" 2>/dev/null; then
        MISSING_KEYS="$MISSING_KEYS $key"
        MISSING_COUNT=$((MISSING_COUNT + 1))
    fi
done

if [ "$MISSING_COUNT" -gt 0 ]; then
    {
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "⚠️  .env.example missing $MISSING_COUNT env var(s):$MISSING_KEYS"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "👉 Add these to backend/.env.example with appropriate defaults"
        echo ""
    } >&2
    exit 1
fi

exit 0
