import { Sparkles, Cpu, Wrench, Globe, type LucideIcon } from "lucide-react";

// Available filter tags
export const NEWS_FILTER_TAGS = [
  {
    id: "all",
    label: "All",
    icon: Globe,
    description: "All news",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
  {
    id: "claude",
    label: "Claude",
    icon: Sparkles,
    description: "Claude & Anthropic",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
  },
  {
    id: "dev-tools",
    label: "Dev Tools",
    icon: Wrench,
    description: "Developer tools",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
  },
  {
    id: "industry",
    label: "Industry",
    icon: Cpu,
    description: "AI industry news",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
  },
] as const;

export type NewsFilterTag = (typeof NEWS_FILTER_TAGS)[number]["id"];

export interface NewsTagConfig {
  id: NewsFilterTag;
  label: string;
  icon: LucideIcon;
  description: string;
  color: string;
  bgColor: string;
}
