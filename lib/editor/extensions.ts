import StarterKit from "@tiptap/starter-kit";
import { Color, FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
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
    FontFamily,
    TextAlign.configure({
      types: ["heading", "paragraph"],
    }),
    Highlight.configure({ multicolor: true }),
    Placeholder.configure({
      placeholder: "Type something…",
    }),
    // `allowBase64` matters: a dropped image is stored as a data URL right
    // in the note's own JSON (there's no file upload/storage backend yet —
    // that's Phase 5), and Tiptap strips base64 `src` values by default as
    // an XSS precaution. We're generating that data URL ourselves from a
    // local file the user just dropped, not accepting arbitrary remote
    // HTML, so that risk doesn't apply here.
    Image.configure({ allowBase64: true }),
  ];
}
