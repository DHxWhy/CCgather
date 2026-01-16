import { MetadataRoute } from "next";
import { createServiceClient } from "@/lib/supabase/server";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://ccgather.com";

// ===========================================
// Dynamic Sitemap with News & Tools
// ===========================================

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createServiceClient();

  // ===========================================
  // Static Pages
  // ===========================================
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/leaderboard`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/news`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/tools`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];

  // ===========================================
  // Dynamic Country League Pages
  // ===========================================
  const countries = [
    "US",
    "KR",
    "JP",
    "DE",
    "GB",
    "FR",
    "CA",
    "AU",
    "IN",
    "BR",
    "CN",
    "NL",
    "SE",
    "SG",
    "ES",
  ];

  const countryPages: MetadataRoute.Sitemap = countries.map((country) => ({
    url: `${BASE_URL}/league/${country}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  // ===========================================
  // Dynamic News Article Pages
  // ===========================================
  let newsPages: MetadataRoute.Sitemap = [];
  try {
    const { data: newsArticles } = await supabase
      .from("contents")
      .select("slug, updated_at, published_at")
      .eq("type", "news")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(500); // Limit to most recent 500 articles

    if (newsArticles) {
      newsPages = newsArticles.map(
        (article: { slug: string; updated_at: string | null; published_at: string }) => ({
          url: `${BASE_URL}/news/${article.slug}`,
          lastModified: new Date(article.updated_at || article.published_at),
          changeFrequency: "weekly" as const,
          priority: 0.6,
        })
      );
    }
  } catch (error) {
    console.error("Error fetching news for sitemap:", error);
  }

  // ===========================================
  // Dynamic Tool Pages
  // ===========================================
  let toolPages: MetadataRoute.Sitemap = [];
  try {
    const { data: tools } = await supabase
      .from("tools")
      .select("slug, updated_at, created_at")
      .in("status", ["approved", "featured"])
      .order("upvote_count", { ascending: false })
      .limit(500); // Limit to top 500 tools

    if (tools) {
      toolPages = tools.map(
        (tool: { slug: string; updated_at: string | null; created_at: string }) => ({
          url: `${BASE_URL}/tools/${tool.slug}`,
          lastModified: new Date(tool.updated_at || tool.created_at),
          changeFrequency: "weekly" as const,
          priority: 0.6,
        })
      );
    }
  } catch (error) {
    console.error("Error fetching tools for sitemap:", error);
  }

  return [...staticPages, ...countryPages, ...newsPages, ...toolPages];
}
