"use client";

import { useEditorState, type Editor } from "@tiptap/react";

type Alignment = "left" | "center" | "right" | "justify";

const TEXT_COLORS: Array<{ label: string; value: string | null }> = [
  { label: "Default", value: null },
  { label: "Red", value: "#dc2626" },
  { label: "Blue", value: "#2563eb" },
  { label: "Green", value: "#16a34a" },
  { label: "Purple", value: "#9333ea" },
];

const HIGHLIGHT_COLORS: Array<{ label: string; value: string }> = [
  { label: "Yellow", value: "#fef08a" },
  { label: "Green", value: "#bbf7d0" },
  { label: "Blue", value: "#bfdbfe" },
  { label: "Pink", value: "#fbcfe8" },
];

const FONT_SIZES: Array<{ label: string; value: string }> = [
  { label: "Default", value: "" },
  { label: "Small", value: "13px" },
  { label: "Normal", value: "16px" },
  { label: "Large", value: "20px" },
  { label: "X-Large", value: "28px" },
];

const ALIGNMENTS: Array<{ label: string; value: Alignment; title: string }> = [
  { label: "⟵", value: "left", title: "Align left" },
  { label: "↔", value: "center", title: "Align center" },
  { label: "⟶", value: "right", title: "Align right" },
  { label: "☰", value: "justify", title: "Justify" },
];

function Divider() {
  return <span className="mx-1 h-4 w-px shrink-0 bg-zinc-200" />;
}

function Button({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      // Buttons live outside the contentEditable area. Without this, the
      // mousedown would first collapse/move the editor's text selection
      // before the click handler ever runs the formatting command.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`min-w-[1.75rem] rounded px-1.5 py-1 text-xs font-medium leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        active
          ? "bg-zinc-200 text-zinc-900"
          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * The formatting toolbar for a note's editor. Rendered only while the note
 * is selected (see `NoteNode`), matching the brief's requirement that it
 * "appear when a note is selected or when the user is editing a note."
 */
export default function Toolbar({ editor }: { editor: Editor }) {
  // `useEditorState` subscribes to exactly the derived values this toolbar
  // needs (active marks, current alignment, etc.) and only re-renders when
  // one of them actually changes. Tiptap v3 stopped re-rendering on every
  // transaction by default — reading `editor.isActive(...)` directly in the
  // component body would silently go stale as the cursor moves.
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      underline: editor.isActive("underline"),
      heading1: editor.isActive("heading", { level: 1 }),
      heading2: editor.isActive("heading", { level: 2 }),
      heading3: editor.isActive("heading", { level: 3 }),
      bulletList: editor.isActive("bulletList"),
      orderedList: editor.isActive("orderedList"),
      align:
        ALIGNMENTS.find((a) => editor.isActive({ textAlign: a.value }))
          ?.value ?? "left",
      fontSize: (editor.getAttributes("textStyle").fontSize as string) ?? "",
      color: (editor.getAttributes("textStyle").color as string) ?? null,
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });

  return (
    <div className="nodrag nowheel flex flex-wrap items-center gap-0.5 border-b border-zinc-100 bg-zinc-50/80 px-1.5 py-1">
      <Button
        title="Bold"
        active={state.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        B
      </Button>
      <Button
        title="Italic"
        active={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        I
      </Button>
      <Button
        title="Underline"
        active={state.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        U
      </Button>

      <Divider />

      <Button
        title="Heading 1"
        active={state.heading1}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 1 }).run()
        }
      >
        H1
      </Button>
      <Button
        title="Heading 2"
        active={state.heading2}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
      >
        H2
      </Button>
      <Button
        title="Heading 3"
        active={state.heading3}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
      >
        H3
      </Button>

      <Divider />

      <select
        title="Text size"
        value={state.fontSize}
        onMouseDown={(event) => event.stopPropagation()}
        onChange={(event) => {
          const value = event.target.value;
          if (value) {
            editor.chain().focus().setFontSize(value).run();
          } else {
            editor.chain().focus().unsetFontSize().run();
          }
        }}
        className="nodrag rounded border border-transparent bg-transparent px-1 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
      >
        {FONT_SIZES.map((size) => (
          <option key={size.label} value={size.value}>
            {size.label}
          </option>
        ))}
      </select>

      <Divider />

      <Button
        title="Bullet list"
        active={state.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        •≡
      </Button>
      <Button
        title="Numbered list"
        active={state.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1.
      </Button>

      <Divider />

      {ALIGNMENTS.map((alignment) => (
        <Button
          key={alignment.value}
          title={alignment.title}
          active={state.align === alignment.value}
          onClick={() =>
            editor.chain().focus().setTextAlign(alignment.value).run()
          }
        >
          {alignment.label}
        </Button>
      ))}

      <Divider />

      <div className="flex items-center gap-0.5" title="Text color">
        {TEXT_COLORS.map((color) => (
          <button
            key={color.label}
            type="button"
            title={color.label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() =>
              color.value
                ? editor.chain().focus().setColor(color.value).run()
                : editor.chain().focus().unsetColor().run()
            }
            className={`h-4 w-4 shrink-0 rounded-full border transition-transform ${
              state.color === color.value
                ? "scale-110 border-zinc-500"
                : "border-zinc-200 hover:scale-110"
            }`}
            style={{ backgroundColor: color.value ?? "#ffffff" }}
          />
        ))}
      </div>

      <Divider />

      <div className="flex items-center gap-0.5" title="Highlight">
        {HIGHLIGHT_COLORS.map((color) => (
          <button
            key={color.label}
            type="button"
            title={color.label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() =>
              editor.chain().focus().toggleHighlight({ color: color.value }).run()
            }
            className="h-4 w-4 shrink-0 rounded-full border border-zinc-200 transition-transform hover:scale-110"
            style={{ backgroundColor: color.value }}
          />
        ))}
        <Button title="Clear highlight" onClick={() => editor.chain().focus().unsetHighlight().run()}>
          ✕
        </Button>
      </div>

      <Divider />

      <Button
        title="Undo"
        disabled={!state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        ↶
      </Button>
      <Button
        title="Redo"
        disabled={!state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        ↷
      </Button>
    </div>
  );
}
