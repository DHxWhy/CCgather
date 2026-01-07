import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { getConfig } from '../lib/config.js';
import { verifyToken } from '../lib/api.js';

interface AuthOptions {
  token?: string;
}

export async function auth(options: AuthOptions): Promise<void> {
  const config = getConfig();

  console.log(chalk.bold('\n🌐 CCgather Authentication\n'));

  // Check if already authenticated
  const existingToken = config.get('apiToken');
  if (existingToken) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: 'You are already authenticated. Do you want to re-authenticate?',
        default: false,
      },
    ]);

    if (!overwrite) {
      console.log(chalk.gray('Authentication cancelled.'));
      return;
    }
  }

  // Get token from option or prompt
  let token = options.token;

  if (!token) {
    console.log(chalk.gray('Get your API token from: https://ccgather.dev/settings/api\n'));

    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'token',
        message: 'Enter your API token:',
        mask: '*',
        validate: (input: string) => {
          if (!input || input.length < 10) {
            return 'Please enter a valid API token';
          }
          return true;
        },
      },
    ]);

    token = answers.token;
  }

  // Verify the token
  const spinner = ora('Verifying token...').start();

  const result = await verifyToken(token!);

  if (!result.success) {
    spinner.fail(chalk.red('Authentication failed'));
    console.log(chalk.red(`Error: ${result.error}`));
    console.log(chalk.gray('\nMake sure your token is correct and try again.'));
    process.exit(1);
  }

  // Save the token
  config.set('apiToken', token);
  config.set('userId', result.data?.userId);

  spinner.succeed(chalk.green('Authentication successful!'));
  console.log(chalk.gray(`\nWelcome, ${chalk.white(result.data?.username)}!`));
  console.log(chalk.gray('\nNext step: Sync your usage data:'));
  console.log(chalk.cyan('  npx ccgather sync\n'));
}
