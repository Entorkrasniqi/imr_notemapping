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
import { appendImageBlock, isEmptyContent, MAX_IMAGE_BYTES } from "@/lib/editor/content";
import { useRecordBeforeChange } from "@/hooks/useBoardHistory";

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
  const recordBeforeChange = useRecordBeforeChange();
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDelete = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      deleteElements({ nodes: [{ id }] });
    },
    [id, deleteElements],
  );

  // Drag a JPEG in from the OS (Finder, Desktop, …) and drop it on a
  // *closed* note tile to embed it, appended straight to the stored
  // content so it's there the next time the note is opened. This can
  // only ever fire on a closed tile now: opening a note for editing puts
  // a full-viewport modal (see NoteEditorModal) above the whole canvas,
  // so there's no way to reach any tile at all — this one included —
  // while it (or any other note) is actively open. Dropping an image
  // onto a note that's already open happens inside that modal instead.
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
        updateNodeData(id, { content: appendImageBlock(data.content, src) });
      };
      reader.readAsDataURL(file);
    },
    [id, data.content, updateNodeData],
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

      {/* Draggable resize handles, shown while the note is selected —
          this now controls only the *canvas tile's* footprint (how much
          visual weight this note has among others), not "how much of its
          body is visible": opening a note for real reading/editing now
          always means the big modal (see NoteEditorModal), regardless of
          how big or small its tile is. `onResizeStart` records the
          pre-resize size so it's undoable as one step, not a snapshot
          per pixel dragged.

          Rendered *after* the connection handles above on purpose, not
          just after in reading order: this note's four corners are
          shared, contested space — a connection handle and a resize
          handle both want to live exactly there. Whichever one is later
          in the DOM wins hit-testing for any pixel they overlap, so
          putting NodeResizer last is what makes a corner drag mean
          "resize," not "start an arrow," which is the more common thing
          to want at a corner specifically.

          Both `lineClassName` and `handleClassName` are fully
          transparent — no visible line, no visible squares. The resize
          affordance is invisible for the same reason the connection
          handles are: this note has no visible box to begin with (see
          the comment on the un-decorated content wrapper below), and a
          visible square at each corner read as a separate, boxy UI
          element sitting on top of that otherwise-plain design. The hit
          area is still real, and — since nothing here needs to look
          like anything — allowed to be considerably bigger than the
          10px default, so finding it doesn't take precise aim. */}
      <NodeResizer
        isVisible={selected}
        minWidth={220}
        minHeight={56}
        lineClassName="!border-transparent"
        handleClassName="!h-5 !w-5 !rounded-none !border-none !bg-transparent"
        onResizeStart={recordBeforeChange}
      />

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

        {/* A single click opens this note in the editor modal (see
            Board.tsx's `handleNodeClick` and `NoteEditorModal`) — a real
            drag gesture never reaches that handler, since React Flow
            only fires a node's click callback when the pointer didn't
            move past its own drag threshold, so dragging the note is
            unaffected. This tile always shows the same read-only
            preview now; there's no separate "open, in place" look to
            switch to any more. */}
        <div className="min-h-0 flex-1 overflow-hidden p-3">
          <NotePreview content={data.content} />
        </div>
      </div>
    </div>
  );
}

export default memo(NoteNode);
