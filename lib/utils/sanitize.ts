import sanitize from "sanitize-html";

/**
 * Sanitize HTML content to prevent XSS attacks
 * Uses a whitelist approach for allowed tags and attributes
 * Works on both server and client without jsdom dependency
 */
export function sanitizeHtml(html: string | undefined | null): string {
  if (!html) return "";

  return sanitize(html, {
    allowedTags: [
      // Text formatting
      "p",
      "br",
      "hr",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "mark",
      // Headings
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      // Lists
      "ul",
      "ol",
      "li",
      // Links and media
      "a",
      "img",
      // Code
      "code",
      "pre",
      // Quotes and blocks
      "blockquote",
      "q",
      // Tables (optional, for rich content)
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      // Other
      "span",
      "div",
      "section",
      "article",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel", "class", "id", "title"],
      img: ["src", "alt", "width", "height", "class", "id", "title"],
      "*": ["class", "id"],
    },
    // Transform links to add security attributes
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    },
  });
}

/**
 * Check if article was published within the last 24 hours
 */
export function isNewArticle(publishedAt: string | undefined | null, createdAt: string): boolean {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const date = new Date(publishedAt || createdAt);
  return Date.now() - date.getTime() < ONE_DAY_MS;
}
