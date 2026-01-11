// News & Updates Content Data
// SEO-optimized content structure for Claude Code news and updates
// Language: English (Global Service)

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  source?: string;
  sourceUrl?: string;
  publishedAt: string;
}

export interface UpdatePost {
  slug: string;
  version: string;
  title: string;
  summary: string;
  publishedAt: string;
  content: UpdateContent[];
}

export interface UpdateContent {
  type: "heading" | "paragraph" | "feature" | "code" | "tip";
  content: string;
  language?: string;
}

// ===========================================
// News Articles (Claude Code Related News)
// ===========================================

export const NEWS_ARTICLES: NewsArticle[] = [
  {
    id: "anthropic-claude-code-launch",
    title: "Anthropic Launches Claude Code - A New Era of AI Coding Assistants",
    summary:
      "Anthropic has officially released Claude Code, an AI coding tool for developers. It runs directly in your terminal and helps with everything from writing code to debugging.",
    source: "TechCrunch",
    sourceUrl: "https://techcrunch.com",
    publishedAt: "2025-01-10",
  },
  {
    id: "claude-code-token-optimization",
    title: "How Developers Are Saving 40% on Claude Code Token Costs",
    summary:
      "The developer community is sharing effective ways to reduce token usage in Claude Code. Key strategies include using the --resume flag and leveraging .claudeignore files.",
    source: "Hacker News",
    sourceUrl: "https://news.ycombinator.com",
    publishedAt: "2025-01-08",
  },
  {
    id: "claude-code-vs-copilot",
    title: "Claude Code vs GitHub Copilot - Which AI Coding Tool Is Right for You?",
    summary:
      "A detailed comparison of two leading AI coding tools. Claude Code excels at complex refactoring tasks, while Copilot shines in code autocompletion.",
    source: "Dev.to",
    sourceUrl: "https://dev.to",
    publishedAt: "2025-01-05",
  },
];

// ===========================================
// Update Posts (Version Updates - Blog Style)
// ===========================================

export const UPDATE_POSTS: UpdatePost[] = [
  {
    slug: "v1-0-23-resume-flag",
    version: "v1.0.23",
    title: "Continue Your Conversations with --resume Flag",
    summary: "Pick up where you left off! Save tokens and time with persistent sessions.",
    publishedAt: "2025-01-10",
    content: [
      {
        type: "heading",
        content: "What's New in This Update?",
      },
      {
        type: "paragraph",
        content:
          "You can now continue your previous conversations with Claude Code! No more explaining your project from scratch every time you start a new session.",
      },
      {
        type: "feature",
        content:
          "🔄 --resume flag: Picks up your last conversation right where you left off. Started something yesterday? Continue it today!",
      },
      {
        type: "heading",
        content: "How to Use It",
      },
      {
        type: "paragraph",
        content: "Simply run this command in your terminal:",
      },
      {
        type: "code",
        content: "claude --resume",
        language: "bash",
      },
      {
        type: "paragraph",
        content:
          "For example, if you were working on a login feature yesterday and had to stop midway, just use --resume today and Claude will remember exactly where you were!",
      },
      {
        type: "tip",
        content:
          "💡 Token Saving Tip: Using this feature means you don't have to re-explain your project context each time. This can save you a significant amount of tokens!",
      },
    ],
  },
  {
    slug: "v1-0-22-token-display",
    version: "v1.0.22",
    title: "Real-Time Token Usage Display",
    summary: "See exactly how many tokens you're using as you work!",
    publishedAt: "2025-01-05",
    content: [
      {
        type: "heading",
        content: "What Are Tokens?",
      },
      {
        type: "paragraph",
        content:
          "Tokens are the units AI uses to measure text. Think of it like this: roughly 1 English word equals about 1-2 tokens. Every time you use Claude Code, you're using tokens - and tokens equal cost!",
      },
      {
        type: "feature",
        content:
          "📊 Token Usage Display: Now you can see how many tokens each conversation uses, right in your terminal.",
      },
      {
        type: "heading",
        content: "Why This Matters",
      },
      {
        type: "paragraph",
        content:
          "When you can see your usage, you can manage your costs better. You'll quickly learn which types of questions use more tokens and adjust accordingly.",
      },
      {
        type: "tip",
        content:
          "💡 Cost Saving Tip: Keep your questions focused and concise. Instead of long explanations, stick to the key points!",
      },
    ],
  },
  {
    slug: "v1-0-21-claudeignore",
    version: "v1.0.21",
    title: "Exclude Files with .claudeignore",
    summary: "Skip large folders like node_modules for faster, cheaper sessions!",
    publishedAt: "2025-01-01",
    content: [
      {
        type: "heading",
        content: "What is .claudeignore?",
      },
      {
        type: "paragraph",
        content:
          "If you've used Git, you know .gitignore. This is similar! .claudeignore tells Claude Code which files and folders to skip when analyzing your project.",
      },
      {
        type: "feature",
        content:
          "📁 .claudeignore file: Create this file in your project root, and Claude will ignore everything listed in it.",
      },
      {
        type: "heading",
        content: "Why You Need This",
      },
      {
        type: "paragraph",
        content:
          "Think about your node_modules folder - it contains thousands of files! If Claude reads all of them, you're wasting tokens on code you didn't even write. That's where .claudeignore comes in.",
      },
      {
        type: "heading",
        content: "How to Set It Up",
      },
      {
        type: "paragraph",
        content:
          "Create a file named .claudeignore in your project folder and add patterns like this:",
      },
      {
        type: "code",
        content: "node_modules/\n.git/\ndist/\nbuild/\n*.log\n.env",
        language: "text",
      },
      {
        type: "tip",
        content:
          "💡 Recommended: Always exclude node_modules, .git, dist, and build folders. This alone can save you 50%+ on token costs!",
      },
    ],
  },
];

// ===========================================
// Helper Functions
// ===========================================

export function getUpdateBySlug(slug: string): UpdatePost | undefined {
  return UPDATE_POSTS.find((post) => post.slug === slug);
}

export function getAllUpdateSlugs(): string[] {
  return UPDATE_POSTS.map((post) => post.slug);
}
