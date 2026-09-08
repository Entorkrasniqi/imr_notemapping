"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ensureSession,
  fetchBoardContents,
  verifyBoardAccess,
  BoardNotFoundError,
  syncBoardToSupabase,
} from "@/lib/supabase/board-sync";
import type { BoardEdge, NoteNode } from "@/types/canvas";

// Same reasoning as Phase 4's localStorage debounce: a drag fires a
// position update every frame, typing fires one every keystroke — saving
// only once things settle keeps this to one round trip per pause in
// activity instead of dozens per second.
const SAVE_DEBOUNCE_MS = 400;

type UseSupabaseBoardSyncOptions = {
  boardId: string;
  nodes: NoteNode[];
  edges: BoardEdge[];
  setNodes: (nodes: NoteNode[]) => void;
  setEdges: (edges: BoardEdge[]) => void;
};

export type BoardSyncStatus = "loading" | "ready" | "error" | "not-found";

/**
 * Phase 5's replacement for Phase 4's `useBoardPersistence`: the board
 * now lives in Postgres, not `localStorage`. The shape of the work is the
 * same — load once, save (debounced) on every change after that — but
 * loading is now a real network request that can fail, which is why this
 * exposes a `status` the caller can render a loading/error state from,
 * where the old hook could just assume `localStorage` was there.
 */
export function useSupabaseBoardSync({
  boardId,
  nodes,
  edges,
  setNodes,
  setEdges,
}: UseSupabaseBoardSyncOptions) {
  // One client per mounted board, not one per render — `createClient()`
  // itself is cheap, but re-creating it every render would be pointless.
  const supabase = useMemo(() => createClient(), []);

  const [status, setStatus] = useState<BoardSyncStatus>("loading");
  const [retryToken, setRetryToken] = useState(0);

  const boardIdRef = useRef<string | null>(null);
  // What was last written to Postgres, so `syncBoardToSupabase` can tell
  // "removed since last save" apart from "still here" — see that
  // function's own comment for why a plain `upsert` can't do this alone.
  const previousNodeIds = useRef<Set<string>>(new Set());
  const previousEdgeIds = useRef<Set<string>>(new Set());
  // Guards the save effect from firing before the load effect finishes —
  // otherwise the first render's empty `nodes: []` could get saved
  // (deleting everything) in the window before the real data arrives.
  const hasLoaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    hasLoaded.current = false;

    async function load() {
      setStatus("loading");
      try {
        await ensureSession(supabase);
        await verifyBoardAccess(supabase, boardId);
        const snapshot = await fetchBoardContents(supabase, boardId);
        if (cancelled) return;

        boardIdRef.current = boardId;
        previousNodeIds.current = new Set(snapshot.nodes.map((node) => node.id));
        previousEdgeIds.current = new Set(snapshot.edges.map((edge) => edge.id));
        // Nothing should appear "selected" the instant a freshly loaded
        // board shows up — that was interaction state from a previous
        // visit, not part of the board's actual saved content.
        setNodes(snapshot.nodes.map((node) => ({ ...node, selected: false })));
        setEdges(snapshot.edges);
        hasLoaded.current = true;
        setStatus("ready");
      } catch (error) {
        if (cancelled) return;
        if (error instanceof BoardNotFoundError) {
          setStatus("not-found");
          return;
        }
        console.error("Failed to load board from Supabase:", error);
        setStatus("error");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, boardId, setNodes, setEdges, retryToken]);

  useEffect(() => {
    if (!hasLoaded.current || !boardIdRef.current) return;
    const boardId = boardIdRef.current;

    const timeoutId = setTimeout(() => {
      syncBoardToSupabase(
        supabase,
        boardId,
        { nodes, edges },
        previousNodeIds.current,
        previousEdgeIds.current,
      )
        .then(({ nodeIds, edgeIds }) => {
          previousNodeIds.current = nodeIds;
          previousEdgeIds.current = edgeIds;
        })
        .catch((error) => {
          console.error("Failed to save board to Supabase:", error);
        });
    }, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [nodes, edges, supabase]);

  const retry = useCallback(() => setRetryToken((token) => token + 1), []);

  return { status, retry };
}
