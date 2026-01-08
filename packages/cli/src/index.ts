#!/usr/bin/env node

import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import updateNotifier from "update-notifier";
import { submit } from "./commands/submit.js";
import { status } from "./commands/status.js";
import { setupAuto } from "./commands/setup-auto.js";
import { scan } from "./commands/scan.js";
import { printHeader, createWelcomeBox, colors, link, getLevelInfo } from "./lib/ui.js";
import { getConfig, isAuthenticated } from "./lib/config.js";
import { getStatus } from "./lib/api.js";

const VERSION = "1.3.3";

// Check for updates
const pkg = { name: "ccgather", version: VERSION };
const notifier = updateNotifier({ pkg, updateCheckInterval: 1000 * 60 * 60 }); // Check every hour

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
  .version(VERSION)
  .option("-y, --yes", "Skip confirmation prompt")
  .option("--auto", "Enable automatic sync on session end")
  .option("--manual", "Disable automatic sync")
  .option("--no-menu", "Skip interactive menu (direct submit)");

// Scan command (generate ccgather.json)
program
  .command("scan")
  .description("Scan Claude Code usage and create ccgather.json")
  .option("-a, --all", "Scan all-time usage (no date limit)")
  .option("-d, --days <number>", "Number of days to scan (default: 30)", parseInt)
  .action((opts) => scan(opts));

// Rank command (view ranking)
program
  .command("rank")
  .description("View your current rank and stats")
  .action(() => status({ json: false }));

// Status command (alias for rank)
program
  .command("status")
  .description("View your current rank and stats")
  .option("--json", "Output as JSON")
  .action((opts) => status(opts));

// Sync command
program
  .command("sync")
  .description("Sync usage data to CCgather")
  .action(async () => {
    const { sync } = await import("./commands/sync.js");
    await sync({});
  });

// Auth command
program
  .command("auth")
  .description("Authenticate with CCgather")
  .action(async () => {
    const { auth } = await import("./commands/auth.js");
    await auth({});
  });

// Reset command
program
  .command("reset")
  .description("Remove auto-sync hook and clear config")
  .action(async () => {
    const { reset } = await import("./commands/reset.js");
    await reset();
  });

// Interactive menu
async function showInteractiveMenu(): Promise<void> {
  // Print header with logo
  printHeader(VERSION);

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
      // After auth, continue to menu
      console.log();
    } else {
      console.log(colors.dim("\n  You can authenticate later by running: npx ccgather auth\n"));
    }
  }

  // Show welcome box if authenticated
  if (isAuthenticated()) {
    try {
      const result = await getStatus();
      if (result.success && result.data) {
        const stats = result.data;
        const levelInfo = getLevelInfo(stats.totalTokens);

        const welcomeBox = createWelcomeBox({
          username: getConfig().get("username") || "User",
          level: levelInfo.level,
          levelName: levelInfo.name,
          levelIcon: levelInfo.icon,
          globalRank: stats.rank,
          ccplan: stats.tier,
        });
        console.log(welcomeBox);
        console.log();
      }
    } catch {
      // Silently fail, continue without welcome box
    }
  }

  // Interactive menu
  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "What would you like to do?",
      choices: [
        { name: `📤  ${chalk.white("Submit usage data")}`, value: "submit" },
        { name: `📊  ${chalk.white("View my stats")}`, value: "status" },
        { name: `🔍  ${chalk.white("Scan local usage")}`, value: "scan" },
        { name: `⚙️   ${chalk.white("Setup auto-sync")}`, value: "setup" },
        { name: `🔧  ${chalk.white("Settings")}`, value: "settings" },
        new inquirer.Separator(),
        { name: `❓  ${chalk.gray("Help")}`, value: "help" },
        { name: `🚪  ${chalk.gray("Exit")}`, value: "exit" },
      ],
      loop: false,
    },
  ]);

  console.log(); // Add spacing

  switch (action) {
    case "submit":
      await submit({ yes: false });
      break;
    case "status":
      await status({ json: false });
      break;
    case "scan":
      await scan();
      break;
    case "setup":
      await showSetupMenu();
      break;
    case "settings":
      await showSettingsMenu();
      break;
    case "help":
      showHelp();
      break;
    case "exit":
      console.log(colors.muted("  Goodbye! Happy coding with Claude! 👋\n"));
      process.exit(0);
  }
}

// Setup submenu
async function showSetupMenu(): Promise<void> {
  const { setupAction } = await inquirer.prompt([
    {
      type: "list",
      name: "setupAction",
      message: "Auto-sync settings:",
      choices: [
        { name: `✅  ${chalk.white("Enable auto-sync")}`, value: "enable" },
        { name: `❌  ${chalk.white("Disable auto-sync")}`, value: "disable" },
        { name: `⬅️   ${chalk.gray("Back")}`, value: "back" },
      ],
    },
  ]);

  switch (setupAction) {
    case "enable":
      await setupAuto({ auto: true });
      break;
    case "disable":
      await setupAuto({ manual: true });
      break;
    case "back":
      await showInteractiveMenu();
      break;
  }
}

// Settings submenu
async function showSettingsMenu(): Promise<void> {
  const config = getConfig();
  const isAuth = isAuthenticated();

  const { settingsAction } = await inquirer.prompt([
    {
      type: "list",
      name: "settingsAction",
      message: "Settings:",
      choices: [
        {
          name: isAuth
            ? `🔐  ${chalk.white("Re-authenticate")}`
            : `🔐  ${chalk.white("Login / Authenticate")}`,
          value: "auth",
        },
        { name: `🗑️   ${chalk.white("Reset all settings")}`, value: "reset" },
        { name: `📋  ${chalk.white("Show current config")}`, value: "show" },
        { name: `⬅️   ${chalk.gray("Back")}`, value: "back" },
      ],
    },
  ]);

  switch (settingsAction) {
    case "auth": {
      const { auth } = await import("./commands/auth.js");
      await auth({});
      break;
    }
    case "reset": {
      const { confirmReset } = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirmReset",
          message: chalk.yellow("Are you sure you want to reset all settings?"),
          default: false,
        },
      ]);
      if (confirmReset) {
        const { reset } = await import("./commands/reset.js");
        await reset();
      }
      break;
    }
    case "show":
      console.log();
      console.log(colors.muted("  Current Configuration:"));
      console.log(colors.dim("  ─".repeat(25)));
      console.log(
        `  ${colors.muted("Username:")}    ${config.get("username") || colors.dim("(not set)")}`
      );
      console.log(
        `  ${colors.muted("API Token:")}   ${config.get("apiToken") ? colors.success("✓ Set") : colors.error("✗ Not set")}`
      );
      console.log(
        `  ${colors.muted("Auto-sync:")}   ${config.get("autoSync") ? colors.success("Enabled") : colors.dim("Disabled")}`
      );
      console.log(
        `  ${colors.muted("Last Sync:")}   ${config.get("lastSync") || colors.dim("Never")}`
      );
      console.log();
      await promptContinue();
      await showSettingsMenu();
      break;
    case "back":
      await showInteractiveMenu();
      break;
  }
}

// Help display
function showHelp(): void {
  console.log(colors.primary.bold("  CCgather CLI Commands"));
  console.log(colors.dim("  ─".repeat(25)));
  console.log();
  console.log(`  ${colors.white("npx ccgather")}              Interactive menu (default)`);
  console.log(
    `  ${colors.white("npx ccgather scan")}         Scan local Claude Code usage (last 30 days)`
  );
  console.log(`  ${colors.white("npx ccgather scan --all")}   Scan all-time usage (no date limit)`);
  console.log(`  ${colors.white("npx ccgather scan -d 90")}   Scan last 90 days of usage`);
  console.log(`  ${colors.white("npx ccgather rank")}         View your current rank`);
  console.log(`  ${colors.white("npx ccgather sync")}         Sync usage data`);
  console.log(`  ${colors.white("npx ccgather auth")}         Authenticate with CCgather`);
  console.log(`  ${colors.white("npx ccgather reset")}        Reset all settings`);
  console.log();
  console.log(colors.dim("  ─".repeat(25)));
  console.log(`  ${colors.muted("Scan Options:")}`);
  console.log(`  ${colors.white("-a, --all")}             Scan all-time usage (no date limit)`);
  console.log(`  ${colors.white("-d, --days <n>")}        Scan last N days (default: 30)`);
  console.log();
  console.log(`  ${colors.muted("General Options:")}`);
  console.log(`  ${colors.white("-y, --yes")}             Skip confirmation prompts`);
  console.log(`  ${colors.white("--auto")}                Enable auto-sync`);
  console.log(`  ${colors.white("--manual")}              Disable auto-sync`);
  console.log(`  ${colors.white("--no-menu")}             Skip interactive menu`);
  console.log();
  console.log(`  ${colors.muted("Documentation:")} ${link("https://ccgather.com/docs")}`);
  console.log(`  ${colors.muted("Leaderboard:")}   ${link("https://ccgather.com/leaderboard")}`);
  console.log();
}

// Prompt to continue
async function promptContinue(): Promise<void> {
  await inquirer.prompt([
    {
      type: "input",
      name: "continue",
      message: colors.dim("Press Enter to continue..."),
    },
  ]);
}

// Default action
program.action(async (options) => {
  // Handle --auto flag
  if (options.auto) {
    await setupAuto({ auto: true });
    return;
  }

  // Handle --manual flag
  if (options.manual) {
    await setupAuto({ manual: true });
    return;
  }

  // Handle --no-menu flag (direct submit)
  if (options.menu === false) {
    await submit({ yes: options.yes });
    return;
  }

  // Show interactive menu by default
  await showInteractiveMenu();
});

program.parse();
