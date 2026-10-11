import Conf from "conf";

export interface CliConfig {
  apiToken?: string;
  apiUrl: string;
  autoSync: boolean;
  autoSyncTime?: string; // daily time of the auto-submit job, "14:23"
  syncInterval: number; // in minutes
  verbose: boolean;
  lastSync?: string;
  userId?: string;
  username?: string;
  deviceId?: string;
  starConfirmed?: boolean;
  starServerConfirmed?: boolean;
  starDeclineCount?: number;
  starPromptSnooze?: number; // submits left to stay quiet after a decline
  // The last `submit --scheduled` run, shown by `autosubmit status`: its full log
  // line and a short summary of the outcome
  lastScheduledRun?: { at: string; ok: boolean; message: string; summary: string };
}

const defaults: CliConfig = {
  apiUrl: "https://ccgather.com/api",
  autoSync: false,
  syncInterval: 60,
  verbose: false,
};

let configInstance: Conf<CliConfig> | null = null;

export function getConfig(): Conf<CliConfig> {
  if (!configInstance) {
    configInstance = new Conf<CliConfig>({
      projectName: "ccgather",
      defaults,
    });
  }
  return configInstance;
}

export function resetConfig(): void {
  const config = getConfig();
  // Preserve deviceId across resets — it's a machine identifier, not a user preference
  const preservedDeviceId = config.get("deviceId");
  config.clear();
  Object.entries(defaults).forEach(([key, value]) => {
    config.set(key as keyof CliConfig, value);
  });
  if (preservedDeviceId) {
    config.set("deviceId", preservedDeviceId);
  }
}

export function isAuthenticated(): boolean {
  const config = getConfig();
  return !!config.get("apiToken");
}

export function getApiUrl(): string {
  const config = getConfig();
  return config.get("apiUrl") || defaults.apiUrl;
}
