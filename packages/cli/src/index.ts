#!/usr/bin/env node

import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import updateNotifier from "update-notifier";
import { submit } from "./commands/submit.js";
import { status } from "./commands/status.js";
import {
  printAnimatedHeader,
  printAnimatedWelcomeBox,
  colors,
  getLevelInfo,
  dotAnimation,
  VERSION,
} from "./lib/ui.js";
import { getConfig, isAuthenticated, resetConfig } from "./lib/config.js";
import { getStatus } from "./lib/api.js";

// Check for updates
const pkg = { name: "ccgather", version: VERSION };
const notifier = updateNotifier({ pkg, updateCheckInterval: 1000 * 60 * 60 });

notifier.notify({
  message:
    `${chalk.yellow("Update")} available ${chalk.dim(VERSION)} → ${chalk.yellow(notifier.update?.latest || "")}\n` +
    `${chalk.yellow("Run")} ${chalk.cyan("npx ccgather@latest")} to update`,
  boxenOptions: {
    padding: 1,
    margin: 1,
    borderStyle: "round",
    borderColor: "yellow",
  },
});

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
      console.log();
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
      }
    } catch {
      // Silently fail, continue without welcome box
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
        { name: `📤  ${chalk.white("Submit usage data")}`, value: "submit" },
        { name: `📊  ${chalk.white("View my rank")}`, value: "rank" },
        { name: `⚙️   ${chalk.white("Settings")}`, value: "settings" },
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
    case "rank":
      await dotAnimation("Fetching stats", 400);
      await status({});
      break;
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
        { name: `🔐  ${chalk.white("Re-authenticate")}`, value: "auth" },
        { name: `🗑️   ${chalk.white("Disconnect from CCgather")}`, value: "disconnect" },
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
    case "disconnect": {
      await handleDisconnect();
      break;
    }
    case "back":
      await showMenuOnly();
      break;
  }
}

// Disconnect handler with double confirmation
async function handleDisconnect(): Promise<void> {
  const { confirmFirst } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirmFirst",
      message: chalk.yellow("Are you sure you want to disconnect from CCgather?"),
      default: false,
    },
  ]);

  if (!confirmFirst) {
    console.log(colors.dim("\n  Cancelled.\n"));
    await showSettingsMenu();
    return;
  }

  const { confirmSecond } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirmSecond",
      message: chalk.red("This will remove all local settings. Are you really sure?"),
      default: false,
    },
  ]);

  if (!confirmSecond) {
    console.log(colors.dim("\n  Cancelled.\n"));
    await showSettingsMenu();
    return;
  }

  // Reset only CCgather config (no Claude Code files touched)
  resetConfig();

  console.log();
  console.log(colors.success("  ✓ Disconnected from CCgather"));
  console.log(colors.dim("  Your CCgather settings have been removed."));
  console.log(colors.dim("  Run npx ccgather to set up again.\n"));
}

// Default action - show main menu
program.action(async () => {
  await showMainMenu();
});

program.parse();
