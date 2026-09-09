"use client";

import { useEffect } from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import { getNoteExtensions } from "@/lib/editor/extensions";
import { useActiveEditor } from "@/lib/editor/active-editor-context";

type RichTextEditorProps = {
  /** The note's *body* only — everything after its title block, per
   * `lib/editor/content.ts`'s `extractBodyContent`. The title itself is
   * a separate, plain-text field owned by `NoteEditorModal` now, not
   * part of this editor's document at all. */
  content: JSONContent;
  onChange: (content: JSONContent) => void;
};

/**
 * A note's live, editable rich-text body. Rendered exclusively inside
 * `NoteEditorModal` — never on the canvas itself, unlike in earlier
 * phases — so there's no `nodrag`/`nowheel` concern here at all: this
 * component isn't inside React Flow's own DOM tree, so React Flow's pan/
 * zoom/drag handling can't see gestures over it regardless of what class
 * names it carries. Scrolling, sizing, and padding are the modal's job
 * (see NoteEditorModal's own wrapper), not this component's.
 *
 * Its formatting toolbar is *not* rendered here: it lives in the same
 * modal, one level up, and finds this editor through `useActiveEditor`
 * rather than through props. Initial focus is also the modal's call —
 * it defaults to the title field instead, so this component doesn't
 * grab focus for itself the way it used to when it was the only field.
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
    content,
    editorProps: {
      attributes: {
        class:
          "prose-note text-base text-zinc-800 outline-none focus:outline-none dark:text-white/85 blueprint:text-white",
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      onChange(updatedEditor.getJSON());
    },
  });

  // Announce this editor as "the" active one while it's mounted, so the
  // modal's formatting toolbar has something to act on. Only one note is
  // ever open for editing at a time, so there's never more than one
  // instance registering itself.
  useEffect(() => {
    setActiveEditor(editor ?? null);
    return () => setActiveEditor(null);
  }, [editor, setActiveEditor]);

  if (!editor) return null;

  return <EditorContent editor={editor} />;
}
