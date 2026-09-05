import type { JSONContent } from "@tiptap/react";

/** A single, empty paragraph — the "nothing typed yet" state for a note. */
export const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

/**
 * Whether a note's stored content amounts to no real text at all (either
 * `null`, or just the empty paragraph every note starts with).
 *
 * Shared between `NoteNode` (to decide whether to show its placeholder
 * text) and `RichTextEditor` (to decide whether dragging over the content
 * should still be allowed — see the comment there for why that matters).
 */
export function isEmptyContent(content: JSONContent | null): boolean {
  if (!content?.content) return true;
  return content.content.every(
    (node) => node.type === "paragraph" && !node.content?.length,
  );
}
