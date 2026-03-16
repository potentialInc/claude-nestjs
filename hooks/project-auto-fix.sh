#!/bin/bash
# Runs auto-fix commands on all projects when files are changed
# This is a Stop hook that:
# 1. Detects which projects have changed files
# 2. Runs lint (auto-fix) on affected projects
# 3. Runs type-check and triggers auto-error-resolver if errors found

cd "$CLAUDE_PROJECT_DIR/.claude/nestjs/hooks"
cat | npx tsx project-auto-fix.ts
