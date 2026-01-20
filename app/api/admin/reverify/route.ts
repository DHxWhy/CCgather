import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkAdminAccess } from "@/lib/admin";
import { performHardCheck } from "@/lib/ai/fact-hard-check";
import {
  verifyFactsWithWebSearch,
  extractKeyFactsForVerification,
  type WebVerifyResult,
} from "@/lib/ai/fact-web-verify";

interface ArticleIssue {
  id: string;
  title: string;
  source_url: string;
  status: string;
  hardCheck: {
    passed: boolean;
    score: number;
    criticalIssues: string[];
    warnings: string[];
    dateMismatches: number;
    numberMismatches: number;
  };
  webVerify?: {
    passed: boolean;
    score: number;
    verifiedFacts: number;
    unverifiedFacts: number;
    sources: string[];
    costUsd: number;
    issues: string[];
  };
}

/**
 * GET - Re-verify published articles using hard check
 *
 * Query params:
 * - status: Filter by status (default: "published")
 * - limit: Max articles to check (default: 100)
 * - dryRun: If "false", update articles with issues to needs_review (default: "true")
 */
export async function GET(request: NextRequest) {
  try {
    if (!(await checkAdminAccess())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") || "published";
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const dryRun = searchParams.get("dryRun") !== "false";

    const supabase = createServiceClient();

    // Fetch articles with original content and body_html
    const { data: articles, error: fetchError } = await supabase
      .from("contents")
      .select("id, title, source_url, status, original_content, body_html, created_at")
      .eq("status", status)
      .not("original_content", "is", null)
      .not("body_html", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (fetchError) {
      console.error("[Reverify] Fetch error:", fetchError);
      return NextResponse.json({ error: "Failed to fetch articles" }, { status: 500 });
    }

    if (!articles || articles.length === 0) {
      return NextResponse.json({
        message: "No articles found to verify",
        checked: 0,
        issues: [],
      });
    }

    console.log(`[Reverify] Checking ${articles.length} ${status} articles...`);

    const articlesWithIssues: ArticleIssue[] = [];
    const idsToUpdate: string[] = [];

    for (const article of articles) {
      // Run hard check on original_content vs body_html
      const hardCheckResult = performHardCheck(article.original_content!, article.body_html!);

      // If hard check failed (critical issues found)
      if (!hardCheckResult.passed || hardCheckResult.criticalIssues.length > 0) {
        articlesWithIssues.push({
          id: article.id,
          title: article.title || "Untitled",
          source_url: article.source_url,
          status: article.status,
          hardCheck: {
            passed: hardCheckResult.passed,
            score: hardCheckResult.score,
            criticalIssues: hardCheckResult.criticalIssues,
            warnings: hardCheckResult.warnings,
            dateMismatches: hardCheckResult.dateCheck.mismatches.length,
            numberMismatches: hardCheckResult.numberCheck.mismatches.length,
          },
        });

        idsToUpdate.push(article.id);
      }
    }

    console.log(
      `[Reverify] Found ${articlesWithIssues.length} articles with issues out of ${articles.length} checked`
    );

    // If not dry run, update articles with issues to needs_review
    let updated = 0;
    if (!dryRun && idsToUpdate.length > 0) {
      console.log(`[Reverify] Updating ${idsToUpdate.length} articles to needs_review...`);

      const { error: updateError } = await supabase
        .from("contents")
        .update({
          status: "needs_review",
          fact_check_reason: "Hard check failed - date/number mismatch detected",
        })
        .in("id", idsToUpdate);

      if (updateError) {
        console.error("[Reverify] Update error:", updateError);
        return NextResponse.json(
          {
            error: "Failed to update some articles",
            checked: articles.length,
            issues: articlesWithIssues,
          },
          { status: 500 }
        );
      }

      updated = idsToUpdate.length;
    }

    return NextResponse.json({
      success: true,
      dryRun,
      checked: articles.length,
      issuesFound: articlesWithIssues.length,
      updated,
      issues: articlesWithIssues,
      summary: {
        totalChecked: articles.length,
        withCriticalIssues: articlesWithIssues.filter((a) => a.hardCheck.criticalIssues.length > 0)
          .length,
        withDateMismatches: articlesWithIssues.filter((a) => a.hardCheck.dateMismatches > 0).length,
        withNumberMismatches: articlesWithIssues.filter((a) => a.hardCheck.numberMismatches > 0)
          .length,
      },
    });
  } catch (error) {
    console.error("[Reverify] Unexpected error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST - Re-verify a single article by ID
 *
 * Body:
 * - id: Article ID to re-verify
 * - fix: If true, mark as needs_review if issues found
 * - webVerify: If true, run web verification using Google Search (costs ~$0.01-0.05)
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await checkAdminAccess())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      fix = false,
      webVerify = false,
    } = body as {
      id: string;
      fix?: boolean;
      webVerify?: boolean;
    };

    if (!id) {
      return NextResponse.json({ error: "Article ID is required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Fetch the specific article
    const { data: article, error: fetchError } = await supabase
      .from("contents")
      .select("id, title, source_url, status, original_content, body_html")
      .eq("id", id)
      .single();

    if (fetchError || !article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    if (!article.original_content || !article.body_html) {
      return NextResponse.json(
        {
          error: "Article missing original_content or body_html",
          article: {
            id: article.id,
            title: article.title,
            has_original: !!article.original_content,
            has_body_html: !!article.body_html,
          },
        },
        { status: 400 }
      );
    }

    // Run hard check
    const hardCheckResult = performHardCheck(article.original_content, article.body_html);

    // Run web verification if requested
    let webVerifyResult: WebVerifyResult | null = null;
    if (webVerify && article.source_url) {
      console.log(`[Reverify] Running web verification for article ${id}...`);
      try {
        // Extract key facts for verification
        const keyFacts = extractKeyFactsForVerification(
          article.title || "Untitled",
          article.body_html,
          {} // No extracted facts available in reverify context
        );

        if (keyFacts.length > 0) {
          webVerifyResult = await verifyFactsWithWebSearch(
            article.title || "Untitled",
            keyFacts,
            article.source_url
          );
          console.log(
            `[Reverify] Web verification complete. Score: ${webVerifyResult.score}, ` +
              `Verified: ${webVerifyResult.verifiedFacts.length}, Unverified: ${webVerifyResult.unverifiedFacts.length}`
          );
        }
      } catch (webError) {
        console.error("[Reverify] Web verification error:", webError);
        // Continue without web verification
      }
    }

    const result = {
      id: article.id,
      title: article.title,
      source_url: article.source_url,
      currentStatus: article.status,
      hardCheck: {
        passed: hardCheckResult.passed,
        score: hardCheckResult.score,
        criticalIssues: hardCheckResult.criticalIssues,
        warnings: hardCheckResult.warnings,
        dateCheck: {
          passed: hardCheckResult.dateCheck.passed,
          originalDates: hardCheckResult.dateCheck.originalDates.slice(0, 10), // Limit for response size
          rewrittenDates: hardCheckResult.dateCheck.rewrittenDates.slice(0, 10),
          mismatches: hardCheckResult.dateCheck.mismatches,
        },
        numberCheck: {
          passed: hardCheckResult.numberCheck.passed,
          originalNumbers: hardCheckResult.numberCheck.originalNumbers.slice(0, 10),
          rewrittenNumbers: hardCheckResult.numberCheck.rewrittenNumbers.slice(0, 10),
          mismatches: hardCheckResult.numberCheck.mismatches,
        },
      },
      webVerify: webVerifyResult
        ? {
            passed: webVerifyResult.passed,
            score: webVerifyResult.score,
            verifiedFacts: webVerifyResult.verifiedFacts.length,
            unverifiedFacts: webVerifyResult.unverifiedFacts.length,
            verifiedFactsList: webVerifyResult.verifiedFacts,
            unverifiedFactsList: webVerifyResult.unverifiedFacts,
            sources: webVerifyResult.sources.map((s) => s.url),
            searchQueries: webVerifyResult.searchQueries,
            costUsd: webVerifyResult.costUsd,
          }
        : undefined,
      needsFix: !hardCheckResult.passed || (webVerifyResult && !webVerifyResult.passed),
    };

    // Determine if any verification failed
    const hasIssues = !hardCheckResult.passed || (webVerifyResult && !webVerifyResult.passed);
    const issueReasons: string[] = [
      ...hardCheckResult.criticalIssues,
      ...(webVerifyResult?.unverifiedFacts.map((f) => `웹 검증 실패: ${f.claim}`) || []),
    ];

    // Update status if fix=true and issues found
    if (fix && hasIssues) {
      await supabase
        .from("contents")
        .update({
          status: "needs_review",
          fact_check_reason: issueReasons.join("; ").substring(0, 500), // Truncate to avoid DB limit
        })
        .eq("id", id);

      return NextResponse.json({
        ...result,
        updated: true,
        newStatus: "needs_review",
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Reverify] POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
