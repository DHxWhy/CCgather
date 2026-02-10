import chalk from "chalk";
import stringWidth from "string-width";

// Version injected at build time by tsup
declare const __VERSION__: string;
export const VERSION: string = typeof __VERSION__ !== "undefined" ? __VERSION__ : "0.0.0";

// Brand colors
// Note: Using colors that work on both light and dark terminal backgrounds
export const colors = {
  primary: chalk.hex("#DA7756"), // Claude coral
  secondary: chalk.hex("#F7931E"), // Orange accent
  success: chalk.hex("#22C55E"), // Green
  warning: chalk.hex("#F59E0B"), // Amber
  error: chalk.hex("#EF4444"), // Red
  muted: chalk.hex("#71717A"), // Gray
  dim: chalk.hex("#52525B"), // Dark gray
  white: chalk.visible, // No color styling - works on both light/dark terminals, supports .bold chaining
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

// Legacy LOGO removed - replaced by chrome gradient logo in createProfessionalHeader()

// Compact logo for smaller screens
export const LOGO_COMPACT = `
  ${colors.primary("CC")}${colors.secondary("gather")} ${colors.muted("- Proof of your Claude Code dedication")}
`;

// Taglines
export const TAGLINE = colors.muted("          Proof of your Claude Code dedication");
export const SLOGAN = colors.dim("                Track. Prove. Rise.");

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

// Chrome font character map (cfonts "chrome" style - double-line box characters)
const CHROME_FONT: Record<string, [string, string, string]> = {
  C: ["╔═╗", "║  ", "╚═╝"],
  G: ["╔═╗", "║ ╦", "╚═╝"],
  A: ["╔═╗", "╠═╣", "╩ ╩"],
  T: ["╔╦╗", " ║ ", " ╩ "],
  H: ["╦ ╦", "╠═╣", "╩ ╩"],
  E: ["╔═╗", "║╣ ", "╚═╝"],
  R: ["╦═╗", "╠╦╝", "╩╚═"],
};

// Coral→Orange gradient interpolation (#DA7756 → #F7931E)
function interpolateHex(t: number): string {
  const r = Math.round(218 + 29 * t);
  const g = Math.round(119 + 28 * t);
  const b = Math.round(86 - 56 * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// Render "CCGATHER" in chrome font with coral→orange gradient
function renderChromeGradientLogo(): [string, string, string] {
  const word = "CCGATHER";
  const rows: [string[], string[], string[]] = [[], [], []];
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    const glyph = CHROME_FONT[ch];
    if (!glyph) continue;
    const color = chalk.hex(interpolateHex(i / (word.length - 1)));
    for (let row = 0; row < 3; row++) {
      if (rows[row].length > 0) rows[row].push(color(" "));
      rows[row].push(color(glyph[row]));
    }
  }
  return [rows[0].join(""), rows[1].join(""), rows[2].join("")];
}

// Pad content line to exact HEADER_WIDTH (right-pad with spaces)
function padLine(content: string): string {
  const w = getDisplayWidth(content);
  return content + " ".repeat(Math.max(0, HEADER_WIDTH - w));
}

// Center text within width
function centerText(text: string, width: number): string {
  const len = getDisplayWidth(text);
  const pad = width - len;
  return (
    " ".repeat(Math.max(0, Math.floor(pad / 2))) +
    text +
    " ".repeat(Math.max(0, pad - Math.floor(pad / 2)))
  );
}

// Right-align text within width
function _rightAlignText(text: string, width: number): string {
  const len = getDisplayWidth(text);
  const pad = width - len;
  return " ".repeat(Math.max(0, pad)) + text;
}

// Create professional boxed header (chrome font gradient logo)
export function createProfessionalHeader(): string[] {
  const lines: string[] = [];
  const v = boxRound.vertical;
  const h = boxRound.horizontal;
  const dim = colors.dim;

  lines.push(dim(`  ${boxRound.topLeft}${h.repeat(HEADER_WIDTH)}${boxRound.topRight}`));

  // Empty line above logo for breathing room
  lines.push(dim(`  ${v}`) + padLine("") + dim(v));

  // Chrome gradient logo - "CCGATHER" (8 chars × 3 width + 7 gaps = 31 display chars)
  // Center within 46: left 7 + 31 content + right 8 = 46 (extra 1 right for odd split)
  const logoRows = renderChromeGradientLogo();
  const logoPadLeft = 7;
  const logoPadRight = HEADER_WIDTH - logoPadLeft - 31; // = 8
  for (const row of logoRows) {
    lines.push(dim(`  ${v}`) + " ".repeat(logoPadLeft) + row + " ".repeat(logoPadRight) + dim(v));
  }

  // Version right-aligned (2-space padding from right edge)
  const versionStr = `v${VERSION}`;
  const versionPad = HEADER_WIDTH - getDisplayWidth(versionStr) - 2;
  lines.push(dim(`  ${v}`) + " ".repeat(Math.max(0, versionPad)) + dim(versionStr) + "  " + dim(v));

  lines.push(dim(`  ${boxRound.leftT}${h.repeat(HEADER_WIDTH)}${boxRound.rightT}`));
  lines.push(
    dim(`  ${v}`) +
      padLine(centerText(colors.muted("Proof of your Claude Code dedication"), HEADER_WIDTH)) +
      dim(v)
  );
  lines.push(
    dim(`  ${v}`) + padLine(centerText(colors.dim("Track · Prove · Rise"), HEADER_WIDTH)) + dim(v)
  );
  lines.push(dim(`  ${v}`) + padLine("") + dim(v));

  // Bottom border with clickable ccgather.com link
  const siteLabel = " 🌐 ccgather.com ";
  const siteLink = hyperlink(colors.secondary(siteLabel), "https://ccgather.com");
  const siteLabelWidth = getDisplayWidth(siteLabel);
  const leftDashes = 13;
  const rightDashes = HEADER_WIDTH - leftDashes - siteLabelWidth;
  lines.push(
    dim(`  ${boxRound.bottomLeft}${h.repeat(leftDashes)}`) +
      siteLink +
      dim(`${h.repeat(Math.max(0, rightDashes))}${boxRound.bottomRight}`)
  );

  return lines;
}

// Create a box around content
export function createBox(lines: string[], width: number = 47): string {
  const paddedLines = lines.map((line) => {
    const visibleLength = getDisplayWidth(line);
    const padding = width - 2 - visibleLength;
    return `${box.vertical} ${line}${" ".repeat(Math.max(0, padding))} ${box.vertical}`;
  });

  const top = colors.dim(`  ${box.topLeft}${box.horizontal.repeat(width)}${box.topRight}`);
  const bottom = colors.dim(`  ${box.bottomLeft}${box.horizontal.repeat(width)}${box.bottomRight}`);

  return [top, ...paddedLines.map((l) => colors.dim("  ") + l), bottom].join("\n");
}

// Animated box - prints line by line with delay
export async function printAnimatedBox(
  lines: string[],
  width: number = 47,
  lineDelay: number = 60
): Promise<void> {
  const top = colors.dim(`  ${box.topLeft}${box.horizontal.repeat(width)}${box.topRight}`);
  const bottom = colors.dim(`  ${box.bottomLeft}${box.horizontal.repeat(width)}${box.bottomRight}`);

  console.log(top);
  await sleep(lineDelay / 2);

  for (const line of lines) {
    const visibleLength = getDisplayWidth(line);
    const padding = width - 2 - visibleLength;
    const paddedLine = `${box.vertical} ${line}${" ".repeat(Math.max(0, padding))} ${box.vertical}`;
    console.log(colors.dim("  ") + paddedLine);
    await sleep(lineDelay);
  }

  console.log(bottom);
}

// Print lines with animation delay
export async function printAnimatedLines(
  lines: string[],
  lineDelay: number = 50,
  indent: string = "     "
): Promise<void> {
  for (const line of lines) {
    console.log(`${indent}${line}`);
    await sleep(lineDelay);
  }
}

// Strip ANSI codes for length calculation (CSI sequences + OSC 8 hyperlinks)
function _stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]|\x1B\]8;;[^\x07]*\x07/g, "");
}

// Get display width with emoji correction
// Emojis may display differently across terminals
function getDisplayWidth(str: string): number {
  // Strip ANSI codes for accurate measurement
  const stripped = _stripAnsi(str);
  let width = stringWidth(stripped);

  // Count common emojis that may need width correction
  // These emojis are typically displayed as 2 chars width in terminals
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|✦/gu;
  const emojis = stripped.match(emojiRegex);
  if (emojis) {
    // Adjust width: string-width may count as 1, but terminal shows as 2
    for (const emoji of emojis) {
      const emojiWidth = stringWidth(emoji);
      if (emojiWidth === 1) {
        width += 1; // Add 1 to make it 2
      }
    }
  }

  return width;
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

// Format cost with K/M/B abbreviations
export function formatCost(cost: number): string {
  if (cost >= 1_000_000_000) return `$${(cost / 1_000_000_000).toFixed(2)}B`;
  if (cost >= 1_000_000) return `$${(cost / 1_000_000).toFixed(2)}M`;
  if (cost >= 1_000) return `$${(cost / 1_000).toFixed(2)}K`;
  return `$${cost.toFixed(2)}`;
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

// Create welcome message (no box - simplified)
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
  // Simple welcome message only - no box, detailed stats shown after scan
  return `  👋 ${colors.white.bold(`Welcome back, ${user.username}!`)}`;
}

// Convert country code to display format
// Using text code instead of flag emoji for consistent terminal width
export function countryCodeToFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "🌐";
  return countryCode.toUpperCase();
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
export function printHeader(_version: string): void {
  const headerLines = createProfessionalHeader();
  for (const line of headerLines) {
    console.log(line);
  }
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

// ============================================
// Plan Detection UI Components
// ============================================

// Plan detection section header
export function planDetectionSection(title: string, icon: string = "🔍"): string {
  return `\n${colors.dim("─".repeat(50))}\n  ${icon} ${colors.white.bold(title)}\n${colors.dim("─".repeat(50))}`;
}

// Max plan verified message (Opus detected)
export function maxVerifiedMessage(opusModels: string[]): string[] {
  const modelList =
    opusModels.length > 2
      ? `${opusModels.slice(0, 2).join(", ")} +${opusModels.length - 2} more`
      : opusModels.join(", ");

  return [
    ``,
    `  ${success("Max plan verified")}`,
    ``,
    `    ${colors.muted("💡 Reason:")} Opus model usage detected`,
    `       ${colors.dim("Models:")} ${colors.cyan(modelList)}`,
    ``,
    `    ${colors.dim("All data will be recorded under Max league.")}`,
    ``,
  ];
}

// Past data warning message (no Opus, older than 30 days)
export function pastDataWarningMessage(oldestDate: string, daysSince: number): string[] {
  return [
    ``,
    `  ${warning(`Data older than 30 days detected`)}`,
    ``,
    `    ${colors.muted("Oldest record:")} ${colors.white(oldestDate)} ${colors.dim(`(${daysSince} days ago)`)}`,
    `    ${colors.muted("Opus usage:")} ${colors.dim("Not found")}`,
    ``,
    `    ${colors.dim("→ Max plan cannot be verified automatically.")}`,
    ``,
  ];
}

// Trust message for user selection
export function trustMessage(): string[] {
  return [
    `  ${colors.muted("💡 For fair league placement, we trust your choice.")}`,
    `     ${colors.dim("Tip: Submit regularly for accurate tracking!")}`,
    ``,
  ];
}

// Current plan auto-apply message
export function currentPlanMessage(plan: string): string[] {
  const planColor = plan === "max" ? colors.max : plan === "pro" ? colors.pro : colors.free;
  const planBadge = plan === "max" ? "🚀 MAX" : plan === "pro" ? "⚡ PRO" : "⚪ FREE";

  return [
    ``,
    `  ${colors.muted("📋 Plan:")} ${planColor(planBadge)}`,
    `    ${colors.dim("Current plan from credentials will be used.")}`,
    ``,
  ];
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
  iterations: number = 12,
  previousRank?: number | null
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

  // Calculate rank change
  let changeText = "";
  if (previousRank && previousRank !== finalRank) {
    const change = previousRank - finalRank; // positive = improved
    if (change > 0) {
      changeText = ` ${colors.success(`↑${change}`)}`;
    } else if (change < 0) {
      changeText = ` ${colors.error(`↓${Math.abs(change)}`)}`;
    }
  }

  // Final reveal with color and rank change
  process.stdout.write(
    `\r     ${medal} ${colors.muted(label)} ${colors.primary.bold(`#${finalRank}`)}${changeText}    \n`
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

// Welcome message (no box - simplified)
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
  // Simple welcome message only - no box, detailed stats shown after scan
  console.log(`  👋 ${colors.white.bold(`Welcome back, ${user.username}!`)}`);
  await sleep(50);
}
