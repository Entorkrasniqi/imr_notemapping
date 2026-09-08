import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The free plan's board cap, mirrored from the database trigger
 * (`enforce_free_plan_board_limit`, see the `boards_free_plan_limit`
 * migration and docs/database.md §6). This copy exists purely so the
 * dashboard can hide/disable "+ Create board" *before* a request goes
 * out — the trigger is what actually enforces the limit, and still
 * rejects a 4th insert even if this constant and the database ever
 * drift apart (a bug here fails safe: worse UX, not a bypass).
 */
export const FREE_PLAN_BOARD_LIMIT = 3;

export type BoardSummary = {
  id: string;
  name: string;
  updatedAt: string;
  noteCount: number;
};

type BoardListRow = {
  id: string;
  name: string;
  updated_at: string;
  // PostgREST's embedded-count shape: an array with exactly one row
  // holding the aggregate, not a bare number — confirmed against the
  // live database before writing this (see Phase 7 notes).
  nodes: { count: number }[];
};

function rowToBoardSummary(row: BoardListRow): BoardSummary {
  return {
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at,
    noteCount: row.nodes[0]?.count ?? 0,
  };
}

/**
 * Reads the signed-in user's plan from `profiles`. RLS's
 * `profiles_owner_select` policy scopes this to the caller's own row, so
 * there's no explicit `user_id` filter, same as everywhere else in this
 * file. Used purely for UI purposes — hiding "+ Create board" once a
 * free-plan user hits the limit — never as the actual enforcement, which
 * is `enforce_free_plan_board_limit()` re-checking this exact column at
 * insert time regardless of what the client believes.
 */
export async function getUserPlan(supabase: SupabaseClient): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("No authenticated session found");

  const { data, error } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", session.user.id)
    .single();
  if (error) throw error;
  return data.plan as string;
}

/**
 * Lists the signed-in user's boards, most recently updated first.
 * RLS (`boards_owner_all`) already limits this to rows the caller owns,
 * so there's no explicit `user_id` filter here — same pattern as
 * `board-sync.ts`. The note count comes from Postgres itself via
 * PostgREST's embedded-resource count syntax (`nodes(count)`), avoiding
 * an N+1 query per board card.
 */
export async function listBoards(
  supabase: SupabaseClient,
): Promise<BoardSummary[]> {
  const { data, error } = await supabase
    .from("boards")
    .select("id, name, updated_at, nodes(count)")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as BoardListRow[]).map(rowToBoardSummary);
}

/** Thrown when the free-plan limit rejects a board creation. */
export class BoardLimitError extends Error {
  constructor() {
    super("Free plan is limited to 3 boards");
    this.name = "BoardLimitError";
  }
}

/**
 * Creates a new board owned by the signed-in user (`user_id` defaults to
 * `auth.uid()` in Postgres, same as Phase 5 — see board-sync.ts).
 * `enforce_free_plan_board_limit` can reject this with a `P0001` error;
 * that's translated into `BoardLimitError` so callers don't need to know
 * the underlying Postgres error code.
 */
export async function createBoard(
  supabase: SupabaseClient,
  name: string,
): Promise<BoardSummary> {
  const { data, error } = await supabase
    .from("boards")
    .insert({ name })
    .select("id, name, updated_at")
    .single();

  if (error) {
    if (error.code === "P0001") throw new BoardLimitError();
    throw error;
  }
  return { id: data.id, name: data.name, updatedAt: data.updated_at, noteCount: 0 };
}

export async function renameBoard(
  supabase: SupabaseClient,
  boardId: string,
  name: string,
): Promise<void> {
  const { error } = await supabase
    .from("boards")
    .update({ name })
    .eq("id", boardId);
  if (error) throw error;
}

/** `on delete cascade` on nodes/edges' `board_id` handles the rest. */
export async function deleteBoard(
  supabase: SupabaseClient,
  boardId: string,
): Promise<void> {
  const { error } = await supabase.from("boards").delete().eq("id", boardId);
  if (error) throw error;
}
