import StarterKit from "@tiptap/starter-kit";
import { Color, FontSize, TextStyle } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import type { AnyExtension } from "@tiptap/core";

/**
 * The single list of Tiptap extensions a note supports.
 *
 * This is called from two places that must stay in agreement:
 *  - `RichTextEditor`, for the live, editable instance.
 *  - `NoteNode`'s read-only preview, which uses `generateHTML` to render a
 *    note's stored JSON without mounting a full editor.
 *
 * If the two ever used different extension lists, a note edited with one
 * set could render incorrectly (or drop formatting) under the other.
 */
export function getNoteExtensions(): AnyExtension[] {
  return [
    StarterKit,
    // TextStyle is the base mark that Color/FontSize attach their
    // attributes to (a `<span style="...">` wrapper around styled text).
    TextStyle,
    Color,
    FontSize,
    TextAlign.configure({
      types: ["heading", "paragraph"],
    }),
    Highlight.configure({ multicolor: true }),
    Placeholder.configure({
      placeholder: "Type something…",
    }),
  ];
}
