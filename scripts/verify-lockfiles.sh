#!/bin/bash

# Lockfile Synchronization Verification Script
#
# Ensures that when package.json changes, the correct lockfile is updated.
# This prevents the exact issue that caused the Vercel build failure.

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if package.json is being committed
if git diff --cached --name-only | grep -q "package.json"; then
    echo -e "${YELLOW}📦 package.json changes detected${NC}"

    # Get the actual dependency changes
    DEPS_CHANGED=$(git diff --cached package.json | grep -E '^\+\s+"(@[^"]+|[a-z0-9@/-]+)":\s*"\^' || true)

    if [ -n "$DEPS_CHANGED" ]; then
        # Check if pnpm-lock.yaml is also staged
        if ! git diff --cached --name-only | grep -q "pnpm-lock.yaml"; then
            echo -e "${RED}❌ ERROR: Dependencies modified but pnpm-lock.yaml not updated!${NC}"
            echo ""
            echo "   Please run: pnpm install"
            echo "   Then stage: git add pnpm-lock.yaml"
            echo ""
            exit 1
        fi
        echo -e "${GREEN}✅ Both package.json and pnpm-lock.yaml are being committed${NC}"
    else
        echo -e "${GREEN}✅ Non-dependency changes to package.json (metadata only)${NC}"
    fi
fi

# Warn if wrong lockfile is being committed
if git diff --cached --name-only | grep -q "package-lock.json"; then
    echo -e "${YELLOW}⚠️  WARNING: package-lock.json detected!${NC}"
    echo "   This project uses pnpm. Consider removing package-lock.json"
fi

if git diff --cached --name-only | grep -q "yarn.lock"; then
    echo -e "${YELLOW}⚠️  WARNING: yarn.lock detected!${NC}"
    echo "   This project uses pnpm. Consider removing yarn.lock"
fi

exit 0
