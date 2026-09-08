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

/**
 * Appends an image as a new block at the end of a note's content — used
 * when an image is dropped onto a note that *isn't* currently open for
 * editing, so there's no live editor instance to hand the image to
 * directly (see `NoteNode`'s drop handler, which uses this only in that
 * case — a note actively being edited inserts through its own editor
 * instance instead, via `editor.chain().setImage(...)`, so the change
 * shows up immediately rather than waiting for the note to be reopened).
 *
 * If the note was completely empty, the image becomes its first block —
 * fine on its own terms (an empty note's "title" slot just isn't text),
 * though the bold/larger title styling in globals.css has no visible
 * effect on an `<img>`.
 */
export function appendImageBlock(
  content: JSONContent | null,
  src: string,
): JSONContent {
  const imageBlock: JSONContent = { type: "image", attrs: { src } };
  if (isEmptyContent(content)) {
    return { type: "doc", content: [imageBlock] };
  }
  return {
    type: "doc",
    content: [...(content?.content ?? []), imageBlock],
  };
}
