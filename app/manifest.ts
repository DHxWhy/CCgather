import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CCgather - Global Claude Code Leaderboard",
    short_name: "CCgather",
    description:
      "Proof of your Claude Code dedication. Track your tokens and rise through the global rankings!",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0d0f",
    theme_color: "#da7756",
    orientation: "portrait-primary",
    scope: "/",
    icons: [
      {
        src: "/favicon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/CCgather_logo_512_black.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/CCgather_logo_144_black.png",
        sizes: "144x144",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logo_200x200.png",
        sizes: "200x200",
        type: "image/png",
        purpose: "any",
      },
    ],
    categories: ["developer-tools", "productivity"],
  };
}
