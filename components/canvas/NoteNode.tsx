"use client";

import { memo, useCallback, useMemo } from "react";
import { generateHTML, type JSONContent } from "@tiptap/react";
import { NodeResizer, useReactFlow, type NodeProps } from "@xyflow/react";
import type { NoteNode as NoteNodeType } from "@/types/canvas";
import RichTextEditor from "@/components/editor/RichTextEditor";
import { getNoteExtensions } from "@/lib/editor/extensions";

const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

function isEmptyContent(content: JSONContent | null): boolean {
  if (!content?.content) return true;
  return content.content.every(
    (node) => node.type === "paragraph" && !node.content?.length,
  );
}

/**
 * Read-only preview shown when a note isn't selected. Rendering static
 * HTML here (via Tiptap's `generateHTML`, not a mounted editor) is what
 * keeps a board with many notes fast — see `lib/editor/extensions.ts` for
 * why this and the live editor must share one extension list.
 */
function NotePreview({ content }: { content: JSONContent | null }) {
  const extensions = useMemo(() => getNoteExtensions(), []);
  const html = useMemo(
    () => generateHTML(content ?? EMPTY_DOC, extensions),
    [content, extensions],
  );

  if (isEmptyContent(content)) {
    return <p className="p-3 text-sm text-zinc-400">Type something…</p>;
  }

  return (
    <div
      className="tiptap prose-note h-full overflow-hidden p-3 text-sm text-zinc-800"
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
    <>
      {/* Draggable resize handles, shown only while this note is selected. */}
      <NodeResizer
        isVisible={selected}
        minWidth={220}
        minHeight={140}
        lineClassName="!border-blue-400"
        handleClassName="!h-2.5 !w-2.5 !rounded-[3px] !border !border-blue-400 !bg-white"
      />

      <div
        className={`flex h-full w-full flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-colors ${
          selected ? "border-blue-400 shadow-md" : "border-zinc-200"
        }`}
      >
        {selected && (
          <div className="nodrag flex shrink-0 items-center justify-end px-1.5 py-1">
            <button
              type="button"
              onClick={handleDelete}
              className="rounded p-1 text-xs leading-none text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              aria-label="Delete note"
              title="Delete note"
            >
              ✕
            </button>
          </div>
        )}

        {/* The formatting toolbar (inside RichTextEditor) appears only
            while selected — a full ProseMirror instance is mounted only
            for the note currently being edited. Every other note renders
            its content as static HTML below. */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {selected ? (
            <RichTextEditor content={data.content} onChange={handleChange} />
          ) : (
            <NotePreview content={data.content} />
          )}
        </div>
      </div>
    </>
  );
}

export default memo(NoteNode);
