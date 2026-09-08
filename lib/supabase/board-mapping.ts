import type { JSONContent } from "@tiptap/react";
import type { BoardEdge, NoteNode } from "@/types/canvas";

/**
 * The shape of a row in the `nodes`/`edges` tables, as Postgres actually
 * stores it (see docs/database.md) — flat columns, snake_case, no notion
 * of React Flow's `data`/`position` nesting. This is a genuinely different
 * shape from `NoteNode`/`BoardEdge`, which is why explicit mapping
 * functions exist below rather than just casting one to the other.
 */
export type NodeRow = {
  id: string;
  board_id: string;
  type: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  content: JSONContent | Record<string, never>;
  expanded_height: number | null;
};

export type EdgeRow = {
  id: string;
  board_id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle: string | null;
  target_handle: string | null;
};

const DEFAULT_NOTE_WIDTH = 240;
const DEFAULT_NOTE_HEIGHT = 160;

/**
 * `content jsonb not null default '{}'::jsonb` — the column can never
 * hold SQL `NULL`, so an "empty" note is stored as `{}`, not `null`.
 * `NoteNodeData.content`, on the other hand, uses `null` for "nothing
 * typed yet" (see types/canvas.ts). This is the translation between the
 * two: `{}` in the database becomes `null` in the app, and vice versa in
 * `noteNodeToRow` below.
 */
function isEmptyRowContent(
  content: JSONContent | Record<string, never>,
): content is Record<string, never> {
  return !content || Object.keys(content).length === 0;
}

/** A database row → the shape React Flow (and the rest of the app) expects. */
export function rowToNoteNode(row: NodeRow): NoteNode {
  return {
    id: row.id,
    type: "note",
    position: { x: row.position_x, y: row.position_y },
    width: row.width,
    height: row.height,
    data: {
      content: isEmptyRowContent(row.content) ? null : row.content,
      expandedHeight: row.expanded_height ?? undefined,
    },
  };
}

/** The reverse of `rowToNoteNode` — what to write back for a given note. */
export function noteNodeToRow(
  node: NoteNode,
  boardId: string,
): NodeRow {
  return {
    id: node.id,
    board_id: boardId,
    type: node.type ?? "note",
    position_x: node.position.x,
    position_y: node.position.y,
    width: node.width ?? DEFAULT_NOTE_WIDTH,
    height: node.height ?? DEFAULT_NOTE_HEIGHT,
    content: node.data.content ?? {},
    expanded_height: node.data.expandedHeight ?? null,
  };
}

export function rowToBoardEdge(row: EdgeRow): BoardEdge {
  return {
    id: row.id,
    type: "deletable",
    source: row.source_node_id,
    target: row.target_node_id,
    sourceHandle: row.source_handle,
    targetHandle: row.target_handle,
  };
}

export function boardEdgeToRow(edge: BoardEdge, boardId: string): EdgeRow {
  return {
    id: edge.id,
    board_id: boardId,
    source_node_id: edge.source,
    target_node_id: edge.target,
    source_handle: edge.sourceHandle ?? null,
    target_handle: edge.targetHandle ?? null,
  };
}
