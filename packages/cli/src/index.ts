#!/usr/bin/env node

import { Command } from 'commander';
import { submit } from './commands/submit.js';
import { status } from './commands/status.js';
import { setupAuto } from './commands/setup-auto.js';
import { scan } from './commands/scan.js';

const program = new Command();

program
  .name('ccgather')
  .description('Submit your Claude Code usage to the CCgather leaderboard')
  .version('1.0.0')
  .option('-y, --yes', 'Skip confirmation prompt')
  .option('--auto', 'Enable automatic sync on session end')
  .option('--manual', 'Disable automatic sync');

// Scan command (generate ccgather.json)
program
  .command('scan')
  .description('Scan Claude Code usage and create ccgather.json')
  .action(scan);

// Rank command (view ranking)
program
  .command('rank')
  .description('View your current rank and stats')
  .action(status);

// Reset command
program
  .command('reset')
  .description('Remove auto-sync hook and clear config')
  .action(async () => {
    const { reset } = await import('./commands/reset.js');
    await reset();
  });

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

  // Default: submit
  await submit({ yes: options.yes });
});

program.parse();
