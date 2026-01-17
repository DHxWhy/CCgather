import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import open from "open";
import { getConfig, getApiUrl } from "../lib/config.js";
import { colors } from "../lib/ui.js";

interface AuthOptions {
  token?: string;
}

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

interface PollResponse {
  status: "pending" | "authorized" | "expired" | "used";
  token?: string;
  userId?: string;
  username?: string;
  error?: string;
}

export async function auth(options: AuthOptions): Promise<void> {
  const config = getConfig();

  console.log(chalk.bold("\n🔐 CCgather Authentication\n"));

  // Check if already authenticated
  const existingToken = config.get("apiToken");
  if (existingToken) {
    const { overwrite } = await inquirer.prompt([
      {
        type: "confirm",
        name: "overwrite",
        message: "You are already authenticated. Do you want to re-authenticate?",
        default: false,
      },
    ]);

    if (!overwrite) {
      console.log(chalk.gray("Authentication cancelled.\n"));
      return;
    }
  }

  // If token provided directly, use it
  if (options.token) {
    await authenticateWithToken(options.token);
    return;
  }

  // Device code flow
  const apiUrl = getApiUrl();
  const spinner = ora("Initializing authentication...").start();

  try {
    // Request device code
    const response = await fetch(`${apiUrl}/cli/auth/device`, {
      method: "POST",
    });

    if (!response.ok) {
      spinner.fail(chalk.red("Failed to initialize authentication"));
      console.log(chalk.red("\nPlease check your internet connection and try again.\n"));
      process.exit(1);
    }

    const deviceData = (await response.json()) as DeviceCodeResponse;
    spinner.stop();

    // Display instructions
    console.log(chalk.gray("  Opening browser for authentication...\n"));
    console.log(chalk.gray("  If browser doesn't open, visit:"));
    console.log(`  🔗 ${chalk.cyan.underline(deviceData.verification_uri_complete)}`);
    console.log();

    // Open browser
    try {
      await open(deviceData.verification_uri_complete);
    } catch {
      // Browser might not be available
      console.log(chalk.yellow("  Could not open browser automatically."));
      console.log(chalk.yellow("  Please open the URL above manually.\n"));
    }

    // Poll for authorization
    const pollSpinner = ora("Waiting for authorization...").start();
    const startTime = Date.now();
    const expiresAt = startTime + deviceData.expires_in * 1000;
    const pollInterval = Math.max(deviceData.interval * 1000, 5000); // At least 5 seconds

    while (Date.now() < expiresAt) {
      await sleep(pollInterval);

      try {
        const pollResponse = await fetch(
          `${apiUrl}/cli/auth/device/poll?device_code=${deviceData.device_code}`
        );

        const pollData = (await pollResponse.json()) as PollResponse;

        if (pollData.status === "authorized" && pollData.token) {
          pollSpinner.succeed(chalk.green("Authentication successful!"));

          // Save credentials
          config.set("apiToken", pollData.token);
          config.set("userId", pollData.userId);
          config.set("username", pollData.username);

          console.log(chalk.gray(`\nWelcome, ${colors.white(pollData.username)}!`));
          console.log(chalk.dim("You can now submit your usage data.\n"));
          return;
        }

        if (pollData.status === "expired" || pollData.status === "used") {
          pollSpinner.fail(chalk.red("Authentication expired or already used"));
          console.log(chalk.gray("\nPlease try again.\n"));
          process.exit(1);
        }

        // Update spinner with remaining time
        const remaining = Math.ceil((expiresAt - Date.now()) / 1000);
        pollSpinner.text = `Waiting for authorization... (${remaining}s remaining)`;
      } catch {
        // Network error, continue polling
      }
    }

    pollSpinner.fail(chalk.red("Authentication timed out"));
    console.log(chalk.gray("\nPlease try again.\n"));
    process.exit(1);
  } catch (error) {
    spinner.fail(chalk.red("Authentication failed"));
    console.log(
      chalk.red(`\nError: ${error instanceof Error ? error.message : "Unknown error"}\n`)
    );
    process.exit(1);
  }
}

async function authenticateWithToken(token: string): Promise<void> {
  const config = getConfig();
  const apiUrl = getApiUrl();
  const spinner = ora("Verifying token...").start();

  try {
    const response = await fetch(`${apiUrl}/cli/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      spinner.fail(chalk.red("Authentication failed"));
      const errorData = (await response.json().catch(() => ({}))) as { error?: string };
      console.log(chalk.red(`Error: ${errorData.error || "Invalid token"}`));
      console.log(chalk.gray("\nMake sure your token is correct and try again.\n"));
      process.exit(1);
    }

    const data = (await response.json()) as { userId: string; username: string };

    // Save the token
    config.set("apiToken", token);
    config.set("userId", data.userId);
    config.set("username", data.username);

    spinner.succeed(chalk.green("Authentication successful!"));
    console.log(chalk.gray(`\nWelcome, ${colors.white(data.username)}!`));
    console.log(chalk.dim("You can now submit your usage data.\n"));
  } catch (error) {
    spinner.fail(chalk.red("Authentication failed"));
    console.log(
      chalk.red(`\nError: ${error instanceof Error ? error.message : "Unknown error"}\n`)
    );
    process.exit(1);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
