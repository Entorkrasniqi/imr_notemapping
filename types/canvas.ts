import type { Edge, Node } from "@xyflow/react";
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
  /**
   * Unused as of the editor-modal redesign — kept only so existing rows
   * with a saved value don't need a migration to drop the column. It
   * used to hold a note's pre-collapse height, back when opening a note
   * for editing grew its canvas tile in place; now editing always opens
   * `NoteEditorModal` instead, so a tile's size is a plain, direct
   * resize choice with no separate "expanded" state to remember.
   */
  expandedHeight?: number;
};

export type NoteNode = Node<NoteNodeData, "note">;

/**
 * A connection between two notes. No custom data of its own yet — plain
 * React Flow edges, rendered through our `deletable` edge type (see
 * `components/canvas/DeletableEdge.tsx`) for the delete-on-click affordance.
 */
export type BoardEdge = Edge<Record<string, never>, "deletable">;
