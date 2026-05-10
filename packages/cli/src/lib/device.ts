import * as os from "os";
import * as crypto from "crypto";
import { getConfig } from "./config.js";

const DEVICE_ID_LENGTH = 16;

/**
 * Get a stable, persistent device identifier for multi-device usage tracking.
 *
 * Algorithm: SHA256(hostname:homedir:platform:arch) → first 16 hex chars.
 * Deterministic — the same machine always produces the same ID, even if the
 * CLI config is wiped or reinstalled. This prevents the same physical PC from
 * appearing as multiple "ghost" devices in the leaderboard breakdown.
 *
 * The generated ID is also cached in the CLI config for fast retrieval, but
 * the cache is no longer load-bearing for stability.
 *
 * Backward compatibility: if a previously-stored deviceId exists in config
 * (from older CLI versions that used random salt), it is preserved as-is so
 * historical submissions stay attributed to the same device.
 */
export function getDeviceId(): string {
  const deterministicId = computeDeterministicDeviceId();

  try {
    const config = getConfig();
    const existing = config.get("deviceId");

    if (existing) {
      // Preserve the existing ID — even if it was generated with the legacy
      // random-salt algorithm — so device-level history stays attributed correctly.
      return existing;
    }

    try {
      config.set("deviceId", deterministicId);
    } catch {
      // Config write failed — return the deterministic ID anyway.
      // Next call will recompute the same value.
    }

    return deterministicId;
  } catch {
    // Config entirely broken — deterministic ID still produces the same
    // result on every call for this machine.
    return deterministicId;
  }
}

function computeDeterministicDeviceId(): string {
  const raw = `${os.hostname() || "unknown"}:${os.homedir()}:${os.platform()}:${os.arch()}`;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, DEVICE_ID_LENGTH);
}
