import Conf from "conf";

export interface CliConfig {
  apiToken?: string;
  apiUrl: string;
  autoSync: boolean;
  syncInterval: number; // in minutes
  verbose: boolean;
  lastSync?: string;
  userId?: string;
  username?: string;
  deviceId?: string;
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
  config.clear();
  Object.entries(defaults).forEach(([key, value]) => {
    config.set(key as keyof CliConfig, value);
  });
}

export function isAuthenticated(): boolean {
  const config = getConfig();
  return !!config.get("apiToken");
}

export function getApiUrl(): string {
  const config = getConfig();
  return config.get("apiUrl") || defaults.apiUrl;
}
