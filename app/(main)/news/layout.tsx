import { Metadata } from "next";

export const metadata: Metadata = {
  title: "News & Resources",
  description:
    "Tips, guides, and updates for Claude Code developers. Learn token-saving patterns, best practices, and stay updated with the latest Claude Code features.",
  keywords: [
    "Claude Code tips",
    "Claude Code tutorial",
    "Claude Code guide",
    "token optimization",
    "AI coding assistant",
    "Claude Code best practices",
    "CCgather news",
  ],
  openGraph: {
    title: "News & Resources - CCgather",
    description: "Tips, guides, and updates for Claude Code developers.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "News & Resources - CCgather",
    description: "Tips, guides, and updates for Claude Code developers.",
  },
};

export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
