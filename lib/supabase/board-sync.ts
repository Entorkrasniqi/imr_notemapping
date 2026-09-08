import type { SupabaseClient } from "@supabase/supabase-js";
import {
  boardEdgeToRow,
  noteNodeToRow,
  rowToBoardEdge,
  rowToNoteNode,
  type EdgeRow,
  type NodeRow,
} from "@/lib/supabase/board-mapping";
import type { BoardEdge, NoteNode } from "@/types/canvas";

export type BoardSnapshot = {
  nodes: NoteNode[];
  edges: BoardEdge[];
};

/**
 * Returns the current user's id.
 *
 * Every table's Row Level Security policy is keyed off `auth.uid()` (see
 * docs/database.md) — without a session, every read comes back empty and
 * every write is rejected. Before Phase 6, that session came from an
 * anonymous sign-in performed right here, because there was no login
 * screen yet. Now `proxy.ts` redirects any signed-out visitor to `/login`
 * before this code ever runs, so by the time a board is loading, a real
 * session should already exist — this just reads it, and throws (rather
 * than quietly creating one) if that assumption is ever wrong, since that
 * would mean something upstream failed to protect the route.
 *
 * `getSession()`, not `getUser()`, is the right call here: this is the
 * browser's own client asking about its own already-established session,
 * not a server trying to decide whether to trust a request from someone
 * else — that distinction (and why `proxy.ts` uses `getUser()` instead)
 * is spelled out in that file's own comment.
 */
export async function ensureSession(
  supabase: SupabaseClient,
): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    throw new Error(
      "No authenticated session found — expected proxy.ts to have redirected to /login before this ran",
    );
  }
  return session.user.id;
}

/**
 * Thrown when a board id doesn't resolve to a row the caller owns —
 * either it never existed, or it belongs to someone else. RLS makes both
 * cases look identical from here (a mismatched-owner row is simply
 * invisible, not a permission error), which is exactly the property we
 * want: the canvas route can't distinguish "not yours" from "doesn't
 * exist" and shouldn't try to.
 */
export class BoardNotFoundError extends Error {
  constructor(boardId: string) {
    super(`Board ${boardId} not found`);
    this.name = "BoardNotFoundError";
  }
}

/**
 * Confirms `boardId` is a real board the signed-in user owns, throwing
 * `BoardNotFoundError` otherwise. Phase 7 replaced the single implicit
 * board this app used to assume (`getOrCreateBoard`, removed) with a
 * dashboard that picks a specific board id and navigates to
 * `/board/[boardId]` — that id can be stale (the board was deleted in
 * another tab, or a user edits the URL directly), so the canvas route
 * needs a way to tell "this board is genuinely empty" apart from "this
 * board isn't there," which an empty `nodes`/`edges` fetch alone can't do.
 */
export async function verifyBoardAccess(
  supabase: SupabaseClient,
  boardId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("boards")
    .select("id")
    .eq("id", boardId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new BoardNotFoundError(boardId);
}

/** Loads everything belonging to one board, mapped to the shape the canvas expects. */
export async function fetchBoardContents(
  supabase: SupabaseClient,
  boardId: string,
): Promise<BoardSnapshot> {
  const [nodesResult, edgesResult] = await Promise.all([
    supabase.from("nodes").select("*").eq("board_id", boardId),
    supabase.from("edges").select("*").eq("board_id", boardId),
  ]);
  if (nodesResult.error) throw nodesResult.error;
  if (edgesResult.error) throw edgesResult.error;

  return {
    nodes: (nodesResult.data as NodeRow[]).map(rowToNoteNode),
    edges: (edgesResult.data as EdgeRow[]).map(rowToBoardEdge),
  };
}

/**
 * Writes the current board state to Postgres: any note/edge whose id
 * wasn't in the *previous* synced set gets inserted, anything that still
 * exists gets updated (both via one `upsert` call each, keyed on the
 * primary key `id`), and anything that was there before but is missing
 * now gets explicitly deleted. `upsert` alone only ever adds or changes
 * rows — it has no way to know a row should be gone, which is exactly
 * why the previous id sets have to be tracked and diffed against here.
 *
 * Edges are deleted before nodes on purpose: a note that still has one of
 * its connections referenced by an *already-deleted* edge id would be
 * fine either way (`on delete cascade` handles a node disappearing out
 * from under an edge), but deleting edges first means this never relies
 * on that cascade for correctness — it's explicit either way.
 *
 * Returns the new "previous" id sets for the caller to remember for next time.
 */
export async function syncBoardToSupabase(
  supabase: SupabaseClient,
  boardId: string,
  snapshot: BoardSnapshot,
  previousNodeIds: ReadonlySet<string>,
  previousEdgeIds: ReadonlySet<string>,
): Promise<{ nodeIds: Set<string>; edgeIds: Set<string> }> {
  const currentNodeIds = new Set(snapshot.nodes.map((node) => node.id));
  const currentEdgeIds = new Set(snapshot.edges.map((edge) => edge.id));

  const edgeIdsToDelete = [...previousEdgeIds].filter(
    (id) => !currentEdgeIds.has(id),
  );
  const nodeIdsToDelete = [...previousNodeIds].filter(
    (id) => !currentNodeIds.has(id),
  );

  if (edgeIdsToDelete.length > 0) {
    const { error } = await supabase
      .from("edges")
      .delete()
      .in("id", edgeIdsToDelete);
    if (error) throw error;
  }
  if (nodeIdsToDelete.length > 0) {
    const { error } = await supabase
      .from("nodes")
      .delete()
      .in("id", nodeIdsToDelete);
    if (error) throw error;
  }

  if (snapshot.nodes.length > 0) {
    const { error } = await supabase
      .from("nodes")
      .upsert(snapshot.nodes.map((node) => noteNodeToRow(node, boardId)));
    if (error) throw error;
  }
  if (snapshot.edges.length > 0) {
    const { error } = await supabase
      .from("edges")
      .upsert(snapshot.edges.map((edge) => boardEdgeToRow(edge, boardId)));
    if (error) throw error;
  }

  return { nodeIds: currentNodeIds, edgeIds: currentEdgeIds };
}
