"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, CheckCircle, XCircle, SkipForward, Play, Square, X } from "lucide-react";

// Predefined Claude blog articles
const CLAUDE_BLOG_ARTICLES = [
  {
    date: "Jan 12, 2026",
    category: "announcement",
    title: "Cowork: Claude Code for the rest of your work",
    url: "https://claude.com/blog/cowork-research-preview",
  },
  {
    date: "Dec 19, 2025",
    category: "engineering",
    title: "Extending Claude's capabilities with skills and MCP servers",
    url: "https://claude.com/blog/extending-claude-capabilities-with-skills-mcp-servers",
  },
  {
    date: "Dec 18, 2025",
    category: "announcement",
    title: "Skills for organizations, partners, the ecosystem",
    url: "https://claude.com/blog/organization-skills-and-directory",
  },
  {
    date: "Dec 12, 2025",
    category: "use_cases",
    title: "Making Claude a better electrical engineer",
    url: "https://claude.com/blog/making-claude-a-better-electrical-engineer",
  },
  {
    date: "Dec 11, 2025",
    category: "engineering",
    title: "Claude Code power user customization: How to configure hooks",
    url: "https://claude.com/blog/how-to-configure-hooks",
  },
  {
    date: "Dec 9, 2025",
    category: "use_cases",
    title: "How enterprises are building AI agents in 2026",
    url: "https://claude.com/blog/how-enterprises-are-building-ai-agents-in-2026",
  },
  {
    date: "Dec 8, 2025",
    category: "use_cases",
    title: "How Anthropic's legal team cut review times from days to hours with Claude",
    url: "https://claude.com/blog/how-anthropic-uses-claude-legal",
  },
  {
    date: "Dec 8, 2025",
    category: "announcement",
    title: "Claude Code and Slack",
    url: "https://claude.com/blog/claude-code-and-slack",
  },
  {
    date: "Dec 2, 2025",
    category: "engineering",
    title: "Building Skills for Claude Code: Automating your procedural knowledge",
    url: "https://claude.com/blog/building-skills-for-claude-code",
  },
  {
    date: "Dec 1, 2025",
    category: "engineering",
    title: "What are the key benefits of transitioning to agentic coding for software development?",
    url: "https://claude.com/blog/key-benefits-transitioning-agentic-coding",
  },
  {
    date: "Nov 25, 2025",
    category: "engineering",
    title: "Using CLAUDE.md files: Customizing Claude Code for your codebase",
    url: "https://claude.com/blog/using-claude-md-files",
  },
  {
    date: "Nov 20, 2025",
    category: "announcement",
    title: "What's new in Claude: Turning Claude into your thinking partner",
    url: "https://claude.com/blog/your-thinking-partner",
  },
  {
    date: "Nov 19, 2025",
    category: "engineering",
    title: "How to create Skills: Key steps, limitations, and examples",
    url: "https://claude.com/blog/how-to-create-skills-key-steps-limitations-and-examples",
  },
  {
    date: "Nov 17, 2025",
    category: "engineering",
    title: "How three YC startups built their companies with Claude Code",
    url: "https://claude.com/blog/building-companies-with-claude-code",
  },
  {
    date: "Nov 14, 2025",
    category: "announcement",
    title: "Structured outputs on the Claude Developer Platform",
    url: "https://claude.com/blog/structured-outputs-on-the-claude-developer-platform",
  },
  {
    date: "Nov 13, 2025",
    category: "engineering",
    title: "Skills explained: How Skills compares to prompts, Projects, MCP, and subagents",
    url: "https://claude.com/blog/skills-explained",
  },
  {
    date: "Nov 12, 2025",
    category: "engineering",
    title: "Improving frontend design through Skills",
    url: "https://claude.com/blog/improving-frontend-design-through-skills",
  },
  {
    date: "Nov 10, 2025",
    category: "engineering",
    title: "Best practices for prompt engineering",
    url: "https://claude.com/blog/best-practices-for-prompt-engineering",
  },
  {
    date: "Nov 3, 2025",
    category: "use_cases",
    title: "Building AI agents for startups",
    url: "https://claude.com/blog/building-ai-agents-for-startups",
  },
  {
    date: "Oct 31, 2025",
    category: "engineering",
    title: "What is Model Context Protocol? Connect AI to your world",
    url: "https://claude.com/blog/what-is-model-context-protocol",
  },
  {
    date: "Oct 30, 2025",
    category: "engineering",
    title: "Introduction to agentic coding",
    url: "https://claude.com/blog/introduction-to-agentic-coding",
  },
  {
    date: "Oct 30, 2025",
    category: "engineering",
    title: "Building AI agents for healthcare and life sciences",
    url: "https://claude.com/blog/building-ai-agents-for-healthcare-and-life-sciences",
  },
  {
    date: "Oct 30, 2025",
    category: "engineering",
    title: "Building AI agents for financial services",
    url: "https://claude.com/blog/building-ai-agents-in-financial-services",
  },
  {
    date: "Oct 30, 2025",
    category: "use_cases",
    title: "How Brex improves code quality and productivity with Claude Code",
    url: "https://claude.com/blog/how-brex-improves-code-quality-and-productivity-with-claude-code",
  },
  {
    date: "Oct 28, 2025",
    category: "engineering",
    title: "Fix software bugs faster with Claude",
    url: "https://claude.com/blog/fix-software-bugs-faster-with-claude",
  },
  {
    date: "Oct 27, 2025",
    category: "engineering",
    title: "How to integrate APIs seamlessly",
    url: "https://claude.com/blog/how-to-integrate-apis-seamlessly",
  },
  {
    date: "Oct 20, 2025",
    category: "announcement",
    title: "Claude Code on the web",
    url: "https://claude.com/blog/claude-code-on-the-web",
  },
  {
    date: "Oct 16, 2025",
    category: "announcement",
    title: "Claude and your productivity platforms",
    url: "https://claude.com/blog/claude-and-your-productivity-platforms",
  },
  {
    date: "Oct 16, 2025",
    category: "announcement",
    title: "Introducing Agent Skills",
    url: "https://claude.com/blog/introducing-agent-skills",
  },
  {
    date: "Oct 15, 2025",
    category: "engineering",
    title: "How to scale agentic coding across your engineering organization",
    url: "https://claude.com/blog/how-to-scale-agentic-coding-across-your-engineering-organization",
  },
  {
    date: "Oct 10, 2025",
    category: "engineering",
    title: "Build responsive web layouts",
    url: "https://claude.com/blog/build-responsive-web-layouts",
  },
  {
    date: "Oct 9, 2025",
    category: "announcement",
    title: "Customize Claude Code with plugins",
    url: "https://claude.com/blog/customize-claude-code-with-plugins",
  },
  {
    date: "Oct 8, 2025",
    category: "engineering",
    title: "Beyond permission prompts: making Claude Code more secure and autonomous",
    url: "https://claude.com/blog/beyond-permission-prompts-making-claude-code-more-secure-and-autonomous",
  },
  {
    date: "Oct 6, 2025",
    category: "engineering",
    title: "Optimize code performance quickly",
    url: "https://claude.com/blog/optimize-code-performance-quickly",
  },
  {
    date: "Oct 6, 2025",
    category: "engineering",
    title: "Identifying security vulnerabilities in your code",
    url: "https://claude.com/blog/identifying-security-vulnerabilities-in-your-code",
  },
  {
    date: "Oct 1, 2025",
    category: "use_cases",
    title: "How enterprises are driving AI transformation with Claude",
    url: "https://claude.com/blog/how-enterprises-are-driving-ai-transformation-with-claude",
  },
  {
    date: "Oct 1, 2025",
    category: "announcement",
    title: "Claude and Slack",
    url: "https://claude.com/blog/claude-and-slack",
  },
  {
    date: "Sep 29, 2025",
    category: "announcement",
    title: "Managing context on the Claude Developer Platform",
    url: "https://claude.com/blog/managing-context-on-the-claude-developer-platform",
  },
  {
    date: "Sep 24, 2025",
    category: "announcement",
    title: "Claude is now available in Microsoft 365 Copilot",
    url: "https://claude.com/blog/claude-is-now-available-in-microsoft-365-copilot",
  },
  {
    date: "Sep 11, 2025",
    category: "announcement",
    title: "Bringing memory to Claude",
    url: "https://claude.com/blog/bringing-memory-to-claude",
  },
  {
    date: "Sep 9, 2025",
    category: "announcement",
    title: "Claude can now create and edit files",
    url: "https://claude.com/blog/claude-can-now-create-and-edit-files",
  },
  {
    date: "Aug 25, 2025",
    category: "announcement",
    title: "Piloting Claude in Chrome",
    url: "https://claude.com/blog/piloting-claude-in-chrome",
  },
  {
    date: "Aug 20, 2025",
    category: "announcement",
    title: "Claude Code and new admin controls for business plans",
    url: "https://claude.com/blog/claude-code-and-new-admin-controls-for-business-plans",
  },
  {
    date: "Aug 14, 2025",
    category: "announcement",
    title: "Prompt caching with Claude",
    url: "https://claude.com/blog/prompt-caching-with-claude",
  },
  {
    date: "Aug 12, 2025",
    category: "announcement",
    title: "Claude Sonnet 4 now supports 1M tokens of context",
    url: "https://claude.com/blog/claude-sonnet-4-now-supports-1m-tokens-of-context",
  },
  {
    date: "Aug 6, 2025",
    category: "announcement",
    title: "Automate security reviews with Claude Code",
    url: "https://claude.com/blog/automate-security-reviews-with-claude-code",
  },
  {
    date: "Jul 25, 2025",
    category: "announcement",
    title: "Build and share AI-powered apps with Claude",
    url: "https://claude.com/blog/build-and-share-ai-powered-apps-with-claude",
  },
  {
    date: "Jul 24, 2025",
    category: "use_cases",
    title: "How Anthropic teams use Claude Code",
    url: "https://claude.com/blog/how-anthropic-teams-use-claude-code",
  },
  {
    date: "Jul 14, 2025",
    category: "announcement",
    title: "Discover tools that work with Claude",
    url: "https://claude.com/blog/discover-tools-that-work-with-claude",
  },
  {
    date: "Jun 25, 2025",
    category: "announcement",
    title: "Turn ideas into interactive AI-powered apps",
    url: "https://claude.com/blog/turn-ideas-into-interactive-ai-powered-apps",
  },
  {
    date: "Jun 23, 2025",
    category: "announcement",
    title: "Introducing Citations on the Anthropic API",
    url: "https://claude.com/blog/introducing-citations-on-the-anthropic-api",
  },
  {
    date: "Jun 18, 2025",
    category: "announcement",
    title: "Remote MCP support in Claude Code",
    url: "https://claude.com/blog/remote-mcp-support-in-claude-code",
  },
  {
    date: "May 22, 2025",
    category: "announcement",
    title: "New capabilities for building agents on the Anthropic API",
    url: "https://claude.com/blog/new-capabilities-for-building-agents-on-the-anthropic-api",
  },
  {
    date: "May 7, 2025",
    category: "announcement",
    title: "Introducing web search on the Anthropic API",
    url: "https://claude.com/blog/introducing-web-search-on-the-anthropic-api",
  },
  {
    date: "May 1, 2025",
    category: "announcement",
    title: "Claude can now connect to your world",
    url: "https://claude.com/blog/claude-can-now-connect-to-your-world",
  },
  {
    date: "Apr 15, 2025",
    category: "announcement",
    title: "Claude takes research to new places",
    url: "https://claude.com/blog/claude-takes-research-to-new-places",
  },
  {
    date: "Apr 9, 2025",
    category: "announcement",
    title: "Introducing the Max Plan",
    url: "https://claude.com/blog/introducing-the-max-plan",
  },
  {
    date: "Apr 2, 2025",
    category: "announcement",
    title: "Claude on Google Cloud's Vertex AI: FedRAMP High and IL2 Authorized",
    url: "https://claude.com/blog/claude-on-google-cloud-vertex-ai-fedramp-high-and-il2-authorized",
  },
  {
    date: "Mar 20, 2025",
    category: "announcement",
    title: "Claude can now search the web",
    url: "https://claude.com/blog/claude-can-now-search-the-web",
  },
  {
    date: "Mar 13, 2025",
    category: "announcement",
    title: "Token-saving updates on the Anthropic API",
    url: "https://claude.com/blog/token-saving-updates-on-the-anthropic-api",
  },
  {
    date: "Mar 6, 2025",
    category: "etc",
    title: "Get to production faster with the upgraded Anthropic Console",
    url: "https://claude.com/blog/get-to-production-faster-with-the-upgraded-anthropic-console",
  },
  {
    date: "Dec 3, 2024",
    category: "announcement",
    title: "Claude 3.5 Haiku on AWS Trainium2 and model distillation in Amazon Bedrock",
    url: "https://claude.com/blog/claude-35-haiku-on-aws-trainium2-and-model-distillation-in-amazon-bedrock",
  },
  {
    date: "Nov 26, 2024",
    category: "announcement",
    title: "Tailor Claude's responses to your personal style",
    url: "https://claude.com/blog/tailor-claude-responses-to-your-personal-style",
  },
  {
    date: "Oct 24, 2024",
    category: "announcement",
    title: "Introducing the analysis tool in Claude.ai",
    url: "https://claude.com/blog/introducing-the-analysis-tool-in-claude-ai",
  },
  {
    date: "Oct 14, 2024",
    category: "announcement",
    title: "Improve your prompts in the developer console",
    url: "https://claude.com/blog/improve-your-prompts-in-the-developer-console",
  },
  {
    date: "Oct 8, 2024",
    category: "announcement",
    title: "Introducing the Message Batches API",
    url: "https://claude.com/blog/introducing-the-message-batches-api",
  },
  {
    date: "Sep 10, 2024",
    category: "announcement",
    title: "Claude for Enterprise",
    url: "https://claude.com/blog/claude-for-enterprise",
  },
  {
    date: "Sep 10, 2024",
    category: "announcement",
    title: "Workspaces in the Anthropic API Console",
    url: "https://claude.com/blog/workspaces-in-the-anthropic-api-console",
  },
  {
    date: "Aug 27, 2024",
    category: "announcement",
    title: "Artifacts are now generally available",
    url: "https://claude.com/blog/artifacts-are-now-generally-available",
  },
  {
    date: "Jul 16, 2024",
    category: "announcement",
    title: "Claude Android app",
    url: "https://claude.com/blog/claude-android-app",
  },
  {
    date: "Jul 10, 2024",
    category: "announcement",
    title: "Fine-tune Claude 3 Haiku in Amazon Bedrock",
    url: "https://claude.com/blog/fine-tune-claude-3-haiku-in-amazon-bedrock",
  },
  {
    date: "Jul 9, 2024",
    category: "announcement",
    title: "Evaluate prompts in the developer console",
    url: "https://claude.com/blog/evaluate-prompts-in-the-developer-console",
  },
  {
    date: "May 30, 2024",
    category: "announcement",
    title: "Claude can now use tools",
    url: "https://claude.com/blog/claude-can-now-use-tools",
  },
  {
    date: "May 20, 2024",
    category: "announcement",
    title: "Generate better prompts in the developer console",
    url: "https://claude.com/blog/generate-better-prompts-in-the-developer-console",
  },
  {
    date: "May 1, 2024",
    category: "announcement",
    title: "Introducing the Claude Team plan and iOS app",
    url: "https://claude.com/blog/introducing-the-claude-team-plan-and-ios-app",
  },
  {
    date: "Dec 6, 2023",
    category: "announcement",
    title: "Long context prompting for Claude 2.1",
    url: "https://claude.com/blog/long-context-prompting-for-claude-2-1",
  },
  {
    date: "Sep 28, 2023",
    category: "announcement",
    title: "Claude on Amazon Bedrock now available to every AWS customer",
    url: "https://claude.com/blog/claude-on-amazon-bedrock-now-available-to-every-aws-customer",
  },
  {
    date: "Aug 23, 2023",
    category: "announcement",
    title: "Claude 2 on Amazon Bedrock",
    url: "https://claude.com/blog/claude-2-on-amazon-bedrock",
  },
];

interface LogEntry {
  type: "progress" | "success" | "error" | "skip" | "complete";
  index: number;
  total: number;
  url?: string;
  title?: string;
  message?: string;
  stats?: { success: number; failed: number; skipped: number };
}

export default function BatchCollector({ onComplete }: { onComplete?: () => void }) {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stats, setStats] = useState({ success: 0, failed: 0, skipped: 0 });
  const [delaySeconds, setDelaySeconds] = useState(60);
  const abortControllerRef = useRef<AbortController | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const startBatchCollection = async () => {
    setIsRunning(true);
    setLogs([]);
    setCurrentIndex(0);
    setStats({ success: 0, failed: 0, skipped: 0 });

    abortControllerRef.current = new AbortController();

    try {
      // Process oldest first (reverse order)
      const articlesToProcess = [...CLAUDE_BLOG_ARTICLES].reverse();

      const response = await fetch("/api/admin/batch-collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: articlesToProcess.map((a) => ({ url: a.url, category: a.category })),
          delayMs: delaySeconds * 1000,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to start batch collection");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6)) as LogEntry;
              setLogs((prev) => [...prev, event]);
              setCurrentIndex(event.index);

              if (event.type === "complete" && event.stats) {
                setStats(event.stats);
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        setLogs((prev) => [
          ...prev,
          {
            type: "error",
            index: currentIndex,
            total: CLAUDE_BLOG_ARTICLES.length,
            message: "수집이 중단되었습니다",
          },
        ]);
      } else {
        setLogs((prev) => [
          ...prev,
          {
            type: "error",
            index: currentIndex,
            total: CLAUDE_BLOG_ARTICLES.length,
            message: `오류: ${(error as Error).message}`,
          },
        ]);
      }
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
      onComplete?.();
    }
  };

  const stopBatchCollection = () => {
    abortControllerRef.current?.abort();
  };

  const totalArticles = CLAUDE_BLOG_ARTICLES.length;
  const estimatedMinutes = Math.ceil((totalArticles * delaySeconds) / 60);
  const estimatedTimeText =
    estimatedMinutes >= 60
      ? `${Math.floor(estimatedMinutes / 60)}시간 ${estimatedMinutes % 60}분`
      : `${estimatedMinutes}분`;

  return (
    <div className="bg-[#161616] rounded-lg border border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[14px] font-semibold text-white">📚 Claude 블로그 배치 수집</h3>
          <span className="text-[11px] text-white/40">{totalArticles}개 기사</span>
        </div>
        <p className="text-[11px] text-white/50">
          Claude 공식 블로그의 모든 기사를 순차적으로 수집합니다. 예상 소요 시간: ~
          {estimatedTimeText}
        </p>
      </div>

      {/* Controls */}
      <div className="p-4 border-b border-white/[0.06] space-y-3">
        {/* Delay Setting */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] text-white/50">요청 간격</label>
            <span className="text-[12px] text-white/70 font-medium">
              {delaySeconds >= 60
                ? `${Math.floor(delaySeconds / 60)}분 ${delaySeconds % 60}초`
                : `${delaySeconds}초`}
            </span>
          </div>
          <input
            type="range"
            min={15}
            max={180}
            step={15}
            value={delaySeconds}
            onChange={(e) => setDelaySeconds(Number(e.target.value))}
            disabled={isRunning}
            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--color-claude-coral)]"
          />
          <div className="flex justify-between text-[9px] text-white/30">
            <span>15초 (빠름)</span>
            <span>1분</span>
            <span>2분</span>
            <span>3분 (안전)</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {!isRunning ? (
            <button
              onClick={startBatchCollection}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--color-claude-coral)] text-white rounded text-[12px] font-medium hover:opacity-90 transition-colors"
            >
              <Play className="w-4 h-4" />
              수집 시작
            </button>
          ) : (
            <button
              onClick={stopBatchCollection}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded text-[12px] font-medium hover:opacity-90 transition-colors"
            >
              <Square className="w-4 h-4" />
              중단
            </button>
          )}
        </div>

        {/* Progress Bar */}
        {isRunning && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-white/50">
              <span>진행률</span>
              <span>
                {currentIndex + 1} / {totalArticles}
              </span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--color-claude-coral)] transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / totalArticles) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      {(isRunning || logs.length > 0) && (
        <div className="px-4 py-2 border-b border-white/[0.06] flex gap-4">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] text-emerald-400">{stats.success} 성공</span>
          </div>
          <div className="flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-red-400" />
            <span className="text-[11px] text-red-400">{stats.failed} 실패</span>
          </div>
          <div className="flex items-center gap-1.5">
            <SkipForward className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-[11px] text-yellow-400">{stats.skipped} 건너뜀</span>
          </div>
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div className="max-h-[300px] overflow-y-auto p-2 space-y-1 bg-black/20">
          {logs.map((log, i) => (
            <LogItem key={i} log={log} />
          ))}
          <div ref={logsEndRef} />
        </div>
      )}
    </div>
  );
}

function LogItem({ log }: { log: LogEntry }) {
  const icons = {
    progress: <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />,
    success: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />,
    error: <XCircle className="w-3.5 h-3.5 text-red-400" />,
    skip: <SkipForward className="w-3.5 h-3.5 text-yellow-400" />,
    complete: <CheckCircle className="w-3.5 h-3.5 text-purple-400" />,
  };

  const colors = {
    progress: "text-white/70",
    success: "text-emerald-400",
    error: "text-red-400",
    skip: "text-yellow-400",
    complete: "text-purple-400",
  };

  return (
    <div className="flex items-start gap-2 px-2 py-1.5 rounded bg-white/[0.02] hover:bg-white/[0.04]">
      <div className="flex-shrink-0 mt-0.5">{icons[log.type]}</div>
      <div className="flex-1 min-w-0">
        <p className={`text-[11px] ${colors[log.type]} break-words`}>{log.message}</p>
        {log.url && (
          <p className="text-[10px] text-white/30 truncate" title={log.url}>
            {log.url}
          </p>
        )}
      </div>
      <span className="text-[10px] text-white/30 flex-shrink-0">
        {log.index + 1}/{log.total}
      </span>
    </div>
  );
}
