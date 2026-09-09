"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";

type ActiveEditorContextValue = {
  activeEditor: Editor | null;
  setActiveEditor: (editor: Editor | null) => void;
  /** The id of the note currently in text-edit mode, or `null` if none is. */
  editingNoteId: string | null;
  setEditingNoteId: (id: string | null) => void;
};

const ActiveEditorContext = createContext<ActiveEditorContextValue | null>(null);

/**
 * Tracks two related things for the whole board:
 *
 *  - `activeEditor`: which note's Tiptap editor instance is currently
 *    mounted, so the formatting toolbar embedded in `NoteEditorModal`'s
 *    footer knows which editor its buttons should act on.
 *  - `editingNoteId`: which note is open for editing at all — i.e. which
 *    one `NoteEditorModal` should be showing, if any.
 *
 * `editingNoteId` is deliberately *not* the same thing as "which note is
 * selected" on the canvas. Selecting a note (a single click) highlights
 * its tile and shows its resize/connection handles there — that's a
 * React-Flow-native concept, tracked as each node's own `selected` flag,
 * unrelated to whether its *editor* is open. A single click currently
 * sets both at once (see Board.tsx's `handleNodeClick`), but they stay
 * two separate pieces of state because they mean different things: one is
 * about a tile on the canvas, the other is about a modal that isn't part
 * of the canvas at all.
 */
export function ActiveEditorProvider({ children }: { children: ReactNode }) {
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const value = useMemo(
    () => ({ activeEditor, setActiveEditor, editingNoteId, setEditingNoteId }),
    [activeEditor, editingNoteId],
  );

  return (
    <ActiveEditorContext.Provider value={value}>
      {children}
    </ActiveEditorContext.Provider>
  );
}

export function useActiveEditor() {
  const context = useContext(ActiveEditorContext);
  if (!context) {
    throw new Error("useActiveEditor must be used within an ActiveEditorProvider");
  }
  return context;
}
