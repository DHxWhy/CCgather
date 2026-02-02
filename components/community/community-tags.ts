import { MessageCircle, Sparkles, Lightbulb, type LucideIcon } from "lucide-react";

// ===========================================
// Community Filter Tags
// General (☕) + Showcase (✨) + Help (💡)
// ===========================================

// Board types
export type CommunityFilterTag = "general" | "showcase" | "help" | "all";

export interface CommunityTag {
  id: CommunityFilterTag;
  label: string;
  emoji: string; // Emoji for compact display
  description: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

export const COMMUNITY_FILTER_TAGS: CommunityTag[] = [
  {
    id: "general",
    label: "General",
    emoji: "☕",
    description: "Chat about anything",
    icon: MessageCircle,
    color: "text-[var(--color-claude-coral)]",
    bgColor: "bg-[var(--color-claude-coral)]/10",
  },
  {
    id: "showcase",
    label: "Showcase",
    emoji: "✨",
    description: "Show your projects",
    icon: Sparkles,
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
  },
  {
    id: "help",
    label: "Help",
    emoji: "💡",
    description: "Ask for help",
    icon: Lightbulb,
    color: "text-amber-400",
    bgColor: "bg-amber-400/10",
  },
];

// Helper to get tag info by id
export function getTagById(id: string): CommunityTag | undefined {
  return COMMUNITY_FILTER_TAGS.find((tag) => tag.id === id);
}

// Helper to get emoji by tab id (for FeedCard display)
export function getTagEmoji(tab: string | null | undefined): string {
  if (!tab) return "☕"; // Default to General
  const tag = getTagById(tab);
  return tag?.emoji || "☕";
}
