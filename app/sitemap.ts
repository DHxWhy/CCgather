import { MetadataRoute } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import { ALL_COUNTRIES } from "@/lib/constants/countries";

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
      url: `${BASE_URL}/tools`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];

  // ===========================================
  // Dynamic Country League Pages (All Countries)
  // ===========================================
  const countryPages: MetadataRoute.Sitemap = ALL_COUNTRIES.map((country) => ({
    url: `${BASE_URL}/league/${country.code}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

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

  return [...staticPages, ...countryPages, ...toolPages];
}
