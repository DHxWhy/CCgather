import * as os from "os";
import * as crypto from "crypto";
import { getConfig } from "./config.js";

/**
 * Get a stable, persistent device identifier for multi-device usage tracking.
 *
 * On first call, generates a 16-char hex ID from system properties + random salt,
 * then stores it in CLI config so the same ID is reused even if hostname changes.
 *
 * Only resets if user runs `ccgather reset` (clears config).
 */
export function getDeviceId(): string {
  const config = getConfig();
  const existing = config.get("deviceId");

  if (existing) {
    return existing;
  }

  // First run: generate from system props + random salt for uniqueness
  const salt = crypto.randomBytes(8).toString("hex");
  const raw = `${os.hostname()}:${os.homedir()}:${os.platform()}:${salt}`;
  const deviceId = crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);

  config.set("deviceId", deviceId);
  return deviceId;
}
