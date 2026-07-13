export const SEASON_TAGLINES = [
  "the first names ever carved",
  "no one has ever won this before",
  "history is written by whoever ships",
  "someone's about to become permanent",
  "the scoreboard forgets. stone doesn't.",
  "one month. three names. forever.",
  "the leaderboard resets. this doesn't.",
] as const;

export const SEASON_SUBLINES = [
  "When the clock hits zero, the leaders are carved into the Hall of Fame. No resets, no takebacks.",
  "Every token you sync moves the needle. When time runs out, the top names stay up forever.",
  "Nobody remembers who was second last month. Except this page, which remembers everything.",
  "The Hall of Fame has no delete button. Whoever leads when the timer dies stays there.",
  "You have weeks to matter. The record has centuries to remind everyone that you did.",
  "Three champions get carved. Everyone else gets next season.",
] as const;

export const CROWN_LABELS = [
  "👑 Holding the crown",
  "👑 Wearing it well",
  "👑 Sitting on the throne",
  "👑 Nobody's caught them yet",
] as const;

export const FLAG_LABELS = [
  "🚩 Flag on the hill",
  "🚩 Owns the hill",
  "🚩 Defending the summit",
  "🚩 Currently unbeaten",
] as const;

export const COUNTDOWN_LABELS = [
  "till carved in stone",
  "till the names lock in",
  "before it's permanent",
  "till someone becomes history",
] as const;

export const HOF_CAPTIONS = [
  "carved in stone, never erased",
  "they were here. it's official.",
  "the permanent record",
  "no takebacks, no edits",
] as const;

export function pickRandom<T>(pool: readonly T[]): T {
  return pool[Math.floor(Math.random() * pool.length)]!;
}
