import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import inquirer from 'inquirer';
import { getConfig, resetConfig } from '../lib/config.js';

/**
 * Get the Claude Code settings directory
 */
function getClaudeSettingsDir(): string {
  return path.join(os.homedir(), '.claude');
}

/**
 * Remove CCgather hook from Claude Code settings
 */
function removeStopHook(): { success: boolean; message: string } {
  const claudeDir = getClaudeSettingsDir();
  const settingsPath = path.join(claudeDir, 'settings.json');

  if (!fs.existsSync(settingsPath)) {
    return { success: true, message: 'No settings file found' };
  }

  try {
    const content = fs.readFileSync(settingsPath, 'utf-8');
    const settings = JSON.parse(content) as Record<string, unknown>;

    if (settings.hooks && typeof settings.hooks === 'object') {
      const hooks = settings.hooks as Record<string, unknown[]>;

      if (hooks.Stop && Array.isArray(hooks.Stop)) {
        // Filter out CCgather hooks
        hooks.Stop = hooks.Stop.filter((hook: unknown) => {
          if (typeof hook === 'object' && hook !== null) {
            const h = hook as Record<string, unknown>;
            return typeof h.command !== 'string' || !h.command.includes('ccgather');
          }
          return true;
        });

        // Remove Stop array if empty
        if (hooks.Stop.length === 0) {
          delete hooks.Stop;
        }
      }
    }

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    return { success: true, message: 'Hook removed' };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Remove sync script from Claude directory
 */
function removeSyncScript(): void {
  const claudeDir = getClaudeSettingsDir();
  const scriptPath = path.join(claudeDir, 'ccgather-sync.js');

  if (fs.existsSync(scriptPath)) {
    fs.unlinkSync(scriptPath);
  }
}

/**
 * Reset command - uninstall hook and optionally delete account
 */
export async function reset(): Promise<void> {
  const config = getConfig();

  console.log(chalk.bold('\n🔄 CCgather Reset\n'));

  // Check if configured
  if (!config.get('apiToken')) {
    console.log(chalk.yellow('CCgather is not configured.'));
    return;
  }

  // Confirm reset
  const { confirmReset } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmReset',
      message: 'This will remove the CCgather hook and local configuration. Continue?',
      default: false,
    },
  ]);

  if (!confirmReset) {
    console.log(chalk.gray('Reset cancelled.'));
    return;
  }

  // Remove hook
  const hookSpinner = ora('Removing Claude Code hook...').start();
  const hookResult = removeStopHook();

  if (hookResult.success) {
    hookSpinner.succeed(chalk.green('Hook removed'));
  } else {
    hookSpinner.warn(chalk.yellow(`Could not remove hook: ${hookResult.message}`));
  }

  // Remove sync script
  const scriptSpinner = ora('Removing sync script...').start();
  try {
    removeSyncScript();
    scriptSpinner.succeed(chalk.green('Sync script removed'));
  } catch {
    scriptSpinner.warn(chalk.yellow('Could not remove sync script'));
  }

  // Ask about account deletion
  const { deleteAccount } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'deleteAccount',
      message: chalk.red('Do you also want to delete your account from the leaderboard? (This cannot be undone)'),
      default: false,
    },
  ]);

  if (deleteAccount) {
    // TODO: Implement account deletion API call
    console.log(chalk.yellow('\nAccount deletion is not yet implemented.'));
    console.log(chalk.gray('Please contact support to delete your account.'));
  }

  // Reset local config
  const configSpinner = ora('Resetting local configuration...').start();
  resetConfig();
  configSpinner.succeed(chalk.green('Local configuration reset'));

  console.log();
  console.log(chalk.green.bold('✅ Reset complete!'));
  console.log();
  console.log(chalk.gray('Your usage will no longer be tracked.'));
  console.log(chalk.gray('Run `npx ccgather` to set up again.'));
  console.log();
}
