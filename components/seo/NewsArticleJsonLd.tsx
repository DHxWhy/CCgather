import Script from "next/script";
import type { ContentItem } from "@/types/automation";

interface NewsArticleJsonLdProps {
  article: ContentItem;
}

export default function NewsArticleJsonLd({ article }: NewsArticleJsonLdProps) {
  const richContent = article.rich_content;
  const title = richContent?.title?.text || article.title;
  const description = richContent?.summary?.text || article.summary_md || article.summary || "";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: title,
    description: description.slice(0, 200),
    image: article.thumbnail_url ? [article.thumbnail_url] : ["https://ccgather.com/og-image.png"],
    datePublished: article.published_at || article.created_at,
    dateModified: article.updated_at || article.published_at || article.created_at,
    author: {
      "@type": "Organization",
      name: "CCgather",
      url: "https://ccgather.com",
    },
    publisher: {
      "@type": "Organization",
      name: "CCgather",
      logo: {
        "@type": "ImageObject",
        url: "https://ccgather.com/logo.png",
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://ccgather.com/news/${article.slug}`,
    },
    articleSection: richContent?.meta?.category || article.category || "News",
    keywords: article.tags?.join(", ") || "Claude Code, AI, Anthropic",
    isAccessibleForFree: true,
    // Attribution to original source
    citation: {
      "@type": "WebPage",
      name: article.source_name,
      url: article.source_url,
    },
  };

  return (
    <Script
      id="news-article-jsonld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
