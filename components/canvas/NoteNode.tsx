"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { generateHTML, type JSONContent } from "@tiptap/react";
import {
  Handle,
  NodeResizer,
  Position,
  useReactFlow,
  type NodeProps,
} from "@xyflow/react";
import type { NoteNode as NoteNodeType } from "@/types/canvas";
import { getNoteExtensions } from "@/lib/editor/extensions";
import { appendImageBlock, isEmptyContent } from "@/lib/editor/content";
import { useActiveEditor } from "@/lib/editor/active-editor-context";
import { useRecordBeforeChange } from "@/hooks/useBoardHistory";
import RichTextEditor from "@/components/editor/RichTextEditor";

// A dropped image is embedded directly in the note's own JSON as a base64
// data URL — there's no file upload/storage backend yet (that's Phase 5).
// This caps how large a single embed can get, since base64 inflates a
// file's size by roughly a third and everything lives in memory/React
// state until then.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

// Forty fixed connection points around each note: all four corners, plus
// nine evenly spaced points along each of the four edges. When you release
// a drag near a note, React Flow snaps to whichever registered handle is
// geometrically closest to the cursor (see `getClosestHandle` in
// @xyflow/system) — more points spread around the whole perimeter is what
// makes "closest handle" track where a user actually grabbed or released,
// rather than snapping to one of a handful of coarse spots.
//
// The nine-per-edge count and their 16px hit box were bumped up from an
// earlier four-per-edge/10px version, which left grabbable points far
// enough apart that starting a connection needed real pixel precision —
// since the box itself is invisible either way (the note's one visible
// connection cue is the shared outline further down, not these), there's
// no visual cost to a bigger, denser grab area along the edges.
//
// The four corner handles deliberately did *not* get the same size bump,
// for a reason discovered by testing it: corners are exactly where
// NodeResizer's own resize-handle squares live too, and a corner
// connection handle sized to match the edges' 16px would sit on top of
// and swallow clicks meant for that 10px resize handle underneath it
// (confirmed — enlarging both broke resizing entirely). Keeping corners
// at their original, smaller size is what keeps the two interactions
// from competing for the same pixels; nothing else claims the mid-edge
// pixels, so those are free to be as generous as helps.
const HANDLE_GAP = 6; // px — distance from the border to a handle's center
const CORNER_HANDLE_SIZE = 10;
const EDGE_HANDLE_SIZE = 16;

function outward(size: number): string {
  return `-${HANDLE_GAP + size / 2}px`;
}
function inward(size: number): string {
  return `calc(100% + ${HANDLE_GAP - size / 2}px)`;
}
/** A CSS position (as a percentage of the note's own size) for a handle
 * centered exactly on the given fraction `t` (0–1) along an edge. */
function edgeFraction(t: number, size: number): string {
  return `calc(${t * 100}% - ${size / 2}px)`;
}

type HandleSpec = {
  id: string;
  position: Position;
  top: string;
  left: string;
  size: number;
};

const CORNERS: HandleSpec[] = [
  { id: "top-left", position: Position.Top, top: outward(CORNER_HANDLE_SIZE), left: outward(CORNER_HANDLE_SIZE), size: CORNER_HANDLE_SIZE },
  { id: "top-right", position: Position.Top, top: outward(CORNER_HANDLE_SIZE), left: inward(CORNER_HANDLE_SIZE), size: CORNER_HANDLE_SIZE },
  { id: "bottom-left", position: Position.Bottom, top: inward(CORNER_HANDLE_SIZE), left: outward(CORNER_HANDLE_SIZE), size: CORNER_HANDLE_SIZE },
  { id: "bottom-right", position: Position.Bottom, top: inward(CORNER_HANDLE_SIZE), left: inward(CORNER_HANDLE_SIZE), size: CORNER_HANDLE_SIZE },
];

// Nine interior points per edge (every 10%, corners excluded since those
// are already covered above) — 4 + 4 × 9 = 40 total. At the default
// 240px note width that's a handle roughly every 24px, each with a 16px
// hit box — an 8px gap at worst, down from the old ~38px one.
const EDGE_FRACTIONS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];

const EDGES: HandleSpec[] = EDGE_FRACTIONS.flatMap((t) => [
  { id: `top-${t}`, position: Position.Top, top: outward(EDGE_HANDLE_SIZE), left: edgeFraction(t, EDGE_HANDLE_SIZE), size: EDGE_HANDLE_SIZE },
  { id: `bottom-${t}`, position: Position.Bottom, top: inward(EDGE_HANDLE_SIZE), left: edgeFraction(t, EDGE_HANDLE_SIZE), size: EDGE_HANDLE_SIZE },
  { id: `left-${t}`, position: Position.Left, top: edgeFraction(t, EDGE_HANDLE_SIZE), left: outward(EDGE_HANDLE_SIZE), size: EDGE_HANDLE_SIZE },
  { id: `right-${t}`, position: Position.Right, top: edgeFraction(t, EDGE_HANDLE_SIZE), left: inward(EDGE_HANDLE_SIZE), size: EDGE_HANDLE_SIZE },
]);

// All twenty are `type="source"` on purpose: combined with
// `connectionMode="loose"` on the board (see Board.tsx), this lets a user
// start a connection from *or* drop it onto any of them, in either
// direction, without having to think about React Flow's source/target
// distinction — a mind map doesn't have a "from" and "to" side of a note.
const HANDLE_POSITIONS: HandleSpec[] = [...CORNERS, ...EDGES];

/**
 * Read-only preview shown whenever a note isn't in text-edit mode —
 * selected or not. Rendering static HTML here (via Tiptap's
 * `generateHTML`, not a mounted editor) is what keeps a board with many
 * notes fast, and — just as importantly — is what keeps a merely-selected
 * note fully draggable from anywhere on it: this content carries no
 * `nodrag` at all, unlike the live editor. See `lib/editor/extensions.ts`
 * for why this and the live editor must share one extension list.
 *
 * It also deliberately shows *only the first block* — the note's title
 * line (the one already styled bold/larger, see globals.css) — not the
 * rest of the body. A canvas full of notes each showing their full text
 * reads as noise; showing just the title on the canvas and the full body
 * only once a note is opened for editing is what keeps it a mind map
 * instead of a wall of paragraphs. Clicking to edit still reveals
 * everything, unabridged — this component is never the thing rendering
 * while a note is being edited.
 */
function NotePreview({ content }: { content: JSONContent | null }) {
  const extensions = useMemo(() => getNoteExtensions(), []);

  const titleDoc = useMemo((): JSONContent => {
    const titleBlock = content?.content?.[0];
    return { type: "doc", content: [titleBlock ?? { type: "paragraph" }] };
  }, [content]);

  const hasMoreContent = (content?.content?.length ?? 0) > 1;

  const html = useMemo(
    () => generateHTML(titleDoc, extensions),
    [titleDoc, extensions],
  );

  // Centered — both axes — while closed, unlike the live editor (which
  // stays left-aligned, top-down, like any normal text editor). A closed
  // note reads more like a label/title card at a glance; the moment it's
  // opened for actual editing, text needs to behave like text again, so
  // RichTextEditor below is deliberately left untouched.
  if (isEmptyContent(titleDoc)) {
    return (
      <p
        className="flex h-full items-center justify-center p-2 text-center text-sm text-zinc-400 dark:text-white/30 blueprint:text-white/40"
        title="Click to open"
      >
        Type something…
      </p>
    );
  }

  return (
    <div
      className="tiptap prose-note relative flex h-full items-center justify-center overflow-hidden p-2 text-center text-sm text-zinc-800 dark:text-white/85 blueprint:text-white"
      title="Click to open"
    >
      {/* The "···" hint below is deliberately taken out of normal flex
          flow (absolutely positioned) rather than stacked as a second
          child next to the title — an earlier version had both as
          siblings in a column flex, and when their combined height
          exceeded this box (routine once a note has both a title and a
          hint, in the fixed-height collapsed state), centering an
          overflowing block crops it symmetrically from *both* ends,
          which sliced straight through the top of the title text. With
          only the title as a normal-flow child, `items-center` centers
          it against the *whole* box height, and the hint just floats
          near the bottom on top of it, never competing for the same
          vertical space. */}
      <div
        className="note-title-line w-full"
        // Safe here: `html` is generated from our own JSON schema (via
        // Tiptap's `generateHTML`), never from raw user-supplied HTML.
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {hasMoreContent && (
        // A small hint that there's more inside, without revealing any of
        // it — just enough to tell someone clicking to open it isn't
        // opening an empty note.
        <p
          className="pointer-events-none absolute inset-x-0 bottom-0 text-zinc-300 dark:text-white/20 blueprint:text-white/30"
          aria-hidden="true"
        >
          ···
        </p>
      )}
    </div>
  );
}

/**
 * The visual representation of a single note on the board.
 *
 * This is a "custom node" in React Flow terms: a plain React component
 * registered under a type name (`note`) and rendered by React Flow for
 * every node whose `type` matches. React Flow handles positioning,
 * dragging, and selection around it — this component only renders the
 * note's own content and reacts to its own data.
 */
function NoteNode({ id, data, selected }: NodeProps<NoteNodeType>) {
  const { updateNodeData, deleteElements } = useReactFlow();
  // `selected` and `isEditing` are still two separate pieces of state —
  // React Flow's own node selection vs. this app's `editingNoteId` — even
  // though a single click now sets both at once (see Board.tsx's
  // `handleNodeClick`). A note that's already open for editing has
  // `nodrag` on its live editor content (RichTextEditor), so a *second*,
  // separate click-and-drag gesture aimed at its text won't move it —
  // same as clicking into a text field in most note apps. Dragging a
  // still-closed note works normally (mousedown-and-move on the preview
  // is never `nodrag`), and an already-open note can still be dragged by
  // its padding — see the comment on that wrapper below.
  const { editingNoteId, activeEditor } = useActiveEditor();
  const isEditing = editingNoteId === id;
  const recordBeforeChange = useRecordBeforeChange();
  const [isDragOver, setIsDragOver] = useState(false);

  const handleChange = useCallback(
    (content: JSONContent) => {
      updateNodeData(id, { content });
    },
    [id, updateNodeData],
  );

  const handleDelete = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      deleteElements({ nodes: [{ id }] });
    },
    [id, deleteElements],
  );

  // Drag a JPEG in from the OS (Finder, Desktop, …) and drop it on a note
  // to embed it — works whether the note is open for editing or not. If
  // it's the note currently being edited, the image goes in through its
  // own live editor instance (`activeEditor`) so it appears immediately;
  // otherwise it's appended straight to the stored content, ready to show
  // the next time the note is opened.
  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    // Required to allow a drop at all — browsers reject drops on any
    // element that doesn't call this during dragover.
    event.preventDefault();
  }, []);

  const handleDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    // `dragleave` also fires when the cursor moves onto a child element
    // inside the note, not just when it truly leaves — only clear the
    // highlight once we've actually left the note's own bounding box.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
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
        if (isEditing && activeEditor) {
          activeEditor.chain().focus().setImage({ src }).run();
        } else {
          updateNodeData(id, { content: appendImageBlock(data.content, src) });
        }
      };
      reader.readAsDataURL(file);
    },
    [id, isEditing, activeEditor, data.content, updateNodeData],
  );

  return (
    // `group` + `relative` let the connection handles fade in on hover via
    // `group-hover`. There's no card underneath to clip against any more —
    // see the comment below on why the content wrapper carries no
    // background, border, or shadow of its own. The drag handlers here
    // (not further down) catch a dropped file regardless of whether the
    // note is currently showing its live editor or its read-only preview.
    <div
      className="group relative h-full w-full"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Draggable resize handles, shown only while a note is open for
          editing — resizing a *closed* note (showing just its title)
          wouldn't reveal anything, since the body it'd make room for is
          hidden either way. Its thin blue outline (`lineClassName`) is
          also what visually distinguishes "open and editable" from merely
          "selected," which only lights up the connection dots below.
          `onResizeStart` records the pre-resize size so it's undoable as
          one step, not a snapshot per pixel dragged. */}
      <NodeResizer
        isVisible={isEditing}
        minWidth={220}
        minHeight={140}
        lineClassName="!border-blue-400 blueprint:!border-white"
        handleClassName="!h-2.5 !w-2.5 !rounded-[3px] !border !border-blue-400 !bg-white blueprint:!border-white blueprint:!bg-[#0f3057]"
        onResizeStart={recordBeforeChange}
      />

      {HANDLE_POSITIONS.map((handle) => (
        <Handle
          key={handle.id}
          id={handle.id}
          type="source"
          position={handle.position}
          // An inline `top`/`left`/`transform` here wins over React Flow's
          // own per-side positioning without needing `!important` — a
          // plain (non-important) inline style always beats a plain
          // stylesheet rule, regardless of which stylesheet loaded last.
          // `width`/`height` are inline too, not Tailwind classes, since
          // corner and edge handles now deliberately differ in size (see
          // CORNER_HANDLE_SIZE/EDGE_HANDLE_SIZE above) — a fixed `!h-*
          // !w-*` class pair couldn't express that per-handle difference.
          style={{
            top: handle.top,
            left: handle.left,
            transform: "none",
            width: handle.size,
            height: handle.size,
          }}
          // Invisible on purpose — these 40 points are still exactly what
          // React Flow drags to/snaps against (see the comment above),
          // but the outline below is what a user actually sees, as one
          // continuous connectable frame rather than 40 separate marks.
          className="!rounded-none !border-none !bg-transparent"
        />
      ))}

      {/* The visual stand-in for all forty handles above: one unbroken
          rounded-rectangle line around the note, so every edge — top and
          bottom included, not just the sides — reads as equally
          "connect from here," with rounded corners carrying the line
          smoothly from one edge into the next instead of meeting at a
          sharp joint. `-inset-1.5` (6px) matches HANDLE_GAP exactly, so
          this sits right on top of the ring the invisible handles above
          already occupy. */}
      <div
        className={`pointer-events-none absolute -inset-1.5 rounded-xl border-2 border-zinc-400 transition-opacity dark:border-white/50 blueprint:border-white/70 ${
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      />

      {/* No background, border, or shadow here on purpose: a note is just
          its text, floating directly on the canvas — the deliberately
          minimal look, matching a plain mind-map/outline aesthetic rather
          than a card-based UI. Nothing about the interaction model needed
          a visible box to begin with; the selection/resize/connection
          affordances above already stand on their own. The dashed outline
          is the one exception — a purely transient drop-target cue while
          a file is actively being dragged over this note, gone the moment
          it isn't. */}
      <div
        className={`relative flex h-full w-full flex-col overflow-hidden outline-2 outline-offset-4 outline-dashed transition-[outline-color] ${
          isDragOver ? "outline-blue-400 blueprint:outline-white" : "outline-transparent"
        }`}
      >
        {selected && (
          // Absolutely positioned so it floats over the content instead of
          // sitting in a header row above it — a row that only exists while
          // selected would push the text down on select and snap it back
          // up on deselect, which is the "extra space" this avoids.
          <button
            type="button"
            onClick={handleDelete}
            className="nodrag absolute right-1.5 top-1.5 z-10 rounded p-1 text-xs leading-none text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white/80 blueprint:text-white/50 blueprint:hover:bg-white/10 blueprint:hover:text-white"
            aria-label="Delete note"
            title="Delete note"
          >
            ✕
          </button>
        )}

        {/* A single click opens this for editing (see Board.tsx's
            `handleNodeClick`) — a real drag gesture never reaches that
            handler, since React Flow only fires a node's click callback
            when the pointer didn't move past its own drag threshold, so
            dragging the note is unaffected. Its formatting toolbar lives
            outside the canvas, in `FormattingDock`, which finds this
            editor via `ActiveEditorContext` rather than through props.

            The `p-3` here still matters while editing, even with no
            visible border to speak of: RichTextEditor marks its own
            content `nodrag` (so clicking to place a text cursor, or
            dragging across text to select it, doesn't drag the note
            instead). This padding belongs to *this* wrapper, not the
            editor, so it's never nodrag — an invisible but real margin you
            can still drag the note by even mid-edit. */}
        <div className="min-h-0 flex-1 overflow-hidden p-3">
          {isEditing ? (
            <RichTextEditor content={data.content} onChange={handleChange} />
          ) : (
            <NotePreview content={data.content} />
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(NoteNode);
