import { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://ccgather.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/onboarding", "/settings", "/cli/", "/internal/"],
      },
      {
        userAgent: "Googlebot",
        allow: ["/", "/_next/static/", "/api/tools", "/api/news", "/api/leaderboard"],
        disallow: ["/api/", "/admin/", "/internal/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
