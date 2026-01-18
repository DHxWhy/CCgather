import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Calendar, Tag } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import type { ContentItem } from "@/types/automation";
import NewsArticleJsonLd from "@/components/seo/NewsArticleJsonLd";
import CTASection from "@/components/news/CTASection";
import ViewTracker from "@/components/news/ViewTracker";
import { sanitizeHtml, isNewArticle } from "@/lib/utils/sanitize";
import { DIFFICULTY_COLORS, DIFFICULTY_LABELS, type Difficulty } from "@/lib/constants/news";
import { getThumbnailSrc, getCategoryGradient, getCategoryEmoji } from "@/lib/utils/news";

// ===========================================
// Constants (page-specific)
// ===========================================

// This page uses "long" month format for detail view
const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "long",
  day: "numeric",
};

// 아이콘 텍스트 → 이모지 변환 맵
const ICON_TO_EMOJI: Record<string, string> = {
  // Buildings & Places
  building: "🏢",
  office: "🏢",
  headquarters: "🏛️",
  map: "🗺️",
  location: "📍",
  globe: "🌍",
  // Business & Growth
  chart: "📊",
  graph: "📈",
  trend: "📈",
  growth: "📈",
  money: "💰",
  dollar: "💵",
  funding: "💰",
  investment: "💸",
  // Technology
  robot: "🤖",
  ai: "🤖",
  brain: "🧠",
  chip: "🔧",
  code: "💻",
  computer: "💻",
  server: "🖥️",
  cloud: "☁️",
  api: "🔌",
  // Actions & Objects
  rocket: "🚀",
  launch: "🚀",
  folder: "📁",
  file: "📄",
  document: "📄",
  link: "🔗",
  key: "🔑",
  lock: "🔒",
  shield: "🛡️",
  security: "🔐",
  // People & Communication
  users: "👥",
  team: "👥",
  person: "👤",
  user: "👤",
  chat: "💬",
  message: "💬",
  email: "📧",
  // Status & Indicators
  check: "✅",
  checkmark: "✅",
  star: "⭐",
  fire: "🔥",
  lightning: "⚡",
  bolt: "⚡",
  warning: "⚠️",
  alert: "🚨",
  info: "ℹ️",
  // Misc
  tool: "🔧",
  settings: "⚙️",
  gear: "⚙️",
  search: "🔍",
  eye: "👁️",
  target: "🎯",
  flag: "🚩",
  bookmark: "🔖",
  clock: "🕐",
  time: "⏰",
  calendar: "📅",
  package: "📦",
  box: "📦",
  gift: "🎁",
  sparkles: "✨",
  magic: "✨",
  light: "💡",
  idea: "💡",
  bulb: "💡",
} as const;

/**
 * 아이콘 텍스트를 이모지로 변환
 * 이미 이모지인 경우 그대로 반환
 */
function iconToEmoji(icon: string): string {
  // 이미 이모지인 경우 (유니코드 이모지 패턴)
  if (
    /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]/u.test(
      icon
    )
  ) {
    return icon;
  }
  // 텍스트를 이모지로 변환
  const lowerIcon = icon.toLowerCase().trim();
  return ICON_TO_EMOJI[lowerIcon] || "•";
}

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
  const title = richContent?.title?.text || article.title;
  const description = richContent?.summary?.text || article.summary_md || article.summary || "";

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

  // Parse content - use optional chaining for all nested properties
  const title = richContent?.title?.text || article.title;
  const titleEmoji = richContent?.title?.emoji;
  const oneLiner = article.one_liner;
  const summary = richContent?.summary?.text || article.summary_md || article.summary;
  const analogy = richContent?.summary?.analogy;
  const keyPoints =
    richContent?.keyPoints || article.key_points?.map((text) => ({ icon: "✅", text }));
  const keyTakeaways = article.key_takeaways || keyPoints?.slice(0, 5);
  const insightHtml = article.insight_html;
  const bodyHtml = article.body_html;
  const difficulty = richContent?.meta?.difficulty || article.difficulty;
  const readTime = richContent?.meta?.readTime;
  const category = richContent?.meta?.category || article.category;

  const publishedDate = new Date(article.published_at || article.created_at).toLocaleDateString(
    "en-US",
    DATE_FORMAT_OPTIONS
  );

  const isNew = isNewArticle(article.published_at, article.created_at);

  return (
    <>
      {/* View Tracking (admin only, not shown to users) */}
      <ViewTracker slug={slug} />

      {/* JSON-LD Structured Data */}
      <NewsArticleJsonLd article={article} />

      <article className="mx-auto max-w-4xl px-4 lg:px-6 py-8 md:py-10">
        {/* Back Navigation */}
        <Link
          href="/news"
          className="inline-flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mb-6 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 rounded"
          aria-label="Back to news list"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to News
        </Link>

        {/* Article Header */}
        <header className="mb-8">
          {/* Title */}
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-[var(--color-text-primary)] mb-4 leading-tight">
            {titleEmoji && <span className="mr-2">{titleEmoji}</span>}
            {title}
          </h1>

          {/* Meta Information */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--color-text-muted)]">
            <time
              className="flex items-center gap-1.5"
              dateTime={article.published_at || article.created_at}
            >
              <Calendar className="w-4 h-4" aria-hidden="true" />
              {publishedDate}
            </time>

            {category && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--color-bg-elevated)]">
                <Tag className="w-3.5 h-3.5" aria-hidden="true" />
                {category}
              </span>
            )}

            {readTime && (
              <span
                className="text-[var(--color-text-muted)]"
                aria-label={`Reading time: ${readTime}`}
              >
                <span aria-hidden="true">📖</span> {readTime}
              </span>
            )}

            {difficulty && (
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${DIFFICULTY_COLORS[difficulty as Difficulty]}`}
                aria-label={`Difficulty: ${DIFFICULTY_LABELS[difficulty as Difficulty]}`}
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

        {/* Hero Image (OG 이미지 배제, 3단계 폴백) */}
        {(() => {
          const thumbnailSrc = getThumbnailSrc(article);
          const categoryGradient = getCategoryGradient(article);
          const fallbackEmoji = getCategoryEmoji(article, titleEmoji);

          return (
            <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-8 bg-black/20">
              {thumbnailSrc ? (
                <Image
                  src={thumbnailSrc}
                  alt={title}
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 768px) 100vw, 800px"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${categoryGradient.from}30, ${categoryGradient.to}20)`,
                  }}
                >
                  <span className="text-8xl opacity-40" aria-hidden="true">
                    {fallbackEmoji}
                  </span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Key Takeaways (요약테이블) */}
        {keyTakeaways && keyTakeaways.length > 0 && (
          <section className="mb-8 p-5 rounded-xl bg-[var(--color-section-bg)] border border-[var(--border-default)]">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
              📌 Key Takeaways
            </h2>
            <ul className="space-y-2.5">
              {keyTakeaways.map((point, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2.5 text-[var(--color-text-secondary)]"
                >
                  <span className="text-base flex-shrink-0">{iconToEmoji(point.icon)}</span>
                  <span className="text-[15px] leading-relaxed">{point.text}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Article Body (본문) */}
        <div className="prose prose-lg max-w-none mb-8">
          {/* Summary/Intro - bodyHtml 없을 때만 */}
          {summary && !bodyHtml && (
            <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed">{summary}</p>
          )}

          {/* Analogy Box */}
          {analogy && (
            <div className="not-prose my-6 p-4 rounded-lg bg-blue-500/10 border-l-4 border-blue-500/50">
              <span className="mr-2 text-lg">{analogy.icon}</span>
              <span className="text-[var(--color-text-secondary)] italic">{analogy.text}</span>
            </div>
          )}

          {/* Full Body HTML */}
          {bodyHtml && (
            <div
              className="not-prose article-body"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(bodyHtml) }}
            />
          )}
        </div>

        {/* In Simple Terms - 본문 다음 배치 */}
        {insightHtml && (
          <div className="mb-6 p-5 rounded-xl bg-emerald-500/10 border-l-4 border-emerald-500/50">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
              🌱 In Simple Terms
            </h3>
            <div
              className="text-[var(--color-text-secondary)] leading-relaxed text-[15px]"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(insightHtml) }}
            />
          </div>
        )}

        {/* Fallback Insight from rich_content */}
        {!insightHtml && richContent?.summary?.analogy && (
          <div className="mb-6 p-5 rounded-xl bg-emerald-500/10 border-l-4 border-emerald-500/50">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
              🌱 In Simple Terms
            </h3>
            <p className="text-[var(--color-text-secondary)] leading-relaxed text-[15px]">
              {richContent.summary?.analogy?.text}
            </p>
          </div>
        )}

        {/* CTA / Share Section - In Simple Terms 다음 */}
        <CTASection articleUrl={`/news/${slug}`} articleTitle={title} oneLiner={oneLiner} />

        {/* Related Articles (최하단) */}
        {relatedNews.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
              🔗 Related Articles
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {relatedNews.map((related) => {
                const relatedThumbnail = getThumbnailSrc(related as ContentItem);
                const relatedGradient = getCategoryGradient(related as ContentItem);
                const relatedEmoji = getCategoryEmoji(related as ContentItem);

                return (
                  <Link
                    key={related.id}
                    href={related.slug ? `/news/${related.slug}` : "#"}
                    className="group p-3 rounded-lg bg-[var(--color-section-bg)] border border-[var(--border-default)] hover:border-[var(--border-hover)] transition-colors"
                  >
                    <div className="relative w-full aspect-video rounded-md overflow-hidden mb-2 bg-[var(--color-bg-elevated)]">
                      {relatedThumbnail ? (
                        <Image
                          src={relatedThumbnail}
                          alt={related.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="200px"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{
                            background: `linear-gradient(135deg, ${relatedGradient.from}25, ${relatedGradient.to}15)`,
                          }}
                        >
                          <span className="text-3xl opacity-50" aria-hidden="true">
                            {relatedEmoji}
                          </span>
                        </div>
                      )}
                    </div>
                    <h4 className="text-sm font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-claude-coral)] transition-colors line-clamp-2">
                      {related.title}
                    </h4>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Reference - 작은 footer 스타일 */}
        <div className="mb-8 pt-4 border-t border-[var(--border-default)]">
          <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
            Source:{" "}
            <a
              href={article.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] underline underline-offset-2 transition-colors"
            >
              {article.source_name || new URL(article.source_url).hostname}
            </a>
            {article.fact_check_score && article.fact_check_score >= 0.8 && (
              <span className="ml-2 text-green-500">✓ verified</span>
            )}
            <span className="mx-1.5">·</span>
            AI-reconstructed content. Verify with original source.
          </p>
        </div>
      </article>
    </>
  );
}
