import { CLI_VERSION_NOT_SENT } from "@/lib/utils/submit-payload";

type Release = readonly [number, number, number];

// Raise this when a CLI release changes how usage is counted: members whose last
// accepted submit came from an older release are asked to update.
const RECOMMENDED_RELEASE: Release = [2, 3, 3];

export const CLI_UPDATE_DISMISS_KEY = "ccgather.cliUpdateDismissed";
export const CLI_UPDATE_DISMISS_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;
const RELEASE = /^(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.+-]*)?$/;

export interface CliStatus {
  version: string | null;
  outdated: boolean;
}

export interface CliUpdateDismissal {
  version: string;
  at: number;
}

function parseRelease(version: string): Release | null {
  const match = RELEASE.exec(version);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function compareReleases(a: Release, b: Release): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

export function isOutdatedCliVersion(version: string | null | undefined): boolean {
  if (version === CLI_VERSION_NOT_SENT) return true;
  const release = version ? parseRelease(version) : null;
  return release !== null && compareReleases(release, RECOMMENDED_RELEASE) < 0;
}

export function describeCliVersion(version: string): string {
  return version === CLI_VERSION_NOT_SENT ? "a CLI version before 2.2.0" : `CLI v${version}`;
}

export function cliStatusFromEvent(event: { cli_version: string | null } | null): CliStatus {
  const version = event?.cli_version ?? null;
  return { version, outdated: isOutdatedCliVersion(version) };
}

export function parseDismissal(raw: string | null): CliUpdateDismissal | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const { version, at } = value as Record<string, unknown>;
  return typeof version === "string" && typeof at === "number" && Number.isFinite(at)
    ? { version, at }
    : null;
}

export function shouldShowCliUpdate(
  status: CliStatus | null | undefined,
  dismissal: CliUpdateDismissal | null,
  nowMs: number
): boolean {
  if (!status?.outdated || !status.version) return false;
  if (!dismissal || dismissal.version !== status.version) return true;
  return nowMs - dismissal.at >= CLI_UPDATE_DISMISS_DAYS * DAY_MS;
}
