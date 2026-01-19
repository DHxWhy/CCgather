#!/usr/bin/env node

import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import { submit } from "./commands/submit.js";
import {
  printAnimatedHeader,
  printAnimatedWelcomeBox,
  colors,
  getLevelInfo,
  dotAnimation,
  VERSION,
} from "./lib/ui.js";
import { getConfig, isAuthenticated } from "./lib/config.js";
import { getStatus } from "./lib/api.js";

const program = new Command();

program
  .name("ccgather")
  .description("Submit your Claude Code usage to the CCgather leaderboard")
  .version(VERSION);

// Main interactive menu (with full header animation)
async function showMainMenu(): Promise<void> {
  // Animated logo display
  await printAnimatedHeader();

  // Check authentication - if not authenticated, start auth flow
  if (!isAuthenticated()) {
    console.log(colors.warning("\n  🔐 Authentication required\n"));
    console.log(colors.dim("  To submit your Claude Code usage, you need to log in first.\n"));

    const { startAuth } = await inquirer.prompt([
      {
        type: "confirm",
        name: "startAuth",
        message: "Would you like to authenticate now?",
        default: true,
      },
    ]);

    if (startAuth) {
      const { auth } = await import("./commands/auth.js");
      await auth({});
    } else {
      console.log(colors.dim("\n  Goodbye!\n"));
      process.exit(0);
    }
  }

  // Show welcome box if authenticated
  if (isAuthenticated()) {
    try {
      // Show loading animation while fetching user data
      const statusPromise = getStatus();
      await dotAnimation("Loading profile", 1000, "fast");

      const result = await statusPromise;
      if (result.success && result.data) {
        const stats = result.data;
        const levelInfo = getLevelInfo(stats.totalTokens);

        // Animated welcome box
        await printAnimatedWelcomeBox({
          username: getConfig().get("username") || "User",
          level: levelInfo.level,
          levelName: levelInfo.name,
          levelIcon: levelInfo.icon,
          globalRank: stats.rank,
          countryRank: stats.countryRank || undefined,
          countryCode: stats.countryCode || undefined,
          ccplan: stats.tier,
        });
        console.log();
      } else if (!result.success) {
        // Token invalid or user not found - clear local auth
        const config = getConfig();
        config.delete("apiToken");
        config.delete("userId");
        config.delete("username");

        console.log(colors.warning("\n  🔐 Session expired. Please log in again.\n"));

        const { startAuth } = await inquirer.prompt([
          {
            type: "confirm",
            name: "startAuth",
            message: "Would you like to authenticate now?",
            default: true,
          },
        ]);

        if (startAuth) {
          const { auth } = await import("./commands/auth.js");
          await auth({});
        } else {
          console.log(colors.dim("\n  Goodbye!\n"));
          process.exit(0);
        }
      }
    } catch {
      // Network error - continue without welcome box
    }
  }

  // Show menu
  await showMenuOnly();
}

// Show menu only (without header animation)
async function showMenuOnly(): Promise<void> {
  // Main menu - 3 options only
  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "What would you like to do?",
      choices: [
        { name: `📤  ${colors.white("Submit usage data")}`, value: "submit" },
        { name: `🌐  ${colors.white("Open leaderboard")}`, value: "leaderboard" },
        { name: `⚙️   ${colors.white("Settings")}`, value: "settings" },
      ],
      loop: false,
    },
  ]);

  console.log();

  switch (action) {
    case "submit":
      await dotAnimation("Preparing", 400);
      await submit({});
      break;
    case "leaderboard": {
      const cfg = getConfig();
      const username = cfg.get("username") as string | undefined;
      const leaderboardUrl = username
        ? `https://ccgather.com/leaderboard?u=${username}`
        : "https://ccgather.com/leaderboard";
      console.log(colors.dim(`  Opening ${leaderboardUrl}...\n`));
      const open = (await import("open")).default;
      await open(leaderboardUrl);
      break;
    }
    case "settings":
      await showSettingsMenu();
      break;
  }
}

// Settings submenu
async function showSettingsMenu(): Promise<void> {
  const { settingsAction } = await inquirer.prompt([
    {
      type: "list",
      name: "settingsAction",
      message: "Settings:",
      choices: [
        {
          name: `🔐  ${colors.white("Re-authenticate")}  ${colors.dim("– switch account or fix login issues")}`,
          value: "auth",
        },
        { name: `⬅️   ${chalk.gray("Back")}`, value: "back" },
      ],
      loop: false,
    },
  ]);

  switch (settingsAction) {
    case "auth": {
      const { auth } = await import("./commands/auth.js");
      await auth({});
      break;
    }
    case "back":
      await showMenuOnly();
      break;
  }
}

// Default action - show main menu
program.action(async () => {
  await showMainMenu();
});

program.parse();
