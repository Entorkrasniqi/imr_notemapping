import type { Node } from "@xyflow/react";
import type { JSONContent } from "@tiptap/react";

/**
 * Data carried by a "note" node.
 *
 * `content` is a Tiptap document (structured JSON, the same shape Tiptap's
 * `editor.getJSON()`/`useEditor({ content })` use) — not raw HTML and not a
 * plain string. Storing structured content instead of an HTML string means
 * we never need to sanitize untrusted markup when displaying a note later
 * (e.g. after loading it back from a database in Phase 5).
 */
export type NoteNodeData = {
  content: JSONContent | null;
};

export type NoteNode = Node<NoteNodeData, "note">;
