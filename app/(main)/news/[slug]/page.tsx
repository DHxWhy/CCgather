import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Calendar, Tag, ExternalLink, Check } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import type { ContentItem } from "@/types/automation";
import CopyButton from "@/components/ui/CopyButton";
import NewsArticleJsonLd from "@/components/seo/NewsArticleJsonLd";
import CTASection from "@/components/news/CTASection";
import { sanitizeHtml, isNewArticle } from "@/lib/utils/sanitize";

// ===========================================
// Constants
// ===========================================

const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "long",
  day: "numeric",
};

const DIFFICULTY_STYLES = {
  easy: "bg-green-500/20 text-green-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  hard: "bg-red-500/20 text-red-400",
} as const;

const DIFFICULTY_LABELS = {
  easy: "쉬움",
  medium: "보통",
  hard: "심화",
} as const;

type Difficulty = keyof typeof DIFFICULTY_STYLES;

// ===========================================
// Types
// ===========================================

interface NewsDetailPageProps {
  params: Promise<{ slug: string }>;
}

// ===========================================
// Data Fetching
// ===========================================

async function getNewsBySlug(slug: string): Promise<ContentItem | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("contents")
      .select("*")
      .eq("slug", slug)
      .eq("type", "news")
      .eq("status", "published")
      .single();

    if (error || !data) {
      return null;
    }

    return data as ContentItem;
  } catch {
    return null;
  }
}

async function getRelatedNews(currentId: string, contentType?: string): Promise<ContentItem[]> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("contents")
      .select("id, title, slug, thumbnail_url, published_at, content_type")
      .eq("type", "news")
      .eq("status", "published")
      .neq("id", currentId)
      .order("published_at", { ascending: false })
      .limit(3);

    if (contentType) {
      query = query.eq("content_type", contentType);
    }

    const { data } = await query;

    return (data || []) as ContentItem[];
  } catch {
    return [];
  }
}

// ===========================================
// Metadata Generation (SEO)
// ===========================================

export async function generateMetadata({ params }: NewsDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getNewsBySlug(slug);

  if (!article) {
    return {
      title: "Article Not Found | CCgather",
    };
  }

  const richContent = article.rich_content;
  const title = richContent?.title.text || article.title;
  const description = richContent?.summary.text || article.summary_md || article.summary || "";

  return {
    title: `${title} | CCgather News`,
    description: description.slice(0, 160),
    keywords: ["Claude Code", "Claude Code news", "AI news", "Anthropic", ...(article.tags || [])],
    openGraph: {
      title: title,
      description: description.slice(0, 160),
      type: "article",
      publishedTime: article.published_at || article.created_at,
      images: article.thumbnail_url
        ? [
            {
              url: article.thumbnail_url,
              width: 1200,
              height: 630,
              alt: title,
            },
          ]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title: title,
      description: description.slice(0, 160),
      images: article.thumbnail_url ? [article.thumbnail_url] : [],
    },
  };
}

// ===========================================
// Main Page Component
// ===========================================

export default async function NewsDetailPage({ params }: NewsDetailPageProps) {
  const { slug } = await params;
  const article = await getNewsBySlug(slug);

  if (!article) {
    notFound();
  }

  const relatedNews = await getRelatedNews(article.id, article.content_type);
  const richContent = article.rich_content;

  // Parse content
  const title = richContent?.title.text || article.title;
  const titleEmoji = richContent?.title.emoji;
  const oneLiner = article.one_liner;
  const summary = richContent?.summary.text || article.summary_md || article.summary;
  const analogy = richContent?.summary.analogy;
  const keyPoints =
    richContent?.keyPoints || article.key_points?.map((text) => ({ icon: "✅", text }));
  const keyTakeaways = article.key_takeaways || keyPoints?.slice(0, 5);
  const insightHtml = article.insight_html;
  const bodyHtml = article.body_html;
  const difficulty = richContent?.meta.difficulty || article.difficulty;
  const readTime = richContent?.meta.readTime;
  const category = richContent?.meta.category || article.category;

  const publishedDate = new Date(article.published_at || article.created_at).toLocaleDateString(
    "ko-KR",
    DATE_FORMAT_OPTIONS
  );

  const isNew = isNewArticle(article.published_at, article.created_at);

  return (
    <>
      {/* JSON-LD Structured Data */}
      <NewsArticleJsonLd article={article} />

      <article className="mx-auto max-w-4xl px-4 lg:px-6 py-8 md:py-10">
        {/* Back Navigation */}
        <Link
          href="/news"
          className="inline-flex items-center gap-2 text-text-muted hover:text-white transition-colors mb-6 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded"
          aria-label="뉴스 목록으로 돌아가기"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to News
        </Link>

        {/* One-Liner Summary with Copy Button */}
        {oneLiner && (
          <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 mb-6">
            <p className="text-base font-semibold text-white flex-1">{oneLiner}</p>
            <CopyButton text={oneLiner} />
          </div>
        )}

        {/* Article Header */}
        <header className="mb-8">
          {/* Title */}
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-4 leading-tight">
            {titleEmoji && <span className="mr-2">{titleEmoji}</span>}
            {title}
          </h1>

          {/* Meta Information */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-text-muted">
            <time
              className="flex items-center gap-1.5"
              dateTime={article.published_at || article.created_at}
            >
              <Calendar className="w-4 h-4" aria-hidden="true" />
              {publishedDate}
            </time>

            {category && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/10">
                <Tag className="w-3.5 h-3.5" aria-hidden="true" />
                {category}
              </span>
            )}

            {readTime && (
              <span className="text-text-muted/60" aria-label={`읽기 시간: ${readTime}`}>
                <span aria-hidden="true">📖</span> {readTime}
              </span>
            )}

            {difficulty && (
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${DIFFICULTY_STYLES[difficulty as Difficulty]}`}
                aria-label={`난이도: ${DIFFICULTY_LABELS[difficulty as Difficulty]}`}
              >
                {DIFFICULTY_LABELS[difficulty as Difficulty]}
              </span>
            )}

            {isNew && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">
                NEW
              </span>
            )}
          </div>
        </header>

        {/* Hero Image */}
        {article.thumbnail_url && (
          <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-8 bg-black/20">
            <Image
              src={article.thumbnail_url}
              alt={title}
              fill
              className="object-cover"
              priority
              unoptimized
            />
            {/* Source Badge */}
            {article.source_name && (
              <div className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/70 backdrop-blur-sm">
                {article.favicon_url && (
                  <Image
                    src={article.favicon_url}
                    alt=""
                    width={16}
                    height={16}
                    className="rounded-sm"
                    unoptimized
                  />
                )}
                <span className="text-white text-sm font-medium">{article.source_name}</span>
              </div>
            )}
          </div>
        )}

        {/* Article Body */}
        <div className="prose prose-invert prose-lg max-w-none mb-8">
          {/* Summary/Intro */}
          {summary && !bodyHtml && (
            <p className="text-lg text-white/90 leading-relaxed">{summary}</p>
          )}

          {/* Analogy Box */}
          {analogy && (
            <div className="not-prose my-6 p-4 rounded-lg bg-blue-500/10 border-l-4 border-blue-500/50">
              <span className="mr-2 text-lg">{analogy.icon}</span>
              <span className="text-white/80 italic">{analogy.text}</span>
            </div>
          )}

          {/* Full Body HTML */}
          {bodyHtml && (
            <div
              className="article-body"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(bodyHtml) }}
            />
          )}

          {/* Insight Box */}
          {insightHtml && (
            <div className="not-prose my-8 p-5 rounded-xl bg-orange-500/10 border-l-4 border-orange-500/50">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                💡 CCgather 인사이트
              </h3>
              <div
                className="text-white/80 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(insightHtml) }}
              />
            </div>
          )}

          {/* Fallback Insight from rich_content */}
          {!insightHtml && richContent?.summary.analogy && (
            <div className="not-prose my-8 p-5 rounded-xl bg-orange-500/10 border-l-4 border-orange-500/50">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                💡 CCgather 인사이트
              </h3>
              <p className="text-white/80 leading-relaxed">{richContent.summary.analogy.text}</p>
            </div>
          )}
        </div>

        {/* Key Takeaways */}
        {keyTakeaways && keyTakeaways.length > 0 && (
          <section className="mb-8 p-5 rounded-xl bg-white/[0.02] border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4">📌 핵심 정리</h2>
            <ul className="space-y-2.5">
              {keyTakeaways.map((point, index) => (
                <li key={index} className="flex items-start gap-2.5 text-white/80">
                  <span className="text-base flex-shrink-0">{point.icon}</span>
                  <span className="text-[15px] leading-relaxed">{point.text}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Related Articles */}
        {relatedNews.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">🔗 관련 기사</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {relatedNews.map((related) => (
                <Link
                  key={related.id}
                  href={related.slug ? `/news/${related.slug}` : "#"}
                  className="group p-3 rounded-lg bg-white/[0.02] border border-white/10 hover:border-white/20 transition-colors"
                >
                  {related.thumbnail_url && (
                    <div className="relative w-full aspect-video rounded-md overflow-hidden mb-2 bg-black/20">
                      <Image
                        src={related.thumbnail_url}
                        alt={related.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        unoptimized
                      />
                    </div>
                  )}
                  <h4 className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors line-clamp-2">
                    {related.title}
                  </h4>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Source Link */}
        <div className="flex items-center justify-between py-4 border-t border-white/10 mb-8">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <span>📎 출처:</span>
            <a
              href={article.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline flex items-center gap-1"
            >
              {article.source_name || "원문 보기"}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {article.fact_check_score && article.fact_check_score >= 0.8 && (
            <span className="flex items-center gap-1.5 text-sm text-green-400">
              <Check className="w-4 h-4" />
              팩트 검증 완료
            </span>
          )}
        </div>

        {/* CTA / Share Section */}
        <CTASection articleUrl={`/news/${slug}`} articleTitle={title} oneLiner={oneLiner} />
      </article>
    </>
  );
}
