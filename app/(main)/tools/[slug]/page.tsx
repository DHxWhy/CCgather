import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import ToolDetailClient from "./ToolDetailClient";
import { CATEGORY_META, PRICING_META } from "@/types/tools";

// ===========================================
// Types
// ===========================================

interface ToolPageProps {
  params: Promise<{ slug: string }>;
}

interface ToolBasicData {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string | null;
  category: string;
  pricing_type: string;
  website_url: string;
  logo_url: string | null;
  upvote_count: number;
  status: string;
  created_at: string;
}

// ===========================================
// Data Fetching for Metadata
// ===========================================

async function getToolBySlug(slug: string): Promise<ToolBasicData | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("tools")
      .select(
        `
        id,
        name,
        slug,
        tagline,
        description,
        category,
        pricing_type,
        website_url,
        logo_url,
        upvote_count,
        status,
        created_at
      `
      )
      .eq("slug", slug)
      .in("status", ["approved", "featured"])
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

// ===========================================
// Metadata Generation
// ===========================================

export async function generateMetadata({ params }: ToolPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = await getToolBySlug(slug);

  if (!tool) {
    return {
      title: "Tool Not Found | CCgather",
      description: "The requested tool could not be found.",
    };
  }

  const categoryMeta = CATEGORY_META[tool.category as keyof typeof CATEGORY_META];
  const pricingMeta = PRICING_META[tool.pricing_type as keyof typeof PRICING_META];

  const title = `${tool.name} - ${categoryMeta?.label || "Tool"} | CCgather`;
  const description = tool.description
    ? `${tool.tagline}. ${tool.description.slice(0, 120)}...`
    : `${tool.tagline}. Discover ${tool.name}, a ${pricingMeta?.label?.toLowerCase() || "free"} ${categoryMeta?.label?.toLowerCase() || "tool"} for Claude Code developers.`;

  return {
    title,
    description,
    keywords: [
      tool.name,
      "Claude Code",
      "Claude Code tool",
      categoryMeta?.label || "Developer Tool",
      pricingMeta?.label || "Free",
      "AI tool",
      "developer tool",
      "Claude Code extension",
      "MCP server",
    ],
    openGraph: {
      title,
      description: tool.tagline,
      type: "website",
      url: `https://ccgather.com/tools/${tool.slug}`,
      images: tool.logo_url
        ? [
            {
              url: tool.logo_url,
              width: 200,
              height: 200,
              alt: tool.name,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary",
      title: tool.name,
      description: tool.tagline,
      images: tool.logo_url ? [tool.logo_url] : undefined,
    },
    alternates: {
      canonical: `https://ccgather.com/tools/${tool.slug}`,
    },
  };
}

// ===========================================
// JSON-LD Structured Data
// ===========================================

function ToolJsonLd({ tool }: { tool: ToolBasicData }) {
  const categoryMeta = CATEGORY_META[tool.category as keyof typeof CATEGORY_META];
  const pricingMeta = PRICING_META[tool.pricing_type as keyof typeof PRICING_META];

  // Determine pricing for schema
  const isPaid = tool.pricing_type === "paid" || tool.pricing_type === "freemium";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: tool.name,
    description: tool.description || tool.tagline,
    url: `https://ccgather.com/tools/${tool.slug}`,
    applicationCategory: "DeveloperApplication",
    applicationSubCategory: categoryMeta?.label || "Developer Tool",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: isPaid ? undefined : "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      category: pricingMeta?.label || "Free",
    },
    aggregateRating:
      tool.upvote_count > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: Math.min(5, 3 + tool.upvote_count / 20), // Scale votes to 3-5 rating
            ratingCount: tool.upvote_count,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
    datePublished: tool.created_at,
    image: tool.logo_url || undefined,
    publisher: {
      "@type": "Organization",
      name: "CCgather",
      url: "https://ccgather.com",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

// ===========================================
// Page Component
// ===========================================

export default async function ToolDetailPage({ params }: ToolPageProps) {
  const { slug } = await params;
  const tool = await getToolBySlug(slug);

  if (!tool) {
    notFound();
  }

  return (
    <>
      <ToolJsonLd tool={tool} />
      <ToolDetailClient initialTool={null} slug={slug} />
    </>
  );
}
