#!/bin/bash

# Lockfile Synchronization Verification Script
#
# Project policy (CLAUDE.md): bun only. npm/pnpm/yarn lockfiles 금지.
# package.json 의존성 변경 시 bun.lock 동기화 강제.

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if package.json is being committed
if git diff --cached --name-only | grep -q "package.json"; then
    echo -e "${YELLOW}📦 package.json changes detected${NC}"

    DEPS_CHANGED=$(git diff --cached package.json | grep -E '^\+\s+"(@[^"]+|[a-z0-9@/-]+)":\s*"\^' || true)

    if [ -n "$DEPS_CHANGED" ]; then
        if ! git diff --cached --name-only | grep -q "^bun.lock$"; then
            echo -e "${RED}❌ ERROR: Dependencies modified but bun.lock not updated!${NC}"
            echo ""
            echo "   Please run: bun install"
            echo "   Then stage: git add bun.lock"
            echo ""
            exit 1
        fi
        echo -e "${GREEN}✅ Both package.json and bun.lock are being committed${NC}"
    else
        echo -e "${GREEN}✅ Non-dependency changes to package.json (metadata only)${NC}"
    fi
fi

# Reject foreign lockfiles
if git diff --cached --name-only | grep -q "package-lock.json"; then
    echo -e "${RED}❌ ERROR: package-lock.json detected — this project uses bun only${NC}"
    exit 1
fi

if git diff --cached --name-only | grep -q "pnpm-lock.yaml"; then
    echo -e "${RED}❌ ERROR: pnpm-lock.yaml detected — this project uses bun only${NC}"
    exit 1
fi

if git diff --cached --name-only | grep -q "yarn.lock"; then
    echo -e "${RED}❌ ERROR: yarn.lock detected — this project uses bun only${NC}"
    exit 1
fi

exit 0
