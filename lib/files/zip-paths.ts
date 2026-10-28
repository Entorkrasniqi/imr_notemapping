/**
 * Paths inside a zip-based document (EPUB, PowerPoint). Pure string work, so
 * it can be tested without a browser; the parsing that needs a DOM lives in
 * `components/files/`.
 */

/**
 * Resolves `relative` — as written in a file at `fromPath` (e.g. an image
 * `src` in a chapter, or a relationship `Target`) — to a path from the zip's
 * root. Handles `..`, a leading `/`, percent-encoding, and drops any
 * `#fragment` or `?query`.
 */
export function resolveZipPath(fromPath: string, relative: string): string {
  const withoutSuffix = relative.split("#")[0].split("?")[0];
  let decoded = withoutSuffix;
  try {
    decoded = decodeURIComponent(withoutSuffix);
  } catch {
    // A stray "%" — use it as written.
  }
  const segments = decoded.startsWith("/") ? [] : fromPath.split("/").slice(0, -1);
  for (const part of decoded.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") segments.pop();
    else segments.push(part);
  }
  return segments.join("/");
}

/** `https:`, `mailto:`, `data:`… — anything with a scheme, i.e. not a path inside the book. */
export function isExternalHref(href: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(href.trim());
}

const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

/** The image type for a path, from its extension, or `null` for anything that isn't an image we draw. */
export function imageTypeOfPath(path: string): string | null {
  const extension = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase();
  return (extension && IMAGE_TYPES[extension]) || null;
}
