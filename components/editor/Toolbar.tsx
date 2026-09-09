"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEditorState, type Editor } from "@tiptap/react";

type Alignment = "left" | "center" | "right" | "justify";

type ToolbarState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  heading1: boolean;
  heading2: boolean;
  heading3: boolean;
  bulletList: boolean;
  orderedList: boolean;
  align: Alignment;
  fontFamily: string;
  fontSize: string;
  color: string | null;
  highlightColor: string | null;
  canUndo: boolean;
  canRedo: boolean;
};

// Shown while no note is selected, i.e. there's nothing for the dock to
// act on yet — every button below reads from this and renders inactive.
const IDLE_STATE: ToolbarState = {
  bold: false,
  italic: false,
  underline: false,
  heading1: false,
  heading2: false,
  heading3: false,
  bulletList: false,
  orderedList: false,
  align: "left",
  fontFamily: "",
  fontSize: "",
  color: null,
  highlightColor: null,
  canUndo: false,
  canRedo: false,
};

const MIN_FONT_SIZE = 1;
const MAX_FONT_SIZE = 50;

// Plain web-safe font stacks — no font files to load, no extra library,
// just picking from typefaces every OS already ships. Each entry's value
// is the actual CSS `font-family` string Tiptap's FontFamily extension
// writes onto the text; `Default` clears it back to the note's own font.
const FONT_FAMILIES: Array<{ label: string; value: string }> = [
  { label: "Default", value: "" },
  { label: "Sans-serif", value: "Arial, Helvetica, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', Times, serif" },
  { label: "Monospace", value: "'Courier New', Courier, monospace" },
  { label: "Comic", value: "'Comic Sans MS', 'Comic Sans', cursive" },
];

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

const ALIGNMENTS: Array<{ label: string; value: Alignment; title: string }> = [
  { label: "⟵", value: "left", title: "Align left" },
  { label: "↔", value: "center", title: "Align center" },
  { label: "⟶", value: "right", title: "Align right" },
  { label: "☰", value: "justify", title: "Justify" },
];

function Divider() {
  return <span className="mx-1 h-4 w-px shrink-0 bg-zinc-200 dark:bg-white/15 blueprint:bg-white/25" />;
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
      // `title` alone isn't reliably announced by screen readers — an
      // explicit `aria-label` is what actually gives a button like "B" or
      // "H1" a real accessible name instead of just its (ambiguous, to a
      // screen reader) visible letter. `aria-pressed` is only included
      // for genuine toggle buttons (`active` was actually passed in, not
      // left `undefined` — Undo/Redo/etc. aren't toggles and shouldn't
      // claim to be one).
      aria-label={title}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      // Buttons live outside the contentEditable area. Without this, the
      // mousedown would first collapse/move the editor's text selection
      // before the click handler ever runs the formatting command.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`min-w-[1.75rem] shrink-0 rounded px-1.5 py-1 text-xs font-medium leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        active
          ? "bg-zinc-200 text-zinc-900 dark:bg-white/20 dark:text-white blueprint:bg-white/25 blueprint:text-white"
          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white blueprint:text-white/60 blueprint:hover:bg-white/10 blueprint:hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * A single compact trigger button that opens a small floating palette
 * above it — this is what replaced nine always-visible color dots with
 * two buttons: the palette only takes up space while it's actually open,
 * instead of permanently occupying toolbar width whether or not anyone's
 * about to use it.
 */
function ColorMenu({
  label,
  swatchColor,
  letter,
  isOpen,
  onToggle,
  onClose,
  children,
}: {
  label: string;
  /** The color shown in the little bar under the letter — the button's
   * own way of saying "here's the color currently applied," without
   * needing every possible color visible at once to show it. */
  swatchColor: string | null;
  letter: string;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  // Computed fresh each time the menu opens, from the trigger's actual
  // on-screen position — this menu is portaled to `document.body` (see
  // the render below), specifically to sidestep a real CSS surprise: the
  // toolbar this trigger lives in has `overflow-x-auto` (needed so it
  // scrolls sideways on narrow screens instead of clipping controls —
  // see NoteEditorModal), and per the CSS overflow spec, giving *either*
  // axis a non-`visible` value forces the *other* axis to compute as
  // `auto` too, not `visible` — there's no way to keep just one axis
  // scrollable and the other truly unclipped. A popover positioned
  // `absolute` inside that toolbar was therefore silently clipped by the
  // *vertical* overflow nobody asked for, which is exactly what made the
  // color swatches unclickable the first time this was built this way.
  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({ top: rect.top, left: rect.left });
  }, [isOpen]);

  // Closes on any click outside the trigger *or* the portaled menu —
  // checked separately since, with the menu now in a different part of
  // the DOM, a single shared ancestor to test against no longer exists.
  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen, onClose]);

  // Escape closes just this popover, not the whole note editor modal —
  // captured ahead of Board.tsx's own window-level Escape handler (which
  // runs on the bubble phase) by listening on the capture phase instead,
  // so `stopPropagation` here reaches it before that handler ever runs.
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    }
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [isOpen, onClose]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        title={label}
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={isOpen}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onToggle}
        className="flex shrink-0 flex-col items-center gap-0.5 rounded px-1.5 py-1 leading-none text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white blueprint:text-white/60 blueprint:hover:bg-white/10 blueprint:hover:text-white"
      >
        <span className="text-xs font-bold">{letter}</span>
        <span
          className="h-[3px] w-3.5 rounded-full"
          style={{ backgroundColor: swatchColor ?? "currentColor" }}
        />
      </button>
      {isOpen &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: position.top, left: position.left, transform: "translateY(-100%)" }}
            className="z-50 mb-2 flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-white/10 dark:bg-zinc-800 blueprint:border-white/20 blueprint:bg-[#0f3057]"
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * The formatting controls for whichever note is currently being edited.
 *
 * This renders inside `NoteEditorModal`'s own footer, not inside the note
 * tile on the canvas — there's no live editor there any more to control.
 * `editor` is whatever `ActiveEditorContext` currently holds, which is
 * only ever non-null while that modal is open (RichTextEditor registers
 * itself there on mount); every control here is written to degrade to an
 * inert, greyed-out state via `IDLE_STATE` rather than assume an editor
 * exists, though in practice this component only ever renders while one
 * does now.
 */
export default function Toolbar({ editor }: { editor: Editor | null }) {
  // `useEditorState` subscribes to exactly the derived values this toolbar
  // needs (active marks, current alignment, etc.) and only re-renders when
  // one of them actually changes. Tiptap v3 stopped re-rendering on every
  // transaction by default — reading `editor.isActive(...)` directly in the
  // component body would silently go stale as the cursor moves.
  const state =
    useEditorState({
      editor,
      selector: ({ editor }): ToolbarState => {
        if (!editor) return IDLE_STATE;
        return {
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
          fontFamily: (editor.getAttributes("textStyle").fontFamily as string) ?? "",
          fontSize: (editor.getAttributes("textStyle").fontSize as string) ?? "",
          color: (editor.getAttributes("textStyle").color as string) ?? null,
          highlightColor: (editor.getAttributes("highlight").color as string) ?? null,
          canUndo: editor.can().undo(),
          canRedo: editor.can().redo(),
        };
      },
    }) ?? IDLE_STATE;

  const disabled = !editor;
  // Only one color palette open at a time — opening one and clicking the
  // other's trigger switches directly to it rather than needing a second
  // click to close the first.
  const [openMenu, setOpenMenu] = useState<"color" | "highlight" | null>(null);

  return (
    <div className="nodrag nowheel flex items-center gap-0.5 whitespace-nowrap">
      <Button
        title="Bold"
        disabled={disabled}
        active={state.bold}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      >
        B
      </Button>
      <Button
        title="Italic"
        disabled={disabled}
        active={state.italic}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      >
        I
      </Button>
      <Button
        title="Underline"
        disabled={disabled}
        active={state.underline}
        onClick={() => editor?.chain().focus().toggleUnderline().run()}
      >
        U
      </Button>

      <Divider />

      <Button
        title="Heading 1"
        disabled={disabled}
        active={state.heading1}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        H1
      </Button>
      <Button
        title="Heading 2"
        disabled={disabled}
        active={state.heading2}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </Button>
      <Button
        title="Heading 3"
        disabled={disabled}
        active={state.heading3}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </Button>

      <Divider />

      <select
        title="Font"
        aria-label="Font"
        disabled={disabled}
        value={state.fontFamily}
        onMouseDown={(event) => event.stopPropagation()}
        onChange={(event) => {
          const value = event.target.value;
          if (value) {
            editor?.chain().focus().setFontFamily(value).run();
          } else {
            editor?.chain().focus().unsetFontFamily().run();
          }
        }}
        className="nodrag shrink-0 rounded border border-transparent bg-transparent px-1 py-1 text-xs text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30 dark:text-white/60 dark:hover:bg-white/10 blueprint:text-white/70 blueprint:hover:bg-white/10"
      >
        {FONT_FAMILIES.map((font) => (
          <option key={font.label} value={font.value} style={{ fontFamily: font.value || undefined }}>
            {font.label}
          </option>
        ))}
      </select>

      <Divider />

      <div
        className="flex shrink-0 items-center gap-1"
        title={`Text size (${MIN_FONT_SIZE}–${MAX_FONT_SIZE}px)`}
      >
        <input
          type="number"
          inputMode="numeric"
          aria-label={`Text size, ${MIN_FONT_SIZE} to ${MAX_FONT_SIZE} pixels`}
          min={MIN_FONT_SIZE}
          max={MAX_FONT_SIZE}
          disabled={disabled}
          value={state.fontSize ? String(parseInt(state.fontSize, 10)) : ""}
          placeholder="16"
          onMouseDown={(event) => event.stopPropagation()}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === "") {
              editor?.chain().focus().unsetFontSize().run();
              return;
            }
            const parsed = Number(raw);
            if (Number.isNaN(parsed)) return;
            const clamped = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, parsed));
            editor?.chain().focus().setFontSize(`${clamped}px`).run();
          }}
          className="nodrag w-9 shrink-0 rounded border border-transparent bg-transparent px-1 py-1 text-center text-xs text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none dark:text-white/60 dark:hover:bg-white/10 blueprint:text-white/70 blueprint:hover:bg-white/10"
        />
        <span className="text-[10px] text-zinc-400 dark:text-white/30 blueprint:text-white/40">px</span>
      </div>

      <Divider />

      <Button
        title="Bullet list"
        disabled={disabled}
        active={state.bulletList}
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      >
        •≡
      </Button>
      <Button
        title="Numbered list"
        disabled={disabled}
        active={state.orderedList}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      >
        1.
      </Button>

      <Divider />

      {ALIGNMENTS.map((alignment) => (
        <Button
          key={alignment.value}
          title={alignment.title}
          disabled={disabled}
          active={state.align === alignment.value}
          onClick={() => editor?.chain().focus().setTextAlign(alignment.value).run()}
        >
          {alignment.label}
        </Button>
      ))}

      <Divider />

      {/* Nine always-visible color dots collapsed into two compact
          triggers, each opening its own small palette on demand — the
          toolbar now spends space on a color only while someone's
          actually choosing one, not all the time whether or not anyone
          is. */}
      <ColorMenu
        label="Text color"
        letter="A"
        swatchColor={state.color}
        isOpen={openMenu === "color"}
        onToggle={() => setOpenMenu((current) => (current === "color" ? null : "color"))}
        onClose={() => setOpenMenu(null)}
      >
        {TEXT_COLORS.map((color) => (
          <button
            key={color.label}
            type="button"
            title={color.label}
            aria-label={`Text color: ${color.label}`}
            aria-pressed={state.color === color.value}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (color.value) {
                editor?.chain().focus().setColor(color.value).run();
              } else {
                editor?.chain().focus().unsetColor().run();
              }
              setOpenMenu(null);
            }}
            className={`h-4 w-4 shrink-0 rounded-full border transition-transform disabled:cursor-not-allowed disabled:opacity-30 ${
              state.color === color.value
                ? "scale-110 border-zinc-500 dark:border-white blueprint:border-white"
                : "border-zinc-200 hover:scale-110 dark:border-white/30 blueprint:border-white/40"
            }`}
            style={{ backgroundColor: color.value ?? "#ffffff" }}
          />
        ))}
      </ColorMenu>

      <ColorMenu
        label="Highlight"
        letter="H"
        swatchColor={state.highlightColor}
        isOpen={openMenu === "highlight"}
        onToggle={() => setOpenMenu((current) => (current === "highlight" ? null : "highlight"))}
        onClose={() => setOpenMenu(null)}
      >
        {HIGHLIGHT_COLORS.map((color) => (
          <button
            key={color.label}
            type="button"
            title={color.label}
            aria-label={`Highlight: ${color.label}`}
            aria-pressed={state.highlightColor === color.value}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              editor?.chain().focus().toggleHighlight({ color: color.value }).run();
              setOpenMenu(null);
            }}
            className="h-4 w-4 shrink-0 rounded-full border border-zinc-200 transition-transform disabled:cursor-not-allowed disabled:opacity-30 hover:scale-110 dark:border-white/30 blueprint:border-white/40"
            style={{ backgroundColor: color.value }}
          />
        ))}
        <Button
          title="Clear highlight"
          disabled={disabled}
          onClick={() => {
            editor?.chain().focus().unsetHighlight().run();
            setOpenMenu(null);
          }}
        >
          ✕
        </Button>
      </ColorMenu>

      <Divider />

      <Button
        title="Undo"
        disabled={disabled || !state.canUndo}
        onClick={() => editor?.chain().focus().undo().run()}
      >
        ↶
      </Button>
      <Button
        title="Redo"
        disabled={disabled || !state.canRedo}
        onClick={() => editor?.chain().focus().redo().run()}
      >
        ↷
      </Button>
    </div>
  );
}
