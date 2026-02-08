import * as os from "os";
import * as crypto from "crypto";
import { getConfig } from "./config.js";

const DEVICE_ID_LENGTH = 16;

/**
 * Get a stable, persistent device identifier for multi-device usage tracking.
 *
 * On first call, generates a 16-char hex ID from system properties + random salt,
 * then stores it in CLI config so the same ID is reused even if hostname changes.
 *
 * Falls back to a deterministic (salt-less) ID if config is unreadable,
 * ensuring the same machine always produces the same ID even without persistence.
 */
export function getDeviceId(): string {
  try {
    const config = getConfig();
    const existing = config.get("deviceId");

    if (existing) {
      return existing;
    }

    // First run: generate from system props + random salt for uniqueness
    const salt = crypto.randomBytes(8).toString("hex");
    const raw = `${os.hostname() || "unknown"}:${os.homedir()}:${os.platform()}:${os.arch()}:${salt}`;
    const deviceId = crypto
      .createHash("sha256")
      .update(raw)
      .digest("hex")
      .slice(0, DEVICE_ID_LENGTH);

    try {
      config.set("deviceId", deviceId);
    } catch {
      // Config write failed — return generated ID for this session.
      // Next run may generate a different ID if config remains broken.
    }

    return deviceId;
  } catch {
    // Config entirely broken — deterministic fallback (no random salt)
    // so the same machine produces the same ID across calls.
    const raw = `${os.hostname() || "unknown"}:${os.homedir()}:${os.platform()}:${os.arch()}`;
    return crypto.createHash("sha256").update(raw).digest("hex").slice(0, DEVICE_ID_LENGTH);
  }
}
