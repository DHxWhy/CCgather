/**
 * Sanitize HTML content to prevent XSS attacks
 * Uses a whitelist approach for allowed tags and attributes
 * Pure JavaScript implementation without external dependencies
 */

const ALLOWED_TAGS = new Set([
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
  // Tables
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
]);

const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel", "class", "id", "title"]),
  img: new Set(["src", "alt", "width", "height", "class", "id", "title"]),
  "*": new Set(["class", "id"]),
};

// Dangerous protocols to block
const DANGEROUS_PROTOCOLS = /^(javascript|vbscript|data):/i;

function sanitizeAttribute(tagName: string, attrName: string, attrValue: string): string | null {
  const lowerAttrName = attrName.toLowerCase();
  const tagAllowed = ALLOWED_ATTRIBUTES[tagName.toLowerCase()];
  const globalAllowed = ALLOWED_ATTRIBUTES["*"];

  if (!tagAllowed?.has(lowerAttrName) && !globalAllowed?.has(lowerAttrName)) {
    return null;
  }

  // Check for dangerous protocols in href/src
  if (
    (lowerAttrName === "href" || lowerAttrName === "src") &&
    DANGEROUS_PROTOCOLS.test(attrValue)
  ) {
    return null;
  }

  return attrValue;
}

export function sanitizeHtml(html: string | undefined | null): string {
  if (!html) return "";

  // Remove script, style, and other dangerous tags completely
  let result = html.replace(
    /<(script|style|iframe|object|embed|form|input|button)[^>]*>[\s\S]*?<\/\1>/gi,
    ""
  );
  result = result.replace(/<(script|style|iframe|object|embed|form|input|button)[^>]*\/?>/gi, "");

  // Remove event handlers
  result = result.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "");
  result = result.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, "");

  // Process remaining tags
  result = result.replace(
    /<\/?([a-z][a-z0-9]*)((?:\s+[^>]*)?)\s*\/?>/gi,
    (match, tagName, attributes) => {
      const lowerTag = tagName.toLowerCase();

      // Remove disallowed tags
      if (!ALLOWED_TAGS.has(lowerTag)) {
        return "";
      }

      // Check if it's a closing tag
      if (match.startsWith("</")) {
        return `</${lowerTag}>`;
      }

      // Process attributes
      const sanitizedAttrs: string[] = [];

      if (attributes) {
        // Match attributes: name="value", name='value', or name=value
        const attrRegex = /([a-z][a-z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
        let attrMatch;

        while ((attrMatch = attrRegex.exec(attributes)) !== null) {
          const attrName = attrMatch[1] ?? "";
          const attrValue = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? "";

          if (!attrName) continue;

          const sanitizedValue = sanitizeAttribute(lowerTag, attrName, attrValue);
          if (sanitizedValue !== null) {
            // Escape quotes in attribute value
            const escapedValue = sanitizedValue.replace(/"/g, "&quot;");
            sanitizedAttrs.push(`${attrName.toLowerCase()}="${escapedValue}"`);
          }
        }
      }

      // Add security attributes to links
      if (lowerTag === "a") {
        if (!sanitizedAttrs.some((a) => a.startsWith("target="))) {
          sanitizedAttrs.push('target="_blank"');
        }
        if (!sanitizedAttrs.some((a) => a.startsWith("rel="))) {
          sanitizedAttrs.push('rel="noopener noreferrer"');
        }
      }

      // Build the sanitized tag
      const isSelfClosing = match.endsWith("/>") || ["br", "hr", "img"].includes(lowerTag);
      const attrString = sanitizedAttrs.length > 0 ? " " + sanitizedAttrs.join(" ") : "";

      return isSelfClosing ? `<${lowerTag}${attrString} />` : `<${lowerTag}${attrString}>`;
    }
  );

  return result;
}

/**
 * Check if article was published within the last 24 hours
 */
export function isNewArticle(publishedAt: string | undefined | null, createdAt: string): boolean {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const date = new Date(publishedAt || createdAt);
  return Date.now() - date.getTime() < ONE_DAY_MS;
}
