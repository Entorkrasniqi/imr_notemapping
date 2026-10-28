import type DOMPurifyType from "dompurify";

type DOMPurify = typeof DOMPurifyType;

let hooked = false;

/**
 * Every document viewer (Word, EPUB) turns someone else's markup into HTML
 * and puts it in the page, so all of it goes through DOMPurify first. It
 * drops scripts, event handlers, `javascript:` addresses, forms, frames and
 * inline styles; the CSP (no inline script, no eval) is a second wall.
 * Every link that survives opens in a new tab with no access to this one.
 *
 * Takes the DOMPurify instance so callers can load it lazily (it needs a
 * browser, and nothing needs it until a document is opened).
 */
export function sanitizeDocumentHtml(purify: DOMPurify, html: string): string {
  if (!hooked) {
    hooked = true;
    purify.addHook("afterSanitizeAttributes", (node) => {
      if (node.tagName === "A") {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    });
  }
  return purify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "link", "form", "input", "button", "textarea", "select", "iframe", "object", "embed", "svg", "math"],
    FORBID_ATTR: ["style"],
  }) as string;
}
