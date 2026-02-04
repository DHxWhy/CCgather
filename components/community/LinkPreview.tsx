"use client";

import { memo, useEffect, useState } from "react";
import { ExternalLink, Play, Github, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { type ParsedUrl } from "@/lib/url-parser";

// ===========================================
// Types
// ===========================================

interface LinkPreviewProps {
  parsedUrl: ParsedUrl;
  className?: string;
}

interface OGMetadata {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  type?: string;
  // GitHub specific
  stars?: number;
  forks?: number;
  language?: string;
  // Twitter specific
  author?: string;
  authorImage?: string;
}

// Language color mapping for GitHub
const languageColors: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Rust: "#dea584",
  Go: "#00ADD8",
  Java: "#b07219",
  "C++": "#f34b7d",
  C: "#555555",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
};

// ===========================================
// YouTube Embed Component (lite-youtube-embed)
// ===========================================

function YouTubeEmbed({ videoId, className }: { videoId: string; className?: string }) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Define the custom element if not already defined
    if (typeof window !== "undefined" && !customElements.get("lite-youtube")) {
      // @ts-expect-error - lite-youtube-embed has no type declarations
      import("lite-youtube-embed").then(() => {
        setIsLoaded(true);
      });
    } else {
      setIsLoaded(true);
    }
  }, []);

  if (!isLoaded) {
    // Loading placeholder
    return (
      <div
        className={cn(
          "relative aspect-video bg-[var(--color-bg-tertiary)] rounded-md overflow-hidden",
          className
        )}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-14 h-10 bg-red-600 rounded-lg flex items-center justify-center">
            <Play className="w-5 h-5 text-white fill-white" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-md overflow-hidden", className)}>
      {/* @ts-expect-error - lite-youtube is a web component */}
      <lite-youtube
        videoid={videoId}
        playlabel="Play video"
        style={{ backgroundImage: `url(https://i.ytimg.com/vi/${videoId}/hqdefault.jpg)` }}
      />
    </div>
  );
}

// ===========================================
// Twitter/X Card Component with API data
// ===========================================

function TwitterCard({ url, className }: { url: string; className?: string }) {
  const [metadata, setMetadata] = useState<OGMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const response = await fetch(`/api/og-metadata?url=${encodeURIComponent(url)}`);
        if (response.ok) {
          const data = await response.json();
          setMetadata(data);
        }
      } catch {
        // Ignore errors, show basic card
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetadata();
  }, [url]);

  // Compact loading skeleton
  if (isLoading) {
    return (
      <div
        className={cn(
          "flex items-center gap-2.5 p-2.5 rounded-md border animate-pulse",
          "bg-[var(--color-bg-tertiary)] border-[var(--border-default)]",
          className
        )}
      >
        <div className="w-4 h-4 rounded-full bg-[var(--color-bg-secondary)]" />
        <div className="flex-1 h-3.5 bg-[var(--color-bg-secondary)] rounded" />
      </div>
    );
  }

  // Compact X card - single line with icon
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-center gap-2.5 p-2.5 rounded-md border transition-colors",
        "bg-[var(--color-bg-tertiary)] border-[var(--border-default)]",
        "hover:border-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]",
        className
      )}
    >
      {/* X logo */}
      <div className="w-4 h-4 rounded-full bg-black flex items-center justify-center flex-shrink-0">
        <span className="text-white text-[10px] font-bold">𝕏</span>
      </div>

      {/* Content - single line */}
      <div className="flex-1 min-w-0">
        {metadata?.description ? (
          <p className="text-sm text-[var(--color-text-secondary)] truncate">
            {metadata.description}
          </p>
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)]">
            {metadata?.author ? `@${metadata.author}` : "View on X"}
          </p>
        )}
      </div>

      {/* External link icon */}
      <ExternalLink className="w-3.5 h-3.5 text-[var(--color-text-muted)] flex-shrink-0" />
    </a>
  );
}

// ===========================================
// GitHub Card Component with API data
// ===========================================

function GitHubCard({
  user,
  repo,
  url,
  className,
}: {
  user: string;
  repo: string;
  url: string;
  className?: string;
}) {
  const [metadata, setMetadata] = useState<OGMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const response = await fetch(`/api/og-metadata?url=${encodeURIComponent(url)}`);
        if (response.ok) {
          const data = await response.json();
          setMetadata(data);
        }
      } catch {
        // Ignore errors, show basic card
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetadata();
  }, [url]);

  // Compact loading skeleton
  if (isLoading) {
    return (
      <div
        className={cn(
          "p-2.5 rounded-md border animate-pulse",
          "bg-[var(--color-bg-tertiary)] border-[var(--border-default)]",
          className
        )}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded bg-[var(--color-bg-secondary)]" />
          <div className="flex-1 h-3.5 bg-[var(--color-bg-secondary)] rounded" />
        </div>
      </div>
    );
  }

  const langColor = metadata?.language ? languageColors[metadata.language] || "#8b8b8b" : null;

  // Compact GitHub card - two lines max
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "block p-2.5 rounded-md border transition-colors",
        "bg-[var(--color-bg-tertiary)] border-[var(--border-default)]",
        "hover:border-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]",
        className
      )}
    >
      {/* First row: icon + repo name + stats */}
      <div className="flex items-center gap-2">
        <Github className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />

        <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
          {user}/{repo}
        </span>

        {/* Stats inline */}
        <div className="flex items-center gap-2 ml-auto flex-shrink-0 text-[var(--color-text-muted)]">
          {metadata?.language && langColor && (
            <span className="flex items-center gap-1 text-xs">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: langColor }} />
              {metadata.language}
            </span>
          )}
          {metadata?.stars !== undefined && (
            <span className="flex items-center gap-0.5 text-xs">
              <Star className="w-3 h-3" />
              {metadata.stars >= 1000 ? `${(metadata.stars / 1000).toFixed(1)}k` : metadata.stars}
            </span>
          )}
        </div>

        <ExternalLink className="w-3.5 h-3.5 text-[var(--color-text-muted)] flex-shrink-0" />
      </div>

      {/* Second row: description (if exists) */}
      {metadata?.description && (
        <p className="text-xs text-[var(--color-text-secondary)] mt-1.5 line-clamp-1 pl-6">
          {metadata.description}
        </p>
      )}
    </a>
  );
}

// ===========================================
// Generic Link Card Component with OG data
// ===========================================

function GenericLinkCard({ url, className }: { url: string; className?: string }) {
  const [metadata, setMetadata] = useState<OGMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  // Extract domain from URL
  const domain = (() => {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return url;
    }
  })();

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const response = await fetch(`/api/og-metadata?url=${encodeURIComponent(url)}`);
        if (response.ok) {
          const data = await response.json();
          setMetadata(data);
        }
      } catch {
        // Ignore errors
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetadata();
  }, [url]);

  // Reset image error when URL changes
  useEffect(() => {
    setImageError(false);
  }, [url]);

  const hasValidImage = metadata?.image && !imageError;

  // Loading skeleton - Twitter/X style
  if (isLoading) {
    return (
      <div
        className={cn(
          "rounded-lg border overflow-hidden animate-pulse",
          "bg-[var(--color-bg-tertiary)] border-[var(--border-default)]",
          className
        )}
      >
        {/* Image skeleton */}
        <div className="aspect-[1.91/1] bg-[var(--color-bg-secondary)]" />
        {/* Content skeleton */}
        <div className="p-3 space-y-2">
          <div className="h-4 bg-[var(--color-bg-secondary)] rounded w-3/4" />
          <div className="h-3 bg-[var(--color-bg-secondary)] rounded w-1/2" />
        </div>
      </div>
    );
  }

  // Twitter/X style card with large image on top
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "block rounded-lg border overflow-hidden transition-all",
        "bg-[var(--color-bg-tertiary)] border-[var(--border-default)]",
        "hover:border-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]",
        className
      )}
    >
      {/* OG Image - Large banner style */}
      {hasValidImage && (
        <div className="relative aspect-[1.91/1] bg-[var(--color-bg-secondary)] overflow-hidden">
          <img
            src={metadata.image}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        </div>
      )}

      {/* Content section */}
      <div className="p-3">
        {/* Domain row */}
        <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] mb-1">
          <span className="truncate">{domain}</span>
          <ExternalLink className="w-3 h-3 flex-shrink-0" />
        </div>

        {/* Title - 2 lines max */}
        <h4 className="text-sm font-medium text-[var(--color-text-primary)] line-clamp-2 leading-snug">
          {metadata?.title || domain}
        </h4>

        {/* Description - 2 lines max */}
        {metadata?.description && (
          <p className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-2 leading-relaxed">
            {metadata.description}
          </p>
        )}
      </div>
    </a>
  );
}

// ===========================================
// Main LinkPreview Component
// ===========================================

function LinkPreviewComponent({ parsedUrl, className }: LinkPreviewProps) {
  switch (parsedUrl.type) {
    case "youtube":
      return parsedUrl.embedId ? (
        <YouTubeEmbed videoId={parsedUrl.embedId} className={className} />
      ) : null;

    case "twitter":
      return <TwitterCard url={parsedUrl.url} className={className} />;

    case "github":
      return parsedUrl.metadata?.user && parsedUrl.metadata?.repo ? (
        <GitHubCard
          user={parsedUrl.metadata.user}
          repo={parsedUrl.metadata.repo}
          url={parsedUrl.url}
          className={className}
        />
      ) : null;

    case "generic":
    default:
      return <GenericLinkCard url={parsedUrl.url} className={className} />;
  }
}

// Export memoized component
const LinkPreview = memo(LinkPreviewComponent);
export default LinkPreview;
