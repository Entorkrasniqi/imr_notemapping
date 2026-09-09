"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useReactFlow } from "@xyflow/react";
import type { JSONContent } from "@tiptap/react";
import RichTextEditor from "@/components/editor/RichTextEditor";
import Toolbar from "@/components/editor/Toolbar";
import { useActiveEditor } from "@/lib/editor/active-editor-context";
import {
  buildContentFromTitleAndBody,
  extractBodyContent,
  extractTitleText,
  MAX_IMAGE_BYTES,
} from "@/lib/editor/content";
import type { NoteNode as NoteNodeType } from "@/types/canvas";

type NoteEditorModalProps = {
  note: NoteNodeType;
};

/**
 * The note-editing surface — a large, centered modal with its own
 * backdrop, replacing what used to be a small box that grew in place on
 * the canvas. Rendered via a portal straight to `document.body`,
 * deliberately *outside* React Flow's own rendered tree, not just
 * visually on top of it.
 *
 * That placement is what makes "pointer events stay inside the panel,
 * not the canvas" true structurally, rather than something bolted on
 * with extra props: React Flow's pan/zoom/click-to-deselect handling
 * only ever reacts to events reaching elements inside its own DOM tree.
 * A portal to `document.body` is a sibling of that tree, not a
 * descendant — so scrolling, clicking, or dragging inside this modal
 * simply never reaches React Flow's handlers at all, no `nowheel`/
 * `nodrag` class needed the way NoteNode still needs them for its
 * on-canvas preview. The backdrop covers the rest: a full-viewport,
 * click-catching layer above the canvas in stacking order, so nothing
 * behind it is reachable while this is open.
 *
 * `data-note-editor-modal` on the root is read by Board.tsx's
 * double-click-to-create-note guard — React portals still bubble
 * events through the *React* component tree even though this content's
 * actual DOM lives under `document.body`, so without that check,
 * double-clicking inside this modal would also create a new note on the
 * canvas underneath.
 *
 * The title is a genuinely separate field here, not just the first line
 * of the body editor — plain text, sitting in the header row next to
 * Cancel/Save, the same layout a title takes in most real note apps.
 * There's still only one `content` column in the database, though: a
 * note's title has always just *been* the first block of its document
 * (see `NotePreview`, which reads it that way for the canvas tile too),
 * so this only changes how it's *edited*, not how it's stored —
 * `extractTitleText`/`extractBodyContent`/`buildContentFromTitleAndBody`
 * (see lib/editor/content.ts) split that one document apart for editing
 * and reassemble it on every change, in both directions.
 */
export default function NoteEditorModal({ note }: NoteEditorModalProps) {
  const { updateNodeData } = useReactFlow();
  const { activeEditor, setEditingNoteId } = useActiveEditor();
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Captured once, when this note was opened — not kept in sync on every
  // keystroke — so "Cancel" has a fixed point to revert to. Deliberately
  // local to this one editing session rather than the board-wide
  // undo/redo stack: opening a note just to look at it and closing again
  // shouldn't leave a wasted checkpoint for some later, unrelated
  // Ctrl+Z to trip over.
  const [snapshot] = useState<JSONContent | null>(note.data.content);
  // Also captured once — the body editor (like the old single editor)
  // only reads its `content` prop at creation, so recomputing this every
  // render would just be discarded work, never a live re-sync.
  const [initialBodyContent] = useState<JSONContent>(() => extractBodyContent(note.data.content));
  const [title, setTitle] = useState(() => extractTitleText(note.data.content));
  const [isDragOver, setIsDragOver] = useState(false);

  const closeKeepingChanges = () => setEditingNoteId(null);
  const closeDiscardingChanges = () => {
    updateNodeData(note.id, { content: snapshot });
    setEditingNoteId(null);
  };

  // The title input owns focus when this modal opens — matching how most
  // note apps land you on the title first, and freeing RichTextEditor
  // from needing to grab focus for itself now that it's not the only
  // field anymore.
  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = event.target.value;
    setTitle(newTitle);
    // The body editor is the source of truth for its own current content
    // once it exists (`activeEditor.getJSON()`) — falling back to the
    // captured initial body only covers the brief window before it's
    // registered itself, which in practice a keystroke in the title
    // field is never fast enough to land inside.
    const currentBody = activeEditor?.getJSON() ?? initialBodyContent;
    updateNodeData(note.id, { content: buildContentFromTitleAndBody(newTitle, currentBody) });
  };

  // Enter in the title moves on to the body instead of doing nothing (a
  // plain `<input>` can't hold a newline anyway) — the same "title is
  // exactly one line, Enter takes you to the body" behavior most note
  // apps use.
  const handleTitleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    activeEditor?.commands.focus("start");
  };

  // Cmd/Ctrl+Enter — a fast, deliberate "I'm done" shortcut matching the
  // Save button. This and Escape (handled once, board-wide, in
  // Board.tsx) both just close-and-keep, on purpose: Cancel is the
  // *only* control that discards anything, and it takes a real,
  // deliberate click rather than a key that's easy to hit out of habit.
  // The reference design this modal is modeled on pairs Escape with
  // Cancel; this deliberately doesn't, since making the single easiest
  // key to hit reflexively also the one that throws work away is exactly
  // the kind of surprising data loss worth designing against, even at
  // the cost of not matching that reference exactly.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        closeKeepingChanges();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drag a JPEG in from the OS and drop it anywhere in the editor area to
  // embed it — this is the modal's equivalent of NoteNode's own drop
  // handler for a *closed* tile, and inserts through the live editor
  // (`activeEditor.chain()...`) so it appears immediately, the same way
  // typing does, rather than waiting for the note to be reopened.
  const handleDragOver = useCallback((event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
  }, []);

  const handleDragEnter = useCallback((event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);

      const file = event.dataTransfer.files[0];
      if (!file || file.type !== "image/jpeg") return;
      if (file.size > MAX_IMAGE_BYTES) {
        console.warn(`Image too large to embed (max 8MB): ${file.name}`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const src = reader.result;
        if (typeof src !== "string") return;
        activeEditor?.chain().focus().setImage({ src }).run();
      };
      reader.readAsDataURL(file);
    },
    [activeEditor],
  );

  return createPortal(
    <div
      data-note-editor-modal
      role="dialog"
      aria-modal="true"
      aria-label="Edit note"
      // Closing on a backdrop click matches "click away" everywhere else
      // in this app (e.g. the dashboard's rename input commits on blur) —
      // it dismisses, it doesn't discard.
      //
      // No background color or blur here, on purpose: this layer's job
      // is purely functional — catching clicks/scroll/drag so none of it
      // reaches the canvas underneath (see the component doc comment) —
      // not a visual dimming effect. The canvas stays exactly as sharp
      // and normal-looking behind the modal as it is with nothing open.
      onClick={closeKeepingChanges}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        // A fixed height (not a `max-h-*` cap) is deliberate: this panel
        // is always the same size regardless of how much or how little
        // the note actually contains, the same way the reference design
        // it's modeled on has one constant writing surface rather than a
        // box that grows and shrinks with content — a short note just
        // leaves more empty space below it, instead of shrinking the
        // whole panel down around a single line of text.
        className="flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 dark:bg-zinc-900 dark:ring-white/10 blueprint:bg-[#0f3057] blueprint:ring-white/15"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3 dark:border-white/10 blueprint:border-white/15">
          <input
            ref={titleInputRef}
            value={title}
            onChange={handleTitleChange}
            onKeyDown={handleTitleKeyDown}
            placeholder="Untitled"
            aria-label="Note title"
            className="min-w-0 flex-1 truncate border-none bg-transparent text-lg font-bold text-zinc-900 outline-none placeholder:font-normal placeholder:text-zinc-300 dark:text-white dark:placeholder:text-white/25 blueprint:text-white blueprint:placeholder:text-white/30"
          />
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={closeDiscardingChanges}
              className="rounded-full px-4 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white blueprint:text-white/60 blueprint:hover:bg-white/10 blueprint:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={closeKeepingChanges}
              className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 blueprint:border blueprint:border-white/40 blueprint:bg-transparent blueprint:text-white blueprint:hover:bg-white/10"
            >
              Save
              <kbd className="rounded bg-black/10 px-1.5 py-0.5 text-[11px] font-sans font-normal dark:bg-white/10 blueprint:bg-white/10">
                ⌘↵
              </kbd>
            </button>
          </div>
        </div>

        <div
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`min-h-0 flex-1 overflow-y-auto px-6 py-5 outline-2 -outline-offset-4 outline-dashed transition-[outline-color] [scrollbar-width:thin] [scrollbar-color:#d4d4d8_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-white/15 blueprint:[&::-webkit-scrollbar-thumb]:bg-white/20 ${
            isDragOver ? "outline-blue-400 blueprint:outline-white" : "outline-transparent"
          }`}
        >
          <RichTextEditor
            content={initialBodyContent}
            onChange={(bodyContent) =>
              updateNodeData(note.id, { content: buildContentFromTitleAndBody(title, bodyContent) })
            }
          />
        </div>

        {/* `overflow-x-auto` matters on narrow viewports specifically —
            the toolbar's controls don't wrap (see Toolbar's own
            `whitespace-nowrap`), so without a way to scroll sideways,
            anything past the visible width would just be unreachable
            rather than merely off-screen. */}
        <div className="shrink-0 overflow-x-auto border-t border-zinc-100 px-3 py-2 dark:border-white/10 blueprint:border-white/15">
          <Toolbar editor={activeEditor} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
