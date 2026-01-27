import { MessageCircle, Target, type LucideIcon } from "lucide-react";

// ===========================================
// Community Filter Tags
// Vibes (바이브) + Can U? (챌린지/의뢰) + extensible for future tabs
// ===========================================

// Extensible type for future tabs (showcase, questions, etc.)
export type CommunityFilterTag = "vibes" | "canu" | "showcase" | "questions" | "all";

export interface CommunityTag {
  id: CommunityFilterTag;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

export const COMMUNITY_FILTER_TAGS: CommunityTag[] = [
  {
    id: "vibes",
    label: "Vibes",
    description: "Share your vibes",
    icon: MessageCircle,
    color: "text-[var(--color-claude-coral)]",
    bgColor: "bg-[var(--color-claude-coral)]/10",
  },
  {
    id: "canu",
    label: "Can U?",
    description: "Challenge the community",
    icon: Target,
    color: "text-[var(--color-accent-cyan)]",
    bgColor: "bg-[var(--color-accent-cyan)]/10",
  },
];
