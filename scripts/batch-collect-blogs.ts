/**
 * Batch collection script for Claude blog articles
 * Run with: npx tsx scripts/batch-collect-blogs.ts
 *
 * Prerequisites:
 * 1. pnpm dev (로컬 서버 실행)
 * 2. .env.local 파일에 환경 변수 설정 필요
 */

import "dotenv/config";

const BLOG_ARTICLES = [
  {
    date: "Jan 12, 2026",
    category: "Product announcements",
    title: "Cowork: Claude Code for the rest of your work",
    url: "https://claude.com/blog/cowork-research-preview",
  },
  {
    date: "Dec 19, 2025",
    category: "Agents",
    title: "Extending Claude's capabilities with skills and MCP servers",
    url: "https://claude.com/blog/extending-claude-capabilities-with-skills-mcp-servers",
  },
  {
    date: "Dec 18, 2025",
    category: "Product announcements",
    title: "Skills for organizations, partners, the ecosystem",
    url: "https://claude.com/blog/organization-skills-and-directory",
  },
  {
    date: "Dec 12, 2025",
    category: "Enterprise AI",
    title: "Making Claude a better electrical engineer",
    url: "https://claude.com/blog/making-claude-a-better-electrical-engineer",
  },
  {
    date: "Dec 11, 2025",
    category: "Coding",
    title: "Claude Code power user customization: How to configure hooks",
    url: "https://claude.com/blog/how-to-configure-hooks",
  },
  {
    date: "Dec 9, 2025",
    category: "Enterprise AI",
    title: "How enterprises are building AI agents in 2026",
    url: "https://claude.com/blog/how-enterprises-are-building-ai-agents-in-2026",
  },
  {
    date: "Dec 8, 2025",
    category: "Enterprise AI",
    title: "How Anthropic's legal team cut review times from days to hours with Claude",
    url: "https://claude.com/blog/how-anthropic-uses-claude-legal",
  },
  {
    date: "Dec 8, 2025",
    category: "Product announcements",
    title: "Claude Code and Slack",
    url: "https://claude.com/blog/claude-code-and-slack",
  },
  {
    date: "Dec 2, 2025",
    category: "Coding",
    title: "Building Skills for Claude Code: Automating your procedural knowledge",
    url: "https://claude.com/blog/building-skills-for-claude-code",
  },
  {
    date: "Dec 1, 2025",
    category: "Coding",
    title: "What are the key benefits of transitioning to agentic coding for software development?",
    url: "https://claude.com/blog/key-benefits-transitioning-agentic-coding",
  },
  {
    date: "Nov 25, 2025",
    category: "Coding",
    title: "Using CLAUDE.md files: Customizing Claude Code for your codebase",
    url: "https://claude.com/blog/using-claude-md-files",
  },
  {
    date: "Nov 20, 2025",
    category: "Product announcements",
    title: "What's new in Claude: Turning Claude into your thinking partner",
    url: "https://claude.com/blog/your-thinking-partner",
  },
  {
    date: "Nov 19, 2025",
    category: "Coding",
    title: "How to create Skills: Key steps, limitations, and examples",
    url: "https://claude.com/blog/how-to-create-skills-key-steps-limitations-and-examples",
  },
  {
    date: "Nov 17, 2025",
    category: "Coding",
    title: "How three YC startups built their companies with Claude Code",
    url: "https://claude.com/blog/building-companies-with-claude-code",
  },
  {
    date: "Nov 14, 2025",
    category: "Product announcements",
    title: "Structured outputs on the Claude Developer Platform",
    url: "https://claude.com/blog/structured-outputs-on-the-claude-developer-platform",
  },
  {
    date: "Nov 13, 2025",
    category: "Agents",
    title: "Skills explained: How Skills compares to prompts, Projects, MCP, and subagents",
    url: "https://claude.com/blog/skills-explained",
  },
  {
    date: "Nov 12, 2025",
    category: "Coding",
    title: "Improving frontend design through Skills",
    url: "https://claude.com/blog/improving-frontend-design-through-skills",
  },
  {
    date: "Nov 10, 2025",
    category: "Agents",
    title: "Best practices for prompt engineering",
    url: "https://claude.com/blog/best-practices-for-prompt-engineering",
  },
  {
    date: "Nov 3, 2025",
    category: "Enterprise AI",
    title: "Building AI agents for startups",
    url: "https://claude.com/blog/building-ai-agents-for-startups",
  },
  {
    date: "Oct 31, 2025",
    category: "Agents",
    title: "What is Model Context Protocol? Connect AI to your world",
    url: "https://claude.com/blog/what-is-model-context-protocol",
  },
  {
    date: "Oct 30, 2025",
    category: "Coding",
    title: "Introduction to agentic coding",
    url: "https://claude.com/blog/introduction-to-agentic-coding",
  },
  {
    date: "Oct 30, 2025",
    category: "Agents",
    title: "Building AI agents for healthcare and life sciences",
    url: "https://claude.com/blog/building-ai-agents-for-healthcare-and-life-sciences",
  },
  {
    date: "Oct 30, 2025",
    category: "Agents",
    title: "Building AI agents for financial services",
    url: "https://claude.com/blog/building-ai-agents-in-financial-services",
  },
  {
    date: "Oct 30, 2025",
    category: "Enterprise AI",
    title: "How Brex improves code quality and productivity with Claude Code",
    url: "https://claude.com/blog/how-brex-improves-code-quality-and-productivity-with-claude-code",
  },
  {
    date: "Oct 28, 2025",
    category: "Coding",
    title: "Fix software bugs faster with Claude",
    url: "https://claude.com/blog/fix-software-bugs-faster-with-claude",
  },
  {
    date: "Oct 27, 2025",
    category: "Coding",
    title: "How to integrate APIs seamlessly",
    url: "https://claude.com/blog/how-to-integrate-apis-seamlessly",
  },
  {
    date: "Oct 20, 2025",
    category: "Product announcements",
    title: "Claude Code on the web",
    url: "https://claude.com/blog/claude-code-on-the-web",
  },
  {
    date: "Oct 16, 2025",
    category: "Product announcements",
    title: "Claude and your productivity platforms",
    url: "https://claude.com/blog/claude-and-your-productivity-platforms",
  },
  {
    date: "Oct 16, 2025",
    category: "Product announcements",
    title: "Introducing Agent Skills",
    url: "https://claude.com/blog/introducing-agent-skills",
  },
  {
    date: "Oct 15, 2025",
    category: "Coding",
    title: "How to scale agentic coding across your engineering organization",
    url: "https://claude.com/blog/how-to-scale-agentic-coding-across-your-engineering-organization",
  },
  {
    date: "Oct 10, 2025",
    category: "Coding",
    title: "Build responsive web layouts",
    url: "https://claude.com/blog/build-responsive-web-layouts",
  },
  {
    date: "Oct 9, 2025",
    category: "Product announcements",
    title: "Customize Claude Code with plugins",
    url: "https://claude.com/blog/customize-claude-code-with-plugins",
  },
  {
    date: "Oct 8, 2025",
    category: "Coding",
    title: "Beyond permission prompts: making Claude Code more secure and autonomous",
    url: "https://claude.com/blog/beyond-permission-prompts-making-claude-code-more-secure-and-autonomous",
  },
  {
    date: "Oct 6, 2025",
    category: "Coding",
    title: "Optimize code performance quickly",
    url: "https://claude.com/blog/optimize-code-performance-quickly",
  },
  {
    date: "Oct 6, 2025",
    category: "Coding",
    title: "Identifying security vulnerabilities in your code",
    url: "https://claude.com/blog/identifying-security-vulnerabilities-in-your-code",
  },
  {
    date: "Oct 1, 2025",
    category: "Enterprise AI",
    title: "How enterprises are driving AI transformation with Claude",
    url: "https://claude.com/blog/how-enterprises-are-driving-ai-transformation-with-claude",
  },
  {
    date: "Oct 1, 2025",
    category: "Product announcements",
    title: "Claude and Slack",
    url: "https://claude.com/blog/claude-and-slack",
  },
  {
    date: "Sep 29, 2025",
    category: "Product announcements",
    title: "Managing context on the Claude Developer Platform",
    url: "https://claude.com/blog/managing-context-on-the-claude-developer-platform",
  },
  {
    date: "Sep 24, 2025",
    category: "Product announcements",
    title: "Claude is now available in Microsoft 365 Copilot",
    url: "https://claude.com/blog/claude-is-now-available-in-microsoft-365-copilot",
  },
  {
    date: "Sep 11, 2025",
    category: "Product announcements",
    title: "Bringing memory to Claude",
    url: "https://claude.com/blog/bringing-memory-to-claude",
  },
  {
    date: "Sep 9, 2025",
    category: "Product announcements",
    title: "Claude can now create and edit files",
    url: "https://claude.com/blog/claude-can-now-create-and-edit-files",
  },
  {
    date: "Aug 25, 2025",
    category: "Product announcements",
    title: "Piloting Claude in Chrome",
    url: "https://claude.com/blog/piloting-claude-in-chrome",
  },
  {
    date: "Aug 20, 2025",
    category: "Product announcements",
    title: "Claude Code and new admin controls for business plans",
    url: "https://claude.com/blog/claude-code-and-new-admin-controls-for-business-plans",
  },
  {
    date: "Aug 14, 2025",
    category: "Product announcements",
    title: "Prompt caching with Claude",
    url: "https://claude.com/blog/prompt-caching-with-claude",
  },
  {
    date: "Aug 12, 2025",
    category: "Product announcements",
    title: "Claude Sonnet 4 now supports 1M tokens of context",
    url: "https://claude.com/blog/claude-sonnet-4-now-supports-1m-tokens-of-context",
  },
  {
    date: "Aug 6, 2025",
    category: "Product announcements",
    title: "Automate security reviews with Claude Code",
    url: "https://claude.com/blog/automate-security-reviews-with-claude-code",
  },
  {
    date: "Jul 25, 2025",
    category: "Product announcements",
    title: "Build and share AI-powered apps with Claude",
    url: "https://claude.com/blog/build-and-share-ai-powered-apps-with-claude",
  },
  {
    date: "Jul 24, 2025",
    category: "Enterprise AI",
    title: "How Anthropic teams use Claude Code",
    url: "https://claude.com/blog/how-anthropic-teams-use-claude-code",
  },
  {
    date: "Jul 14, 2025",
    category: "Product announcements",
    title: "Discover tools that work with Claude",
    url: "https://claude.com/blog/discover-tools-that-work-with-claude",
  },
  {
    date: "Jun 25, 2025",
    category: "Product announcements",
    title: "Turn ideas into interactive AI-powered apps",
    url: "https://claude.com/blog/turn-ideas-into-interactive-ai-powered-apps",
  },
  {
    date: "Jun 23, 2025",
    category: "Product announcements",
    title: "Introducing Citations on the Anthropic API",
    url: "https://claude.com/blog/introducing-citations-on-the-anthropic-api",
  },
  {
    date: "Jun 18, 2025",
    category: "Product announcements",
    title: "Remote MCP support in Claude Code",
    url: "https://claude.com/blog/remote-mcp-support-in-claude-code",
  },
  {
    date: "May 22, 2025",
    category: "Product announcements",
    title: "New capabilities for building agents on the Anthropic API",
    url: "https://claude.com/blog/new-capabilities-for-building-agents-on-the-anthropic-api",
  },
  {
    date: "May 7, 2025",
    category: "Product announcements",
    title: "Introducing web search on the Anthropic API",
    url: "https://claude.com/blog/introducing-web-search-on-the-anthropic-api",
  },
  {
    date: "May 1, 2025",
    category: "Product announcements",
    title: "Claude can now connect to your world",
    url: "https://claude.com/blog/claude-can-now-connect-to-your-world",
  },
  {
    date: "Apr 15, 2025",
    category: "Product announcements",
    title: "Claude takes research to new places",
    url: "https://claude.com/blog/claude-takes-research-to-new-places",
  },
  {
    date: "Apr 9, 2025",
    category: "Product announcements",
    title: "Introducing the Max Plan",
    url: "https://claude.com/blog/introducing-the-max-plan",
  },
  {
    date: "Apr 2, 2025",
    category: "Product announcements",
    title: "Claude on Google Cloud's Vertex AI: FedRAMP High and IL2 Authorized",
    url: "https://claude.com/blog/claude-on-google-cloud-vertex-ai-fedramp-high-and-il2-authorized",
  },
  {
    date: "Mar 20, 2025",
    category: "Product announcements",
    title: "Claude can now search the web",
    url: "https://claude.com/blog/claude-can-now-search-the-web",
  },
  {
    date: "Mar 13, 2025",
    category: "Product announcements",
    title: "Token-saving updates on the Anthropic API",
    url: "https://claude.com/blog/token-saving-updates-on-the-anthropic-api",
  },
  {
    date: "Mar 6, 2025",
    category: "(미분류)",
    title: "Get to production faster with the upgraded Anthropic Console",
    url: "https://claude.com/blog/get-to-production-faster-with-the-upgraded-anthropic-console",
  },
  {
    date: "Dec 3, 2024",
    category: "Product announcements",
    title: "Claude 3.5 Haiku on AWS Trainium2 and model distillation in Amazon Bedrock",
    url: "https://claude.com/blog/claude-35-haiku-on-aws-trainium2-and-model-distillation-in-amazon-bedrock",
  },
  {
    date: "Nov 26, 2024",
    category: "Product announcements",
    title: "Tailor Claude's responses to your personal style",
    url: "https://claude.com/blog/tailor-claude-responses-to-your-personal-style",
  },
  {
    date: "Oct 24, 2024",
    category: "Product announcements",
    title: "Introducing the analysis tool in Claude.ai",
    url: "https://claude.com/blog/introducing-the-analysis-tool-in-claude-ai",
  },
  {
    date: "Oct 14, 2024",
    category: "Product announcements",
    title: "Improve your prompts in the developer console",
    url: "https://claude.com/blog/improve-your-prompts-in-the-developer-console",
  },
  {
    date: "Oct 8, 2024",
    category: "Product announcements",
    title: "Introducing the Message Batches API",
    url: "https://claude.com/blog/introducing-the-message-batches-api",
  },
  {
    date: "Sep 10, 2024",
    category: "Product announcements",
    title: "Claude for Enterprise",
    url: "https://claude.com/blog/claude-for-enterprise",
  },
  {
    date: "Sep 10, 2024",
    category: "Product announcements",
    title: "Workspaces in the Anthropic API Console",
    url: "https://claude.com/blog/workspaces-in-the-anthropic-api-console",
  },
  {
    date: "Aug 27, 2024",
    category: "Product announcements",
    title: "Artifacts are now generally available",
    url: "https://claude.com/blog/artifacts-are-now-generally-available",
  },
  {
    date: "Jul 16, 2024",
    category: "Product announcements",
    title: "Claude Android app",
    url: "https://claude.com/blog/claude-android-app",
  },
  {
    date: "Jul 10, 2024",
    category: "Product announcements",
    title: "Fine-tune Claude 3 Haiku in Amazon Bedrock",
    url: "https://claude.com/blog/fine-tune-claude-3-haiku-in-amazon-bedrock",
  },
  {
    date: "Jul 9, 2024",
    category: "Product announcements",
    title: "Evaluate prompts in the developer console",
    url: "https://claude.com/blog/evaluate-prompts-in-the-developer-console",
  },
  {
    date: "May 30, 2024",
    category: "Product announcements",
    title: "Claude can now use tools",
    url: "https://claude.com/blog/claude-can-now-use-tools",
  },
  {
    date: "May 20, 2024",
    category: "Product announcements",
    title: "Generate better prompts in the developer console",
    url: "https://claude.com/blog/generate-better-prompts-in-the-developer-console",
  },
  {
    date: "May 1, 2024",
    category: "Product announcements",
    title: "Introducing the Claude Team plan and iOS app",
    url: "https://claude.com/blog/introducing-the-claude-team-plan-and-ios-app",
  },
  {
    date: "Dec 6, 2023",
    category: "Product announcements",
    title: "Long context prompting for Claude 2.1",
    url: "https://claude.com/blog/long-context-prompting-for-claude-2-1",
  },
  {
    date: "Sep 28, 2023",
    category: "Product announcements",
    title: "Claude on Amazon Bedrock now available to every AWS customer",
    url: "https://claude.com/blog/claude-on-amazon-bedrock-now-available-to-every-aws-customer",
  },
  {
    date: "Aug 23, 2023",
    category: "Product announcements",
    title: "Claude 2 on Amazon Bedrock",
    url: "https://claude.com/blog/claude-2-on-amazon-bedrock",
  },
];

// Category mapping to our system
function mapCategory(blogCategory: string): string {
  const mapping: Record<string, string> = {
    "Product announcements": "announcement",
    Coding: "engineering",
    Agents: "engineering",
    "Enterprise AI": "use_cases",
    "(미분류)": "etc",
  };
  return mapping[blogCategory] || "etc";
}

// Delay helper
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Collect single article via API
async function collectArticle(
  url: string,
  category: string,
  index: number,
  total: number
): Promise<boolean> {
  const apiUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  console.log(`\n[${index + 1}/${total}] Collecting: ${url}`);
  console.log(`  Category: ${category}`);

  try {
    const response = await fetch(`${apiUrl}/api/admin/collect-single`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        category,
        force: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`  ❌ Failed: ${response.status} - ${error}`);
      return false;
    }

    const result = await response.json();

    if (result.error) {
      console.error(`  ❌ Error: ${result.error}`);
      return false;
    }

    if (result.skipped) {
      console.log(`  ⏭️ Skipped: Already exists`);
      return true;
    }

    console.log(`  ✅ Success: ${result.title || "Collected"}`);
    return true;
  } catch (error) {
    console.error(`  ❌ Exception:`, error);
    return false;
  }
}

// Main batch collection
async function main() {
  console.log("=".repeat(60));
  console.log("Claude Blog Batch Collection");
  console.log(`Total articles: ${BLOG_ARTICLES.length}`);
  console.log("=".repeat(60));

  const DELAY_BETWEEN_REQUESTS = 30000; // 30 seconds between requests
  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
  };

  // Process oldest first (reverse order)
  const articlesToProcess = [...BLOG_ARTICLES].reverse();

  for (let i = 0; i < articlesToProcess.length; i++) {
    const article = articlesToProcess[i]!;
    const category = mapCategory(article.category);

    const success = await collectArticle(article.url, category, i, articlesToProcess.length);

    if (success) {
      results.success++;
    } else {
      results.failed++;
    }

    // Add delay between requests (except for the last one)
    if (i < articlesToProcess.length - 1) {
      console.log(`\n⏳ Waiting ${DELAY_BETWEEN_REQUESTS / 1000}s before next request...`);
      await delay(DELAY_BETWEEN_REQUESTS);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Batch Collection Complete");
  console.log(`  ✅ Success: ${results.success}`);
  console.log(`  ❌ Failed: ${results.failed}`);
  console.log("=".repeat(60));
}

main().catch(console.error);
