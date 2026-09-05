"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";

/**
 * A connection between two notes.
 *
 * This wraps React Flow's built-in step-path drawing (`getSmoothStepPath`,
 * the same math the library's own `smoothstep` edge type uses) so we can
 * add one thing on top: a small delete button that appears at the edge's
 * midpoint while it's selected. Deleting via Backspace/Delete already
 * works for any selected edge without this — the button just makes
 * deletion discoverable without needing to know that shortcut.
 */
export default function DeletableEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  markerEnd,
  selected,
}: EdgeProps) {
  const { deleteElements } = useReactFlow();

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const strokeColor = selected ? "#3b82f6" : "#a1a1aa";

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        // `markerEnd` arrives here as a ready-made reference to the marker
        // React Flow built from Board's `defaultEdgeOptions` — its color is
        // fixed at that definition, not something this component recolors.
        markerEnd={markerEnd}
        style={{
          stroke: strokeColor,
          strokeWidth: selected ? 2.5 : 1.5,
        }}
      />
      {selected && (
        // Edge labels render into a shared overlay positioned in screen
        // space (outside the SVG the edge path itself lives in), which is
        // the only way to put ordinary HTML — like a button — at a precise
        // point along an edge.
        <EdgeLabelRenderer>
          <button
            type="button"
            title="Delete connection"
            aria-label="Delete connection"
            onClick={() => deleteElements({ edges: [{ id }] })}
            className="nodrag nopan absolute flex h-5 w-5 items-center justify-center rounded-full border border-zinc-200 bg-white text-[10px] leading-none text-zinc-500 shadow-sm hover:bg-zinc-100 hover:text-zinc-700"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
          >
            ✕
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
