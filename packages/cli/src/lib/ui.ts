import chalk from "chalk";

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

// Box drawing characters
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

// Get level info
export function getLevelInfo(tokens: number): {
  level: number;
  name: string;
  icon: string;
  color: typeof colors.primary;
} {
  const levels = [
    { min: 0, level: 1, name: "Novice", icon: "🌱", color: colors.dim },
    { min: 100_000, level: 2, name: "Apprentice", icon: "📚", color: colors.muted },
    { min: 500_000, level: 3, name: "Journeyman", icon: "⚡", color: colors.cyan },
    { min: 1_000_000, level: 4, name: "Expert", icon: "💎", color: colors.pro },
    { min: 5_000_000, level: 5, name: "Master", icon: "🔥", color: colors.warning },
    { min: 10_000_000, level: 6, name: "Grandmaster", icon: "👑", color: colors.max },
    { min: 50_000_000, level: 7, name: "Legend", icon: "🌟", color: colors.primary },
    { min: 100_000_000, level: 8, name: "Mythic", icon: "🏆", color: colors.secondary },
  ];

  for (let i = levels.length - 1; i >= 0; i--) {
    if (tokens >= levels[i].min) {
      return levels[i];
    }
  }
  return levels[0];
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

// Link display
export function link(url: string): string {
  return colors.cyan.underline(url);
}

// Highlight text
export function highlight(text: string): string {
  return colors.primary.bold(text);
}
