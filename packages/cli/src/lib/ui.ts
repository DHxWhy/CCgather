import chalk from "chalk";

// Version injected at build time by tsup
declare const __VERSION__: string;
export const VERSION: string = typeof __VERSION__ !== "undefined" ? __VERSION__ : "0.0.0";

// Brand colors
export const colors = {
  primary: chalk.hex("#DA7756"), // Claude coral
  secondary: chalk.hex("#F7931E"), // Orange accent
  success: chalk.hex("#22C55E"), // Green
  warning: chalk.hex("#F59E0B"), // Amber
  error: chalk.hex("#EF4444"), // Red
  muted: chalk.hex("#71717A"), // Gray
  dim: chalk.hex("#52525B"), // Dark gray
  white: chalk.white,
  cyan: chalk.cyan,

  // CCplan colors
  max: chalk.hex("#F59E0B"), // Gold
  pro: chalk.hex("#3B82F6"), // Blue
  team: chalk.hex("#8B5CF6"), // Purple
  free: chalk.hex("#6B7280"), // Gray
};

// Create clickable hyperlink (OSC 8 escape sequence)
// Supported in: Windows Terminal, iTerm2, Hyper, VS Code terminal, etc.
export function hyperlink(text: string, url: string): string {
  return `\u001B]8;;${url}\u0007${text}\u001B]8;;\u0007`;
}

// ASCII Art Logo
export const LOGO = `
    ${colors.primary("██████╗ ██████╗")} ${colors.secondary("██████╗  █████╗ ████████╗██╗  ██╗███████╗██████╗")}
   ${colors.primary("██╔════╝██╔════╝")}${colors.secondary("██╔════╝ ██╔══██╗╚══██╔══╝██║  ██║██╔════╝██╔══██╗")}
   ${colors.primary("██║     ██║     ")}${colors.secondary("██║  ███╗███████║   ██║   ███████║█████╗  ██████╔╝")}
   ${colors.primary("██║     ██║     ")}${colors.secondary("██║   ██║██╔══██║   ██║   ██╔══██║██╔══╝  ██╔══██╗")}
   ${colors.primary("╚██████╗╚██████╗")}${colors.secondary("╚██████╔╝██║  ██║   ██║   ██║  ██║███████╗██║  ██║")}
    ${colors.primary("╚═════╝ ╚═════╝")} ${colors.secondary("╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝")}
`;

// Compact logo for smaller screens
export const LOGO_COMPACT = `
  ${colors.primary("CC")}${colors.secondary("gather")} ${colors.muted("- Where Claude Code Developers Gather")}
`;

// Taglines
export const TAGLINE = colors.muted("          Where Claude Code Developers Gather");
export const SLOGAN = colors.dim("                Gather. Compete. Rise.");

// Version display
export function getVersionLine(version: string): string {
  return colors.dim(`                    v${version} • ccgather.com`);
}

// Box drawing characters (rounded for header)
const boxRound = {
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  horizontal: "─",
  vertical: "│",
  leftT: "├",
  rightT: "┤",
};

// Box drawing characters (square for content)
const box = {
  topLeft: "┌",
  topRight: "┐",
  bottomLeft: "└",
  bottomRight: "┘",
  horizontal: "─",
  vertical: "│",
  leftT: "├",
  rightT: "┤",
};

const HEADER_WIDTH = 46;

// Center text within width
function centerText(text: string, width: number): string {
  const len = stripAnsi(text).length;
  const pad = width - len;
  return (
    " ".repeat(Math.max(0, Math.floor(pad / 2))) +
    text +
    " ".repeat(Math.max(0, pad - Math.floor(pad / 2)))
  );
}

// Right-align text within width
function rightAlignText(text: string, width: number): string {
  const len = stripAnsi(text).length;
  const pad = width - len;
  return " ".repeat(Math.max(0, pad)) + text;
}

// Create professional boxed header (medium block logo)
export function createProfessionalHeader(): string[] {
  const lines: string[] = [];
  const v = boxRound.vertical;
  const h = boxRound.horizontal;

  lines.push(colors.dim(`  ${boxRound.topLeft}${h.repeat(HEADER_WIDTH)}${boxRound.topRight}`));

  // CCGATHER logo (3 rows, same height)
  const logoLines = [
    `  ${colors.primary("▄█▀▀ ▄█▀▀")} ${colors.secondary("▄█▀▀  ▄█▀█▄ ▀█▀ █  █ █▀▀ █▀█")}  `,
    `  ${colors.primary("█    █   ")} ${colors.secondary("█  ▀█ █▀▀█▀  █  █▀▀█ █▀▀ ██▀")}  `,
    `  ${colors.primary("▀█▄▄ ▀█▄▄")} ${colors.secondary("▀█▄▄▀ █  █   █  █  █ █▄▄ █ █")}  `,
  ];
  for (const l of logoLines) {
    lines.push(
      colors.dim(`  ${v}`) +
        l +
        " ".repeat(Math.max(0, HEADER_WIDTH - stripAnsi(l).length)) +
        colors.dim(v)
    );
  }

  // Version right-aligned (2-space padding)
  const versionStr = `v${VERSION}`;
  const versionPad = HEADER_WIDTH - versionStr.length - 2;
  lines.push(
    colors.dim(`  ${v}`) + " ".repeat(versionPad) + colors.dim(versionStr) + "  " + colors.dim(v)
  );

  lines.push(colors.dim(`  ${boxRound.leftT}${h.repeat(HEADER_WIDTH)}${boxRound.rightT}`));
  lines.push(
    colors.dim(`  ${v}`) +
      centerText(colors.muted("Where Claude Code Developers Gather"), HEADER_WIDTH) +
      colors.dim(v)
  );
  lines.push(
    colors.dim(`  ${v}`) +
      centerText(colors.dim("Gather · Compete · Rise"), HEADER_WIDTH) +
      colors.dim(v)
  );
  lines.push(colors.dim(`  ${v}`) + " ".repeat(HEADER_WIDTH) + colors.dim(v));

  // Bottom border with clickable ccgather.com link
  const siteLabel = " 🌐 ccgather.com ";
  const siteLink = hyperlink(colors.secondary(siteLabel), "https://ccgather.com");
  const leftDashes = 13;
  const rightDashes = HEADER_WIDTH - leftDashes - siteLabel.length;
  lines.push(
    colors.dim(`  ${boxRound.bottomLeft}${h.repeat(leftDashes)}`) +
      siteLink +
      colors.dim(`${h.repeat(rightDashes)}${boxRound.bottomRight}`)
  );

  return lines;
}

// Create a box around content
export function createBox(lines: string[], width: number = 47): string {
  const paddedLines = lines.map((line) => {
    const visibleLength = stripAnsi(line).length;
    const padding = width - 2 - visibleLength;
    return `${box.vertical} ${line}${" ".repeat(Math.max(0, padding))} ${box.vertical}`;
  });

  const top = colors.dim(`  ${box.topLeft}${box.horizontal.repeat(width)}${box.topRight}`);
  const bottom = colors.dim(`  ${box.bottomLeft}${box.horizontal.repeat(width)}${box.bottomRight}`);

  return [top, ...paddedLines.map((l) => colors.dim("  ") + l), bottom].join("\n");
}

// Strip ANSI codes for length calculation
function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
}

// Create a divider line
export function divider(width: number = 50, char: string = "─"): string {
  return colors.dim(char.repeat(width));
}

// Create a header section
export function header(title: string, icon: string = ""): string {
  const iconPart = icon ? `${icon} ` : "";
  return `\n${colors.primary("━".repeat(50))}\n  ${iconPart}${colors.white.bold(title)}\n${colors.primary("━".repeat(50))}`;
}

// Create a section header
export function sectionHeader(title: string): string {
  return `\n${colors.dim("─".repeat(50))}\n  ${colors.muted(title)}\n${colors.dim("─".repeat(50))}`;
}

// Format numbers
export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toLocaleString();
}

// Format cost
export function formatCost(cost: number): string {
  return `$${cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Get rank medal/emoji
export function getRankMedal(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  if (rank <= 10) return "🏅";
  if (rank <= 100) return "🎖️";
  return "📊";
}

// Get CCplan badge
export function getCCplanBadge(ccplan: string | null): string {
  if (!ccplan) return "";
  const badges: Record<string, string> = {
    max: `${colors.max("🚀 MAX")}`,
    pro: `${colors.pro("⚡ PRO")}`,
    team: `${colors.team("👥 TEAM")}`,
    free: `${colors.free("⚪ FREE")}`,
  };
  return badges[ccplan.toLowerCase()] || "";
}

// Level thresholds - single source of truth
// Max user benchmark: ~1B tokens per 3 days
const LEVELS = [
  { min: 0, level: 1, name: "Novice", icon: "🌱", color: colors.dim },
  { min: 50_000_000, level: 2, name: "Apprentice", icon: "📚", color: colors.muted },
  { min: 200_000_000, level: 3, name: "Journeyman", icon: "⚡", color: colors.cyan },
  { min: 500_000_000, level: 4, name: "Expert", icon: "💎", color: colors.pro },
  { min: 1_000_000_000, level: 5, name: "Master", icon: "🔥", color: colors.warning },
  { min: 3_000_000_000, level: 6, name: "Grandmaster", icon: "👑", color: colors.max },
  { min: 10_000_000_000, level: 7, name: "Legend", icon: "🌟", color: colors.primary },
  { min: 30_000_000_000, level: 8, name: "Mythic", icon: "🏆", color: colors.secondary },
  { min: 50_000_000_000, level: 9, name: "Immortal", icon: "💫", color: colors.team },
  { min: 100_000_000_000, level: 10, name: "Transcendent", icon: "🌌", color: colors.white },
];

// Get level info
export function getLevelInfo(tokens: number): {
  level: number;
  name: string;
  icon: string;
  color: typeof colors.primary;
} {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (tokens >= LEVELS[i].min) {
      return LEVELS[i];
    }
  }
  return LEVELS[0];
}

// Get detailed level progress info
export function getLevelProgress(tokens: number): {
  current: {
    level: number;
    name: string;
    icon: string;
    color: typeof colors.primary;
  };
  next: {
    level: number;
    name: string;
    icon: string;
    threshold: number;
  } | null;
  progress: number; // 0-100
  tokensToNext: number;
  isMaxLevel: boolean;
} {
  let currentIndex = 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (tokens >= LEVELS[i].min) {
      currentIndex = i;
      break;
    }
  }

  const current = LEVELS[currentIndex];
  const isMaxLevel = currentIndex === LEVELS.length - 1;

  if (isMaxLevel) {
    return {
      current,
      next: null,
      progress: 100,
      tokensToNext: 0,
      isMaxLevel: true,
    };
  }

  const nextLevel = LEVELS[currentIndex + 1];
  const currentMin = current.min;
  const nextMin = nextLevel.min;
  const progressInLevel = tokens - currentMin;
  const levelRange = nextMin - currentMin;
  const progress = Math.min(100, Math.round((progressInLevel / levelRange) * 100));

  return {
    current,
    next: {
      level: nextLevel.level,
      name: nextLevel.name,
      icon: nextLevel.icon,
      threshold: nextLevel.min,
    },
    progress,
    tokensToNext: nextMin - tokens,
    isMaxLevel: false,
  };
}

// Create welcome box for authenticated user
export function createWelcomeBox(user: {
  username: string;
  level?: number;
  levelName?: string;
  levelIcon?: string;
  globalRank?: number;
  countryRank?: number;
  countryCode?: string;
  ccplan?: string;
}): string {
  const levelInfo =
    user.level && user.levelName && user.levelIcon
      ? `${user.levelIcon} Level ${user.level} • ${user.levelName}`
      : "";

  const ccplanBadge = user.ccplan ? getCCplanBadge(user.ccplan) : "";

  const lines = [`👋 ${colors.white.bold(`Welcome back, ${user.username}!`)}`];

  if (levelInfo || ccplanBadge) {
    lines.push(`${levelInfo}${ccplanBadge ? `  ${ccplanBadge}` : ""}`);
  }

  if (user.globalRank) {
    lines.push(`🌍 Global Rank: ${colors.primary(`#${user.globalRank}`)}`);
  }

  if (user.countryRank && user.countryCode) {
    const flag = countryCodeToFlag(user.countryCode);
    lines.push(`${flag} Country Rank: ${colors.primary(`#${user.countryRank}`)}`);
  }

  return createBox(lines);
}

// Convert country code to flag emoji
export function countryCodeToFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "🌐";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 0x1f1e6 + char.charCodeAt(0) - 65);
  return String.fromCodePoint(...codePoints);
}

// Create stats display
export function createStatsDisplay(stats: {
  tokens: number;
  cost: number;
  rank?: number;
  percentile?: number;
}): string {
  const lines = [
    `  ${colors.muted("Tokens")}      ${colors.primary(formatNumber(stats.tokens))}`,
    `  ${colors.muted("Cost")}        ${colors.success(formatCost(stats.cost))}`,
  ];

  if (stats.rank) {
    const medal = getRankMedal(stats.rank);
    lines.push(`  ${colors.muted("Rank")}        ${medal} ${colors.warning(`#${stats.rank}`)}`);
  }

  if (stats.percentile !== undefined) {
    lines.push(
      `  ${colors.muted("Percentile")}  ${colors.cyan(`Top ${stats.percentile.toFixed(1)}%`)}`
    );
  }

  return lines.join("\n");
}

// Success message
export function success(message: string): string {
  return `${colors.success("✓")} ${message}`;
}

// Error message
export function error(message: string): string {
  return `${colors.error("✗")} ${message}`;
}

// Warning message
export function warning(message: string): string {
  return `${colors.warning("⚠")} ${message}`;
}

// Info message
export function info(message: string): string {
  return `${colors.cyan("ℹ")} ${message}`;
}

// Print full header with logo
export function printHeader(version: string): void {
  console.log(LOGO);
  console.log(TAGLINE);
  console.log(SLOGAN);
  console.log();
  console.log(getVersionLine(version));
  console.log();
}

// Print compact header
export function printCompactHeader(version: string): void {
  console.log();
  console.log(LOGO_COMPACT);
  console.log(colors.dim(`  v${version}`));
  console.log();
}

// Link display (clickable in supported terminals)
export function link(url: string): string {
  return hyperlink(colors.cyan.underline(url), url);
}

// Highlight text
export function highlight(text: string): string {
  return colors.primary.bold(text);
}

// ============================================
// Animation Utilities
// ============================================

// Sleep utility
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Typewriter effect - prints text character by character (50% faster)
export async function typewriter(
  text: string,
  delay: number = 15,
  prefix: string = ""
): Promise<void> {
  process.stdout.write(prefix);
  for (const char of text) {
    process.stdout.write(char);
    await sleep(delay);
  }
  console.log();
}

// Line by line fade in effect (50% faster)
export async function fadeInLines(lines: string[], delay: number = 40): Promise<void> {
  for (const line of lines) {
    console.log(line);
    await sleep(delay);
  }
}

// Dot animation (50% faster)
export async function dotAnimation(
  message: string,
  durationMs: number = 400,
  speed: "slow" | "normal" | "fast" = "fast"
): Promise<void> {
  const frames = [".", "..", "..."];
  const frameDelays = { slow: 100, normal: 60, fast: 40 };
  const frameDelay = frameDelays[speed];
  const iterations = Math.ceil(durationMs / (frames.length * frameDelay));

  for (let i = 0; i < iterations; i++) {
    for (const frame of frames) {
      process.stdout.write(`\r  ${colors.muted(message)}${colors.primary(frame)}   `);
      await sleep(frameDelay);
    }
  }
  process.stdout.write("\r" + " ".repeat(message.length + 10) + "\r");
}

// Progress bar for scanning operations
export async function progressBar(
  current: number,
  total: number,
  message: string = "Processing"
): Promise<void> {
  const width = 24;
  const percent = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const empty = width - filled;

  const bar = colors.primary("█".repeat(filled)) + colors.dim("░".repeat(empty));
  const percentStr = colors.white(`${percent}%`);

  process.stdout.write(`\r  ${colors.muted(message)} [${bar}] ${percentStr}  `);

  if (current >= total) {
    console.log();
  }
}

// Animated logo display with professional boxed design
export async function printAnimatedHeader(): Promise<void> {
  console.log();
  const headerLines = createProfessionalHeader();
  for (const line of headerLines) {
    console.log(line);
    await sleep(20);
  }
  console.log();
}

// Slot machine animation for rank reveal
export async function slotMachineRank(
  finalRank: number,
  label: string,
  medal: string,
  iterations: number = 12
): Promise<void> {
  const maxRank = Math.max(finalRank * 3, 100);

  for (let i = 0; i < iterations; i++) {
    const fakeRank = Math.floor(Math.random() * maxRank) + 1;
    const speed = Math.min(30 + i * 15, 150); // Slow down gradually
    process.stdout.write(
      `\r     ${medal} ${colors.muted(label)} ${colors.dim(`#${fakeRank}`)}    `
    );
    await sleep(speed);
  }

  // Final reveal with color
  process.stdout.write(
    `\r     ${medal} ${colors.muted(label)} ${colors.primary.bold(`#${finalRank}`)}    \n`
  );
}

// Animated progress bar that fills from 0 to target
export async function animatedProgressBar(
  targetPercent: number,
  barWidth: number = 20,
  stepDelay: number = 25
): Promise<string> {
  const steps = Math.min(targetPercent, 20); // Max 20 animation steps
  const stepSize = targetPercent / steps;

  for (let i = 0; i <= steps; i++) {
    const currentPercent = Math.round(i * stepSize);
    const filled = Math.round((currentPercent / 100) * barWidth);
    const empty = barWidth - filled;
    const bar = colors.primary("█".repeat(filled)) + colors.dim("░".repeat(empty));

    process.stdout.write(`\r     [${bar}] ${colors.white(`${currentPercent}%`)}  `);
    await sleep(stepDelay);
  }

  // Return final bar for subsequent use
  const finalFilled = Math.round((targetPercent / 100) * barWidth);
  const finalEmpty = barWidth - finalFilled;
  return colors.primary("█".repeat(finalFilled)) + colors.dim("░".repeat(finalEmpty));
}

// Suspense dots before reveal
export async function suspenseDots(message: string, durationMs: number = 600): Promise<void> {
  const frames = ["", ".", "..", "..."];
  const frameDelay = 100;
  const iterations = Math.ceil(durationMs / (frames.length * frameDelay));

  for (let i = 0; i < iterations; i++) {
    for (const frame of frames) {
      process.stdout.write(`\r     ${colors.muted(message)}${colors.primary(frame)}     `);
      await sleep(frameDelay);
    }
  }
  process.stdout.write("\r" + " ".repeat(50) + "\r");
}

// Animated welcome box (typewriter style for username)
export async function printAnimatedWelcomeBox(user: {
  username: string;
  level?: number;
  levelName?: string;
  levelIcon?: string;
  globalRank?: number;
  countryRank?: number;
  countryCode?: string;
  ccplan?: string;
}): Promise<void> {
  const lines: string[] = [];

  // Build lines
  const welcomeLine = `👋 ${colors.white.bold(`Welcome back, ${user.username}!`)}`;
  lines.push(welcomeLine);

  const levelInfo =
    user.level && user.levelName && user.levelIcon
      ? `${user.levelIcon} Level ${user.level} • ${user.levelName}`
      : "";
  const ccplanBadge = user.ccplan ? getCCplanBadge(user.ccplan) : "";

  if (levelInfo || ccplanBadge) {
    lines.push(`${levelInfo}${ccplanBadge ? `  ${ccplanBadge}` : ""}`);
  }

  if (user.globalRank) {
    lines.push(`🌍 Global Rank: ${colors.primary(`#${user.globalRank}`)}`);
  }

  if (user.countryRank && user.countryCode) {
    const flag = countryCodeToFlag(user.countryCode);
    lines.push(`${flag} Country Rank: ${colors.primary(`#${user.countryRank}`)}`);
  }

  // Calculate box width
  const maxVisibleLength = Math.max(...lines.map((l) => stripAnsi(l).length));
  const boxWidth = Math.max(maxVisibleLength + 4, 47);

  // Print box with animation
  const top = colors.dim(`  ${box.topLeft}${box.horizontal.repeat(boxWidth)}${box.topRight}`);
  const bottom = colors.dim(
    `  ${box.bottomLeft}${box.horizontal.repeat(boxWidth)}${box.bottomRight}`
  );

  console.log(top);
  await sleep(20);

  for (const line of lines) {
    const visibleLength = stripAnsi(line).length;
    const padding = boxWidth - 2 - visibleLength;
    const paddedLine = `${box.vertical} ${line}${" ".repeat(Math.max(0, padding))} ${box.vertical}`;
    console.log(colors.dim("  ") + paddedLine);
    await sleep(25);
  }

  console.log(bottom);
}
