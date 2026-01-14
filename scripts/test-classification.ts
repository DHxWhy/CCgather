/**
 * Test script for the new article classification system
 * Run: npx tsx scripts/test-classification.ts
 */

import { GeminiClient } from "../lib/ai/gemini-client";

// Sample articles representing different types
const TEST_ARTICLES = [
  {
    name: "Product Launch",
    expectedType: "product_launch",
    content: `Anthropic Launches Claude 4.0 with Revolutionary Capabilities

    Anthropic today announced the release of Claude 4.0, a completely new AI model that represents a major leap forward in artificial intelligence. The new model is available starting today for all Claude Pro subscribers at $20/month.

    Key features include:
    - 200K context window (up from 100K)
    - Native code execution capabilities
    - Multi-modal input support for images and PDFs
    - 50% faster response times

    "This is our most capable model ever," said CEO Dario Amodei. The model is available via API at $15 per million input tokens.`,
  },
  {
    name: "Version Update",
    expectedType: "version_update",
    content: `Claude Code v1.0.51 Released with Bug Fixes

    Anthropic has released version 1.0.51 of Claude Code, the popular CLI tool for developers. This update focuses on stability improvements and bug fixes.

    Changelog:
    - Fixed: Memory leak when processing large files
    - Fixed: Crash on Windows when path contains spaces
    - Improved: Token counting accuracy by 15%
    - Updated: Dependencies to latest security patches

    Users can update by running: npm update -g @anthropic-ai/claude-code

    This is a recommended update for all users on v1.0.50 or earlier.`,
  },
  {
    name: "Tutorial",
    expectedType: "tutorial",
    content: `How to Build a RAG System with Claude and Pinecone

    In this tutorial, you'll learn how to create a Retrieval-Augmented Generation (RAG) system using Claude API and Pinecone vector database.

    Prerequisites:
    - Node.js 18+
    - Anthropic API key
    - Pinecone account

    Step 1: Set up your project
    Create a new directory and initialize npm...

    Step 2: Install dependencies
    npm install @anthropic-ai/sdk @pinecone-database/pinecone

    Step 3: Create embeddings
    First, we'll chunk our documents and create embeddings...

    Step 4: Query and generate
    Finally, retrieve relevant chunks and pass them to Claude...

    By the end, you'll have a working RAG system that can answer questions about your documents.`,
  },
  {
    name: "Security Advisory",
    expectedType: "security",
    content: `Critical Security Vulnerability in Claude API SDK - CVE-2025-1234

    SEVERITY: HIGH (CVSS 8.5)

    A critical security vulnerability has been discovered in the Anthropic SDK versions 0.20.0 through 0.25.0. The vulnerability allows remote attackers to execute arbitrary code through specially crafted API responses.

    Affected versions: @anthropic-ai/sdk 0.20.0 - 0.25.0
    Fixed in: @anthropic-ai/sdk 0.25.1

    Impact: Remote code execution, data exfiltration

    Mitigation:
    1. Immediately upgrade to version 0.25.1 or later
    2. If upgrade is not possible, disable response streaming

    npm update @anthropic-ai/sdk

    Anthropic recommends all users update immediately.`,
  },
  {
    name: "Research Paper",
    expectedType: "research",
    content: `New Study: Claude Outperforms GPT-4 on Reasoning Benchmarks

    A new peer-reviewed study published in Nature Machine Intelligence demonstrates that Claude 3.5 Sonnet significantly outperforms GPT-4 on complex reasoning tasks.

    Methodology:
    Researchers from MIT and Stanford tested 1,000 problems across mathematics, logic, and coding domains. Each model was given 5 attempts per problem with temperature 0.

    Key Findings:
    - Claude 3.5 Sonnet: 87.3% accuracy
    - GPT-4 Turbo: 82.1% accuracy
    - Gemini Ultra: 79.8% accuracy

    The study also found Claude performed particularly well on multi-step reasoning, with a 12% advantage over competitors.

    Limitations: The benchmark may not fully represent real-world usage patterns.`,
  },
  {
    name: "Integration Announcement",
    expectedType: "integration",
    content: `VS Code Announces Native Claude Integration

    Microsoft today announced a partnership with Anthropic to bring native Claude support to Visual Studio Code. The integration will be available in VS Code 2.0.

    Features of the integration:
    - Inline code completion powered by Claude
    - Chat panel for code explanations
    - Automatic PR description generation
    - Code review suggestions

    The integration uses the Claude API under the hood, and users will need their own API key or a Claude Pro subscription.

    "We're excited to bring the best AI assistant to the world's most popular code editor," said a Microsoft spokesperson.

    Available: Q2 2025 for VS Code Insiders, Q3 2025 for stable release.`,
  },
  {
    name: "Pricing Change",
    expectedType: "pricing",
    content: `Anthropic Announces New API Pricing Effective March 1st

    Anthropic is updating its API pricing structure, effective March 1, 2025.

    New Pricing (per million tokens):
    - Claude 3.5 Sonnet: $3 input / $15 output (was $3 / $15 - unchanged)
    - Claude 3 Opus: $15 input / $75 output (was $15 / $75 - unchanged)
    - Claude 3 Haiku: $0.25 input / $1.25 output (was $0.50 / $2.50 - 50% reduction!)

    Existing customers on annual contracts will be grandfathered at current rates until their renewal date.

    "We're committed to making AI accessible," said Anthropic. "The Haiku price reduction reflects our improved efficiency."

    No action required for existing users - new pricing applies automatically.`,
  },
  {
    name: "Community Showcase",
    expectedType: "showcase",
    content: `Community Spotlight: Developer Creates AI Dungeon Master with Claude

    Reddit user u/DnDCoder has created an impressive AI-powered Dungeon Master using Claude API, garnering over 5,000 upvotes on r/LocalLLaMA.

    The project, called "ClaudeDM", features:
    - Dynamic story generation based on player actions
    - Persistent world state across sessions
    - Character sheet management
    - Combat resolution with dice rolling

    "I built this over a weekend using Claude's long context window to maintain campaign continuity," the developer explained.

    The project is open source and available on GitHub: github.com/example/claudedm

    Tech stack: Next.js, Claude API, PostgreSQL for world state.`,
  },
  {
    name: "Opinion/Editorial",
    expectedType: "opinion",
    content: `Opinion: Why Claude Code Will Replace Traditional IDEs

    As a developer who's used every major IDE over the past 20 years, I believe Claude Code represents a fundamental shift in how we write software.

    My argument is simple: the traditional edit-compile-debug cycle is obsolete. With Claude Code, I describe what I want, and it writes the code. I've seen my productivity increase 3x.

    Critics argue that AI-generated code is unreliable. I disagree. In my experience, Claude's code quality matches or exceeds what junior developers produce.

    Of course, there are limitations. Complex architectural decisions still require human judgment. But for 80% of daily coding tasks, Claude Code is superior.

    The future belongs to AI-augmented development, and those who adapt will thrive.`,
  },
  {
    name: "Event Coverage",
    expectedType: "event",
    content: `Anthropic Keynote at AI Summit 2025: Major Announcements

    SAN FRANCISCO - At today's AI Summit 2025, Anthropic CEO Dario Amodei took the stage for a highly anticipated keynote address.

    The 90-minute presentation included several major announcements:

    1. Claude Enterprise - A new tier for large organizations with dedicated support
    2. Constitutional AI 2.0 - Updated safety framework
    3. Partnership with AWS for dedicated Claude instances

    The highlight was a live demo showing Claude autonomously debugging a production system, receiving a standing ovation from the 5,000 attendees.

    "This is just the beginning," Amodei concluded. "We're building AI that truly understands and helps humanity."

    Next year's summit is already announced for March 2026 in Tokyo.`,
  },
];

async function runTest() {
  console.log("=".repeat(60));
  console.log("🧪 Article Classification System Test");
  console.log("=".repeat(60));
  console.log();

  // Load .env.local
  const fs = await import("fs");
  const envContent = fs.readFileSync(".env.local", "utf-8");
  const apiKeyMatch = envContent.match(/GOOGLE_GEMINI_API_KEY=(.+)/);
  const apiKey = apiKeyMatch?.[1]?.trim();

  if (!apiKey) {
    console.error("❌ GOOGLE_GEMINI_API_KEY not set in .env.local");
    process.exit(1);
  }

  const client = new GeminiClient({ apiKey, debug: true });

  let totalCost = 0;
  let correct = 0;
  const results: Array<{
    name: string;
    expected: string;
    actual: string;
    secondary: string | null;
    confidence: number;
    signals: string[];
    match: boolean;
  }> = [];

  for (const article of TEST_ARTICLES) {
    console.log(`\n📰 Testing: ${article.name}`);
    console.log("-".repeat(40));

    try {
      const { facts, usage } = await client.extractFacts(article.content);
      totalCost += usage.costUsd;

      const match = facts.classification.primary === article.expectedType;
      if (match) correct++;

      results.push({
        name: article.name,
        expected: article.expectedType,
        actual: facts.classification.primary,
        secondary: facts.classification.secondary || null,
        confidence: facts.classification.confidence,
        signals: facts.classification.signals,
        match,
      });

      const emoji = match ? "✅" : "❌";
      console.log(`${emoji} Expected: ${article.expectedType}`);
      console.log(`   Actual: ${facts.classification.primary}`);
      if (facts.classification.secondary) {
        console.log(`   Secondary: ${facts.classification.secondary}`);
      }
      console.log(`   Confidence: ${(facts.classification.confidence * 100).toFixed(0)}%`);
      console.log(`   Signals: ${facts.classification.signals.join(", ")}`);
      console.log(`   Cost: $${usage.costUsd.toFixed(4)}`);
    } catch (error) {
      console.error(`   ❌ Error: ${error}`);
      results.push({
        name: article.name,
        expected: article.expectedType,
        actual: "ERROR",
        secondary: null,
        confidence: 0,
        signals: [],
        match: false,
      });
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 SUMMARY");
  console.log("=".repeat(60));
  console.log(
    `Accuracy: ${correct}/${TEST_ARTICLES.length} (${((correct / TEST_ARTICLES.length) * 100).toFixed(0)}%)`
  );
  console.log(`Total Cost: $${totalCost.toFixed(4)}`);
  console.log();

  // Detailed results table
  console.log("| Article | Expected | Actual | Confidence | Match |");
  console.log("|---------|----------|--------|------------|-------|");
  for (const r of results) {
    console.log(
      `| ${r.name.padEnd(20)} | ${r.expected.padEnd(15)} | ${r.actual.padEnd(15)} | ${(r.confidence * 100).toFixed(0).padStart(3)}% | ${r.match ? "✅" : "❌"} |`
    );
  }
}

runTest().catch(console.error);
