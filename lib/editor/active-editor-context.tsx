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
 *    mounted, so the shared formatting dock
 *    (`components/canvas/FormattingDock.tsx`) knows which editor its
 *    buttons should act on.
 *  - `editingNoteId`: which note is in text-edit mode at all — i.e. which
 *    one `NoteNode` should render its live `RichTextEditor` for, versus
 *    the read-only preview.
 *
 * These are deliberately *not* the same thing as "which note is selected."
 * Selecting a note (a single click) only highlights it and shows its
 * resize/connection handles — it stays fully draggable from anywhere,
 * exactly like an unselected note, because its content is still the
 * read-only preview (no `nodrag` anywhere in it). Entering text-edit mode
 * is a separate, deliberate action (double-click) precisely because that's
 * the one state where clicking-and-dragging over the content needs to mean
 * "select text," not "move the note" — conflating the two made every
 * selected note sticky to drag, since almost its whole surface became
 * `nodrag` the moment it was merely clicked once.
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
