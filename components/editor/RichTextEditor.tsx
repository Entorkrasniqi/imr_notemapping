"use client";

import { useEffect } from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import { getNoteExtensions } from "@/lib/editor/extensions";
import Toolbar from "./Toolbar";

type RichTextEditorProps = {
  content: JSONContent | null;
  onChange: (content: JSONContent) => void;
};

/**
 * A note's live, editable rich-text surface, plus its formatting toolbar.
 *
 * This is only mounted while the note is selected (see `NoteNode`) — every
 * mounted instance is a full ProseMirror editor, which is not something we
 * want running for every note on a board at once. Because mounting and
 * selecting happen together, focusing on mount is enough to make a newly
 * selected (or newly created) note immediately typable — no separate
 * "autoFocus" flag needs to travel through node data.
 */
export default function RichTextEditor({
  content,
  onChange,
}: RichTextEditorProps) {
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
        class:
          "prose-note h-full p-3 text-sm text-zinc-800 outline-none focus:outline-none",
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      onChange(updatedEditor.getJSON());
    },
  });

  // This component only mounts while its note is selected, so focusing as
  // soon as the editor instance exists is exactly "focus when selected."
  useEffect(() => {
    editor?.commands.focus("end");
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="flex h-full flex-col">
      <Toolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="nodrag nowheel flex-1 overflow-y-auto"
      />
    </div>
  );
}
