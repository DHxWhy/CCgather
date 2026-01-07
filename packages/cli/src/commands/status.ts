import chalk from 'chalk';
import ora from 'ora';
import { isAuthenticated } from '../lib/config.js';
import { getStatus } from '../lib/api.js';

interface StatusOptions {
  json?: boolean;
}

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toString();
}

function getTierEmoji(tier: string): string {
  const emojis: Record<string, string> = {
    free: '🆓',
    pro: '⭐',
    team: '👥',
    enterprise: '🏢',
  };
  return emojis[tier.toLowerCase()] || '🎯';
}

function getRankMedal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  if (rank <= 10) return '🏅';
  if (rank <= 100) return '🎖️';
  return '📊';
}

export async function status(options: StatusOptions): Promise<void> {
  // Check authentication
  if (!isAuthenticated()) {
    if (options.json) {
      console.log(JSON.stringify({ error: 'Not authenticated' }));
    } else {
      console.log(chalk.red('\nNot authenticated.'));
      console.log(chalk.gray('Run: npx ccgather auth\n'));
    }
    process.exit(1);
  }

  const spinner = options.json ? null : ora('Fetching your stats...').start();

  const result = await getStatus();

  if (!result.success) {
    if (spinner) spinner.fail(chalk.red('Failed to fetch status'));
    if (options.json) {
      console.log(JSON.stringify({ error: result.error }));
    } else {
      console.log(chalk.red(`Error: ${result.error}\n`));
    }
    process.exit(1);
  }

  const stats = result.data!;

  if (options.json) {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  spinner?.succeed(chalk.green('Status retrieved'));

  // Display formatted status
  console.log('\n' + chalk.bold('═'.repeat(42)));
  console.log(chalk.bold.white('           🌐 CCgather Status'));
  console.log(chalk.bold('═'.repeat(42)));

  // Rank display
  const medal = getRankMedal(stats.rank);
  console.log(`\n  ${medal} ${chalk.bold.yellow(`Rank #${stats.rank}`)}`);
  console.log(chalk.gray(`     Top ${stats.percentile.toFixed(1)}% of all users`));

  // Stats grid
  console.log('\n' + chalk.gray('─'.repeat(42)));
  console.log(
    `  ${chalk.gray('Tokens')}      ${chalk.white(formatNumber(stats.totalTokens))}`
  );
  console.log(
    `  ${chalk.gray('Spent')}       ${chalk.green('$' + stats.totalSpent.toFixed(2))}`
  );
  console.log(
    `  ${chalk.gray('Tier')}        ${getTierEmoji(stats.tier)} ${chalk.white(stats.tier)}`
  );

  // Badges
  if (stats.badges && stats.badges.length > 0) {
    console.log('\n' + chalk.gray('─'.repeat(42)));
    console.log(chalk.gray('  Badges'));
    console.log(`  ${stats.badges.join('  ')}`);
  }

  console.log('\n' + chalk.bold('═'.repeat(42)));
  console.log(chalk.gray('\n  View leaderboard: https://ccgather.dev/leaderboard\n'));
}
