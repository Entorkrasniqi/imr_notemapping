"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  type ReactNode,
} from "react";
import type { BoardEdge, NoteNode } from "@/types/canvas";

type BoardSnapshot = { nodes: NoteNode[]; edges: BoardEdge[] };

type UseBoardHistoryOptions = {
  /** Reads the board's current state. Called at the moment of each undo
   * or redo, so it always needs the *latest* nodes/edges — pass a
   * function, not a value captured once. */
  getCurrent: () => BoardSnapshot;
  /** Replaces the board's state with a previously recorded snapshot. */
  restore: (snapshot: BoardSnapshot) => void;
};

/**
 * Undo/redo for board-level actions: creating or deleting a note,
 * dragging one, resizing one, connecting two notes, or deleting a
 * connection. Text typed inside a note is deliberately *not* part of
 * this — Tiptap already has its own undo/redo for that, scoped to
 * whichever note is being edited (see `RichTextEditor`'s extensions).
 * Folding every keystroke into this history too would make one Ctrl+Z
 * undo a single typed letter instead of the last board-level action, and
 * the two undo stacks would constantly fight over what "undo" means.
 *
 * This is a plain snapshot stack — each entry is the *entire* board's
 * nodes and edges, not a targeted "diff" or a reversible command. That
 * trades some memory (a full copy of the board per step, not just what
 * changed) for a much simpler guarantee: undoing always means "become
 * exactly this," with no risk of a hand-written inverse operation not
 * quite undoing what its forward operation did. For a note board, that's
 * an easy trade to make.
 */
export function useBoardHistory({ getCurrent, restore }: UseBoardHistoryOptions) {
  const past = useRef<BoardSnapshot[]>([]);
  const future = useRef<BoardSnapshot[]>([]);

  // Call this right *before* a board-level action is about to change the
  // nodes/edges — it captures "what to go back to," not "what just
  // happened." A fresh action always clears the redo stack: once you've
  // done something new, the old "future" no longer follows from the
  // present.
  const recordBeforeChange = useCallback(() => {
    past.current.push(getCurrent());
    future.current = [];
  }, [getCurrent]);

  const undo = useCallback(() => {
    const previous = past.current.pop();
    if (!previous) return;
    future.current.push(getCurrent());
    restore(previous);
  }, [getCurrent, restore]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(getCurrent());
    restore(next);
  }, [getCurrent, restore]);

  return { recordBeforeChange, undo, redo };
}

// A small, separate context just for `recordBeforeChange`: it needs to
// reach components rendered *inside* the canvas (a note's own resize
// handles, specifically) that don't otherwise have a way back up to
// wherever the history stack itself lives.
const RecordBeforeChangeContext = createContext<(() => void) | null>(null);

export function RecordBeforeChangeProvider({
  value,
  children,
}: {
  value: () => void;
  children: ReactNode;
}) {
  return (
    <RecordBeforeChangeContext.Provider value={value}>
      {children}
    </RecordBeforeChangeContext.Provider>
  );
}

export function useRecordBeforeChange() {
  const context = useContext(RecordBeforeChangeContext);
  if (!context) {
    throw new Error(
      "useRecordBeforeChange must be used within a RecordBeforeChangeProvider",
    );
  }
  return context;
}
