"use client";

import { memo, useCallback, useMemo } from "react";
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
import { EMPTY_DOC, isEmptyContent } from "@/lib/editor/content";
import { useActiveEditor } from "@/lib/editor/active-editor-context";
import RichTextEditor from "@/components/editor/RichTextEditor";

// Twenty fixed connection points around each note: all four corners, plus
// four evenly spaced points along each of the four edges. When you release
// a drag near a note, React Flow snaps to whichever registered handle is
// geometrically closest to the cursor (see `getClosestHandle` in
// @xyflow/system) — more points spread around the whole perimeter is what
// makes "closest handle" track where a user actually grabbed or released,
// rather than snapping to one of a handful of coarse spots.
//
// They sit in a small ring just *outside* the note's border rather than
// on it, because the border itself already belongs to NodeResizer below —
// its corner squares and its full-length edge-drag lines both live
// exactly on that line. Offsetting our handles clear of it means the two
// interactions (resize vs. connect) never compete for the same pixels.
const HANDLE_SIZE = 10; // px — each handle's own small hit/visual box
const HANDLE_GAP = 6; // px — distance from the border to a handle's center
const OUTWARD = `-${HANDLE_GAP + HANDLE_SIZE / 2}px`;
const INWARD = `calc(100% + ${HANDLE_GAP - HANDLE_SIZE / 2}px)`;

/** A CSS position (as a percentage of the note's own size) for a handle
 * centered exactly on the given fraction `t` (0–1) along an edge. */
function edgeFraction(t: number): string {
  return `calc(${t * 100}% - ${HANDLE_SIZE / 2}px)`;
}

type HandleSpec = {
  id: string;
  position: Position;
  top: string;
  left: string;
};

const CORNERS: HandleSpec[] = [
  { id: "top-left", position: Position.Top, top: OUTWARD, left: OUTWARD },
  { id: "top-right", position: Position.Top, top: OUTWARD, left: INWARD },
  { id: "bottom-left", position: Position.Bottom, top: INWARD, left: OUTWARD },
  { id: "bottom-right", position: Position.Bottom, top: INWARD, left: INWARD },
];

// Four interior points per edge (at 20/40/60/80% along it, corners
// excluded since those are already covered above) — 4 + 4 × 4 = 20 total.
const EDGE_FRACTIONS = [0.2, 0.4, 0.6, 0.8];

const EDGES: HandleSpec[] = EDGE_FRACTIONS.flatMap((t) => [
  { id: `top-${t}`, position: Position.Top, top: OUTWARD, left: edgeFraction(t) },
  { id: `bottom-${t}`, position: Position.Bottom, top: INWARD, left: edgeFraction(t) },
  { id: `left-${t}`, position: Position.Left, top: edgeFraction(t), left: OUTWARD },
  { id: `right-${t}`, position: Position.Right, top: edgeFraction(t), left: INWARD },
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
 */
function NotePreview({ content }: { content: JSONContent | null }) {
  const extensions = useMemo(() => getNoteExtensions(), []);
  const html = useMemo(
    () => generateHTML(content ?? EMPTY_DOC, extensions),
    [content, extensions],
  );

  if (isEmptyContent(content)) {
    return <p className="p-2 text-sm text-zinc-400">Type something…</p>;
  }

  return (
    <div
      className="tiptap prose-note h-full overflow-hidden p-2 text-sm text-zinc-800"
      // Safe here: `html` is generated from our own JSON schema (via
      // Tiptap's `generateHTML`), never from raw user-supplied HTML.
      dangerouslySetInnerHTML={{ __html: html }}
    />
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
  // `selected` (single click) only controls the highlight and the resize/
  // connection handles below — it does *not* decide whether the live
  // editor is mounted. That's `isEditing` (double-click), a deliberate,
  // separate action. Conflating the two used to mean a merely-selected
  // note became almost entirely `nodrag` the moment you clicked it once,
  // which is what made dragging it feel stuck — see ActiveEditorContext.
  const { editingNoteId } = useActiveEditor();
  const isEditing = editingNoteId === id;

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

  return (
    // `group` + `relative` let the connection handles fade in on hover via
    // `group-hover`, while staying siblings of (not nested inside) the
    // overflow-hidden card below so the handles never get clipped at the
    // card's rounded corners.
    <div className="group relative h-full w-full">
      {/* Draggable resize handles, shown only while this note is selected. */}
      <NodeResizer
        isVisible={selected}
        minWidth={220}
        minHeight={140}
        lineClassName="!border-blue-400"
        handleClassName="!h-2.5 !w-2.5 !rounded-[3px] !border !border-blue-400 !bg-white"
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
          style={{ top: handle.top, left: handle.left, transform: "none" }}
          className={`!h-2.5 !w-2.5 !rounded-full !border !border-zinc-400 !bg-white !transition-opacity ${
            selected ? "!opacity-100" : "!opacity-0 group-hover:!opacity-100"
          }`}
        />
      ))}

      <div
        className={`relative flex h-full w-full flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-colors ${
          selected ? "border-blue-400 shadow-md" : "border-zinc-200"
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
            className="nodrag absolute right-1.5 top-1.5 z-10 rounded bg-white/80 p-1 text-xs leading-none text-zinc-400 backdrop-blur-sm hover:bg-zinc-100 hover:text-zinc-600"
            aria-label="Delete note"
            title="Delete note"
          >
            ✕
          </button>
        )}

        {/* Double-click to edit; single click/select alone leaves this as
            the read-only preview so the note stays fully draggable. Its
            formatting toolbar lives outside the canvas, in
            `FormattingDock`, which finds this editor via
            `ActiveEditorContext` rather than through props.

            The `p-3` here still matters while editing: RichTextEditor
            marks its own content `nodrag` (so clicking to place a text
            cursor, or dragging across text to select it, doesn't drag the
            note instead). This padding belongs to *this* wrapper, not the
            editor, so it's never nodrag — a comfortably-sized frame you
            can still drag by even mid-edit. The editor's and preview's own
            inner padding is reduced to match, so the text doesn't end up
            sitting any further from the card's edge than before. */}
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
