#!/usr/bin/env node

/**
 * Package Manager Verification Script
 *
 * Prevents accidental usage of npm/yarn when pnpm is the project standard.
 * This script runs automatically before package installations via preinstall hook.
 */

const { execSync } = require("child_process");

const ALLOWED_PACKAGE_MANAGER = "pnpm";

function getCurrentPackageManager() {
  const userAgent = process.env.npm_config_user_agent;

  if (!userAgent) {
    return "unknown";
  }

  if (userAgent.includes("pnpm")) return "pnpm";
  if (userAgent.includes("yarn")) return "yarn";
  if (userAgent.includes("npm")) return "npm";

  return "unknown";
}

function main() {
  const currentPM = getCurrentPackageManager();

  // Skip verification in CI environments or when running npm lifecycle scripts
  if (process.env.CI || process.env.VERCEL) {
    console.log("📦 CI environment detected, skipping package manager verification");
    return;
  }

  if (currentPM !== ALLOWED_PACKAGE_MANAGER) {
    console.error("");
    console.error("❌ ERROR: Wrong package manager detected!");
    console.error("");
    console.error(`   This project uses ${ALLOWED_PACKAGE_MANAGER}, but you're using ${currentPM}`);
    console.error("");
    console.error("   Please use:");
    console.error(`   $ ${ALLOWED_PACKAGE_MANAGER} install`);
    console.error("");
    process.exit(1);
  }

  console.log(`✅ Using correct package manager: ${ALLOWED_PACKAGE_MANAGER}`);
}

main();
