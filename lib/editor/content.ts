import type { JSONContent } from "@tiptap/react";

// A dropped image is embedded directly in a note's own JSON as a base64
// data URL — there's no file upload/storage backend yet (that's Phase 5).
// This caps how large a single embed can get, since base64 inflates a
// file's size by roughly a third and everything lives in memory/React
// state until then. Shared between `NoteNode` (dropping onto a closed
// tile) and `NoteEditorModal` (dropping while a note is open).
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

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

/**
 * A note's title, as plain text — the first block of its document, with
 * any rich-text marks stripped. Used to seed `NoteEditorModal`'s title
 * field, which edits the title as plain text (no bold/color/etc. of its
 * own) in exchange for being a real, separate input sitting in the
 * modal's header row instead of just the first line of the scrollable
 * body — the title was always visually distinct via CSS (see
 * `.prose-note.tiptap > *:first-child` in globals.css) even before that
 * split, so this mostly formalizes a distinction that already existed.
 */
export function extractTitleText(content: JSONContent | null): string {
  const titleBlock = content?.content?.[0];
  if (!titleBlock?.content) return "";
  return titleBlock.content.map((node) => node.text ?? "").join("");
}

/**
 * The body portion of a note's document — every block *after* the title
 * (the first one). Always has at least one paragraph, even if empty:
 * that's the minimum a valid Tiptap/ProseMirror document needs, the same
 * reason `EMPTY_DOC` above isn't just `{ type: "doc", content: [] }`.
 */
export function extractBodyContent(content: JSONContent | null): JSONContent {
  const bodyBlocks = content?.content?.slice(1) ?? [];
  return { type: "doc", content: bodyBlocks.length > 0 ? bodyBlocks : [{ type: "paragraph" }] };
}

/**
 * Reassembles a note's full document from a plain-text title and
 * whatever body content follows it — the inverse of
 * `extractTitleText`/`extractBodyContent`. `NoteEditorModal` calls this
 * on every edit to either field, since both write back through the same
 * `content` column — there's no separate "title" field in the database,
 * just a document whose first block is understood to be one.
 */
export function buildContentFromTitleAndBody(
  title: string,
  bodyContent: JSONContent,
): JSONContent {
  const titleBlock: JSONContent = title
    ? { type: "paragraph", content: [{ type: "text", text: title }] }
    : { type: "paragraph" };
  return { type: "doc", content: [titleBlock, ...(bodyContent.content ?? [])] };
}
