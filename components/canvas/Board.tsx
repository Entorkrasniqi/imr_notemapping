"use client";

import { useCallback, useRef } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type DefaultEdgeOptions,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import NoteNode from "./NoteNode";
import DeletableEdge from "./DeletableEdge";
import type { BoardEdge, NoteNode as NoteNodeType } from "@/types/canvas";

const nodeTypes = { note: NoteNode };
const edgeTypes = { deletable: DeletableEdge };

// Applied to every edge created via a connection drag, so we don't have to
// set `type`/`markerEnd` by hand each time in `onConnect`.
const defaultEdgeOptions: DefaultEdgeOptions = {
  type: "deletable",
  markerEnd: { type: MarkerType.ArrowClosed, color: "#a1a1aa" },
};

const DEFAULT_NOTE_WIDTH = 240;
const DEFAULT_NOTE_HEIGHT = 160;

let noteSequence = 0;

/** Builds a new note node centered on a given flow-space position. */
function createNote(center: { x: number; y: number }): NoteNodeType {
  noteSequence += 1;
  return {
    id: `note-${Date.now()}-${noteSequence}`,
    type: "note",
    position: {
      x: center.x - DEFAULT_NOTE_WIDTH / 2,
      y: center.y - DEFAULT_NOTE_HEIGHT / 2,
    },
    width: DEFAULT_NOTE_WIDTH,
    height: DEFAULT_NOTE_HEIGHT,
    data: { content: null },
    // Selected on creation so it immediately renders its (mounted-only-
    // while-selected) rich text editor and grabs focus — see NoteNode.
    selected: true,
  };
}

/**
 * The canvas itself. Split from `Board` below because it needs
 * `useReactFlow()` — which only works inside a `<ReactFlowProvider>` — to
 * convert mouse/screen coordinates into canvas ("flow") coordinates when
 * placing a new note.
 */
function FlowCanvas() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  // State is intentionally just React state in memory: no persistence yet
  // (that's Phase 4), no backend (Phase 5). `useNodesState`/`useEdgesState`
  // are small React Flow helpers around useState that also give us
  // `onNodesChange`/`onEdgesChange`, which apply drag/select/resize/remove
  // updates for us.
  const [nodes, setNodes, onNodesChange] = useNodesState<NoteNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<BoardEdge>([]);

  // Fired when a connection drag is released on a valid handle. `addEdge`
  // is a small React Flow utility that appends the new edge (filling in an
  // id, and anything from `defaultEdgeOptions`) without us hand-rolling
  // that bookkeeping.
  const handleConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) => addEdge(connection, current));
    },
    [setEdges],
  );

  const addNoteAtScreenPoint = useCallback(
    (clientX: number, clientY: number) => {
      const flowPosition = screenToFlowPosition({ x: clientX, y: clientY });
      // Deselect existing notes so the new one is the only selected (and
      // therefore only editable/focused) note.
      setNodes((current) => [
        ...current.map((node) => ({ ...node, selected: false })),
        createNote(flowPosition),
      ]);
    },
    [screenToFlowPosition, setNodes],
  );

  const handleAddNoteButtonClick = useCallback(() => {
    const bounds = wrapperRef.current?.getBoundingClientRect();
    const center = bounds
      ? { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
      : { x: 400, y: 300 };
    addNoteAtScreenPoint(center.x, center.y);
  }, [addNoteAtScreenPoint]);

  // Double-click-to-create is implemented as a plain DOM handler on the
  // wrapper div rather than a React Flow prop, because React Flow doesn't
  // expose a "pane double click" event of its own — only per-node/per-edge
  // ones. We guard against double-clicking an existing note (which should
  // just select/focus it, not stack a new note on top).
  const handleWrapperDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest(".react-flow__node")) return;
      addNoteAtScreenPoint(event.clientX, event.clientY);
    },
    [addNoteAtScreenPoint],
  );

  return (
    <div
      ref={wrapperRef}
      className="relative h-screen w-screen bg-zinc-50"
      onDoubleClick={handleWrapperDoubleClick}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        // Every handle in NoteNode is `type="source"`; loose mode is what
        // allows a source-to-source connection to form an edge at all.
        connectionMode={ConnectionMode.Loose}
        // React Flow zooms in on double-click by default; we've repurposed
        // double-click to create a note instead, so that default must go.
        zoomOnDoubleClick={false}
        deleteKeyCode={["Backspace", "Delete"]}
        minZoom={0.1}
        maxZoom={2}
        fitView={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d4d4d8" />
        <Controls showInteractive={false} />
      </ReactFlow>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
        <div className="pointer-events-auto rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm backdrop-blur">
          NoteMap
        </div>
        <button
          type="button"
          onClick={handleAddNoteButtonClick}
          className="pointer-events-auto rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-700"
        >
          + Add note
        </button>
      </div>

      {nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-zinc-400">
            Double-click anywhere, or press “+ Add note”, to create your first note.
          </p>
        </div>
      )}
    </div>
  );
}

/** Public entry point: wraps the canvas in the provider it needs. */
export default function Board() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  );
}
