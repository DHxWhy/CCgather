import chalk from 'chalk';
import { getConfig, resetConfig, CliConfig } from '../lib/config.js';

interface ConfigOptions {
  show?: boolean;
  reset?: boolean;
  set?: string;
}

export async function config(options: ConfigOptions): Promise<void> {
  const conf = getConfig();

  console.log(chalk.bold('\n⚙️  CCgather Configuration\n'));

  // Show current configuration
  if (options.show || (!options.reset && !options.set)) {
    console.log(chalk.gray('─'.repeat(40)));
    console.log(chalk.gray('Current settings:'));
    console.log(chalk.gray('─'.repeat(40)));

    const apiToken = conf.get('apiToken');
    console.log(`  ${chalk.gray('API Token:')}     ${apiToken ? chalk.green('✓ Set') : chalk.yellow('Not set')}`);
    console.log(`  ${chalk.gray('API URL:')}       ${conf.get('apiUrl')}`);
    console.log(`  ${chalk.gray('Auto Sync:')}     ${conf.get('autoSync') ? 'Enabled' : 'Disabled'}`);
    console.log(`  ${chalk.gray('Sync Interval:')} ${conf.get('syncInterval')} minutes`);
    console.log(`  ${chalk.gray('Verbose:')}       ${conf.get('verbose') ? 'Yes' : 'No'}`);

    const lastSync = conf.get('lastSync');
    if (lastSync) {
      console.log(`  ${chalk.gray('Last Sync:')}     ${new Date(lastSync).toLocaleString()}`);
    }

    console.log(chalk.gray('─'.repeat(40)));
    console.log(chalk.gray('\nConfig location: ' + conf.path + '\n'));
    return;
  }

  // Reset configuration
  if (options.reset) {
    resetConfig();
    console.log(chalk.green('✓ Configuration reset to defaults'));
    console.log(chalk.gray('\nNote: You will need to re-authenticate.\n'));
    return;
  }

  // Set a configuration value
  if (options.set) {
    const [key, value] = options.set.split('=');

    if (!key || value === undefined) {
      console.log(chalk.red('Invalid format. Use: --set key=value'));
      console.log(chalk.gray('Example: --set autoSync=true\n'));
      process.exit(1);
    }

    const validKeys: (keyof CliConfig)[] = ['apiUrl', 'autoSync', 'syncInterval', 'verbose'];

    if (!validKeys.includes(key as keyof CliConfig)) {
      console.log(chalk.red(`Invalid configuration key: ${key}`));
      console.log(chalk.gray(`Valid keys: ${validKeys.join(', ')}\n`));
      process.exit(1);
    }

    // Parse value based on key type
    let parsedValue: string | number | boolean = value;

    if (key === 'autoSync' || key === 'verbose') {
      parsedValue = value.toLowerCase() === 'true';
    } else if (key === 'syncInterval') {
      parsedValue = parseInt(value, 10);
      if (isNaN(parsedValue) || parsedValue < 1) {
        console.log(chalk.red('syncInterval must be a positive number'));
        process.exit(1);
      }
    }

    conf.set(key as keyof CliConfig, parsedValue as never);
    console.log(chalk.green(`✓ Set ${key} = ${parsedValue}`));
    console.log();
  }
}
