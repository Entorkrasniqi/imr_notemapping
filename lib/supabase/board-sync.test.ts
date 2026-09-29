import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { BoardNotFoundError, syncBoardToSupabase, verifyBoardAccess } from "./board-sync";
import { createBoard, BoardLimitError } from "./boards";
import { boardEdgeToRow, noteNodeToRow, rowToBoardEdge, rowToNoteNode, type NodeRow } from "./board-mapping";
import type { BoardEdge, NoteNode } from "@/types/canvas";

/** Records every write, in order, the way PostgREST would receive them. */
function recordingClient(options: { boardExists?: boolean; insertError?: { code: string } } = {}) {
  const calls: string[] = [];
  const client = {
    from: (table: string) => ({
      delete: () => ({
        in: async (_column: string, ids: string[]) => {
          calls.push(`delete ${table} ${ids.join(",")}`);
          return { error: null };
        },
      }),
      upsert: async (rows: { id: string }[]) => {
        calls.push(`upsert ${table} ${rows.map((row) => row.id).join(",")}`);
        return { error: null };
      },
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: options.boardExists ? { id: "b1" } : null, error: null }) }),
      }),
      insert: () => ({
        select: () => ({
          single: async () =>
            options.insertError
              ? { data: null, error: options.insertError }
              : { data: { id: "b2", name: "New", updated_at: "2026-01-01T00:00:00Z" }, error: null },
        }),
      }),
    }),
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const note = (id: string): NoteNode => ({
  id,
  type: "note",
  position: { x: 0, y: 0 },
  width: 240,
  height: 56,
  data: { content: null },
});
const edge = (id: string, source: string, target: string): BoardEdge => ({ id, type: "deletable", source, target });

describe("syncBoardToSupabase", () => {
  it("deletes what disappeared, edges before notes, then upserts notes before edges", async () => {
    const { client, calls } = recordingClient();
    const result = await syncBoardToSupabase(
      client,
      "b1",
      { nodes: [note("n1"), note("n3")], edges: [edge("e2", "n1", "n3")] },
      new Set(["n1", "n2"]),
      new Set(["e1"]),
    );
    expect(calls).toEqual(["delete edges e1", "delete nodes n2", "upsert nodes n1,n3", "upsert edges e2"]);
    expect([...result.nodeIds]).toEqual(["n1", "n3"]);
    expect([...result.edgeIds]).toEqual(["e2"]);
  });

  it("sends nothing for an empty, unchanged board", async () => {
    const { client, calls } = recordingClient();
    await syncBoardToSupabase(client, "b1", { nodes: [], edges: [] }, new Set(), new Set());
    expect(calls).toEqual([]);
  });
});

describe("verifyBoardAccess", () => {
  it("treats a board RLS hides exactly like one that doesn't exist", async () => {
    await expect(verifyBoardAccess(recordingClient({ boardExists: false }).client, "b1")).rejects.toBeInstanceOf(
      BoardNotFoundError,
    );
    await expect(verifyBoardAccess(recordingClient({ boardExists: true }).client, "b1")).resolves.toBeUndefined();
  });
});

describe("createBoard", () => {
  it("turns the database's free-plan rejection into BoardLimitError", async () => {
    const { client } = recordingClient({ insertError: { code: "P0001" } });
    await expect(createBoard(client, "Fourth")).rejects.toBeInstanceOf(BoardLimitError);
  });
});

describe("board mapping", () => {
  it("stores an empty note as {} and reads it back as null", () => {
    const row = noteNodeToRow(note("n1"), "b1");
    expect(row.content).toEqual({});
    expect(rowToNoteNode(row as NodeRow).data.content).toBeNull();
  });

  it("round-trips edges, including their handle ids", () => {
    const original: BoardEdge = { ...edge("e1", "n1", "n2"), sourceHandle: "right-0.5", targetHandle: "top-left" };
    expect(rowToBoardEdge(boardEdgeToRow(original, "b1"))).toEqual(original);
  });
});
