"use client";

import { useEffect } from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import { getNoteExtensions } from "@/lib/editor/extensions";
import { isEmptyContent } from "@/lib/editor/content";
import { useActiveEditor } from "@/lib/editor/active-editor-context";

type RichTextEditorProps = {
  content: JSONContent | null;
  onChange: (content: JSONContent) => void;
};

/**
 * A note's live, editable rich-text surface — rendered directly inside the
 * note card so you type in place, exactly where the text will live.
 *
 * This is only mounted while the note is selected (see `NoteNode`) — every
 * mounted instance is a full ProseMirror editor, which is not something we
 * want running for every note on a board at once. Its formatting toolbar
 * is *not* rendered here: it lives in `FormattingDock`, a small floating
 * bar below the canvas, and finds this editor through `useActiveEditor`.
 */
export default function RichTextEditor({
  content,
  onChange,
}: RichTextEditorProps) {
  const { setActiveEditor } = useActiveEditor();

  const editor = useEditor({
    // Next.js still renders this client component's first HTML pass on the
    // server. Tiptap's editor DOM is built by ProseMirror and won't match
    // between server and client, so it must wait until after hydration —
    // this is the documented fix for the resulting hydration mismatch.
    immediatelyRender: false,
    extensions: getNoteExtensions(),
    content: content ?? undefined,
    editorProps: {
      attributes: {
        // Padding kept in sync with NotePreview's own `p-2`, and with the
        // NoteNode wrapper's `nodrag`-free margin around this component —
        // see the comment there for why the split matters.
        class:
          "prose-note h-full p-2 text-sm text-zinc-800 outline-none focus:outline-none dark:text-white/85 blueprint:text-white",
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      onChange(updatedEditor.getJSON());
    },
  });

  // Announce this editor as "the" active one while it's mounted, so the
  // floating formatting dock has something to act on. Only one note is
  // ever selected (and thus mounted) at a time, so there's never more
  // than one instance registering itself.
  useEffect(() => {
    setActiveEditor(editor ?? null);
    return () => setActiveEditor(null);
  }, [editor, setActiveEditor]);

  // This component only mounts while its note is selected, so focusing as
  // soon as the editor instance exists is exactly "focus when selected."
  useEffect(() => {
    editor?.commands.focus("end");
  }, [editor]);

  if (!editor) return null;

  // `nodrag` only applies once there's real text to protect. A brand-new
  // note enters edit mode immediately (so typing can start right away —
  // see NoteNode/Board), but it's also completely empty at that moment:
  // there's no text yet for a click-drag to accidentally select instead of
  // moving the note, so there's nothing for `nodrag` to protect either.
  // Without this, a freshly created note would need the same
  // drag-from-the-margin workaround as one full of text, on the very first
  // drag attempt, before you'd even typed anything into it.
  const isDraggable = isEmptyContent(content);

  return (
    <EditorContent
      editor={editor}
      // No `nowheel` here on purpose: the mouse wheel over a note being
      // edited should still zoom the canvas, same as everywhere else.
      className={`h-full overflow-y-auto ${isDraggable ? "" : "nodrag"}`}
    />
  );
}
