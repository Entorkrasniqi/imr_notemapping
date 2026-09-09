"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addEdge,
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type DefaultEdgeOptions,
  type NodeChange,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import NoteNode from "./NoteNode";
import DeletableEdge from "./DeletableEdge";
import FormattingDock from "./FormattingDock";
import { ActiveEditorProvider, useActiveEditor } from "@/lib/editor/active-editor-context";
import { RecordBeforeChangeProvider, useBoardHistory } from "@/hooks/useBoardHistory";
import { useSupabaseBoardSync } from "@/hooks/useSupabaseBoardSync";
import { createClient } from "@/lib/supabase/client";
import { useTheme, type Theme } from "@/lib/theme/theme-context";
import ThemeToggle from "@/components/theme/ThemeToggle";
import type { BoardEdge, NoteNode as NoteNodeType } from "@/types/canvas";

// React Flow's <Background>/<MiniMap> take raw color props, not
// classNames — there's no CSS selector reaching into their internals the
// way `dark:`/`blueprint:` utilities do everywhere else in this app, so
// each theme's canvas dot color and minimap tint has to be picked in JS.
const CANVAS_COLORS: Record<Theme, { dots: string; minimapNode: string; minimapMask: string }> = {
  light: { dots: "#d4d4d8", minimapNode: "#d4d4d8", minimapMask: "rgba(244, 244, 245, 0.6)" },
  dark: { dots: "#3f3f46", minimapNode: "#52525b", minimapMask: "rgba(9, 9, 11, 0.6)" },
  blueprint: { dots: "rgba(255, 255, 255, 0.25)", minimapNode: "rgba(255, 255, 255, 0.4)", minimapMask: "rgba(15, 48, 87, 0.6)" },
};

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
// A closed note shows only its title (see NoteNode/NotePreview) — this is
// just tall enough for one line of the larger title text plus the small
// "more content" hint, so a closed note doesn't carry empty dead space
// sized for a body nobody can currently see.
const COLLAPSED_NOTE_HEIGHT = 56;

/** Builds a new note node centered on a given flow-space position. */
function createNote(center: { x: number; y: number }): NoteNodeType {
  return {
    // A real UUID, not an ad-hoc string, because it has to be one:
    // `nodes.id` in Postgres is a `uuid` column (see docs/database.md,
    // which specifically calls out generating them client-side as safe
    // and intentional — this is exactly that). `crypto.randomUUID()` is a
    // standard browser API, no library needed.
    id: crypto.randomUUID(),
    type: "note",
    position: {
      x: center.x - DEFAULT_NOTE_WIDTH / 2,
      y: center.y - DEFAULT_NOTE_HEIGHT / 2,
    },
    width: DEFAULT_NOTE_WIDTH,
    height: DEFAULT_NOTE_HEIGHT,
    data: { content: null },
    // Selected on creation so its highlight/handles show immediately.
    // Whether it's also open for typing is a separate flag the caller
    // sets via `setEditingNoteId` — see `addNoteAtScreenPoint` below.
    selected: true,
  };
}

/**
 * The canvas itself. Split from `Board` below because it needs
 * `useReactFlow()` — which only works inside a `<ReactFlowProvider>` — to
 * convert mouse/screen coordinates into canvas ("flow") coordinates when
 * placing a new note.
 */
function FlowCanvas({ boardId }: { boardId: string }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const { editingNoteId, setEditingNoteId } = useActiveEditor();
  const { theme } = useTheme();
  const canvasColors = CANVAS_COLORS[theme];

  // React state remains what the canvas actually renders from — Supabase
  // is a sync target underneath it, not a replacement for it (see
  // docs/architecture.md's data-flow section). `useNodesState`/
  // `useEdgesState` are small React Flow helpers around useState that
  // also give us `onNodesChange`/`onEdgesChange`, which apply
  // drag/select/resize/remove updates for us.
  const [nodes, setNodes, onNodesChange] = useNodesState<NoteNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<BoardEdge>([]);

  // Phase 5: the board now lives in Postgres instead of localStorage
  // (Phase 4). This loads it once on mount — establishing a session,
  // finding or creating this user's one board, and fetching its
  // nodes/edges — then writes back (debounced) on every change after
  // that. See hooks/useSupabaseBoardSync.ts for the mechanics and
  // lib/supabase/board-sync.ts for the actual CRUD.
  const { status: boardStatus, saveStatus, retry: retryBoardLoad } = useSupabaseBoardSync({
    boardId,
    nodes,
    edges,
    setNodes,
    setEdges,
  });

  // Undo/redo for board-level actions (create/delete/move/resize/connect)
  // — see hooks/useBoardHistory.tsx for why text edits inside a note are
  // deliberately excluded from this. `getCurrentSnapshot` is read at the
  // moment of each undo/redo, so it has to be a function, not a value —
  // otherwise it would always hand back whatever `nodes`/`edges` were
  // when this render happened to run.
  const getCurrentSnapshot = useCallback(
    () => ({ nodes, edges }),
    [nodes, edges],
  );
  const restoreSnapshot = useCallback(
    (snapshot: { nodes: NoteNodeType[]; edges: BoardEdge[] }) => {
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);
    },
    [setNodes, setEdges],
  );
  const { recordBeforeChange, undo, redo } = useBoardHistory({
    getCurrent: getCurrentSnapshot,
    restore: restoreSnapshot,
  });

  // Escape closes whichever note is open for editing — checked first and
  // unconditionally (not gated on `editingNoteId` being falsy like the
  // undo/redo branch below), since it's the one keyboard shortcut in this
  // handler that only makes sense *while* editing.
  //
  // Ctrl/Cmd+Z (Shift+Z or Y for redo, covering both the Mac/cross-platform
  // and Windows conventions) only fires when no note is being edited.
  // Tiptap already owns Ctrl+Z for undoing text while a note is open (see
  // RichTextEditor's extensions); if this handler also reacted then, the
  // two undo stacks would fight over the same keystroke.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && editingNoteId) {
        event.preventDefault();
        setEditingNoteId(null);
        return;
      }
      if (editingNoteId) return;
      const isModPressed = event.metaKey || event.ctrlKey;
      if (!isModPressed) return;
      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (key === "y") {
        event.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingNoteId, setEditingNoteId, undo, redo]);

  // Wrap the built-in change handlers to record history right before a
  // note or edge is *removed* — the one node/edge change type that's
  // always a single, complete action rather than a step in a longer
  // gesture (a drag or resize fires many intermediate changes; those are
  // instead captured once, up front, via onNodeDragStart/onResizeStart).
  const handleNodesChange = useCallback(
    (changes: NodeChange<NoteNodeType>[]) => {
      if (changes.some((change) => change.type === "remove")) {
        recordBeforeChange();
      }
      onNodesChange(changes);
    },
    [onNodesChange, recordBeforeChange],
  );

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      if (changes.some((change) => change.type === "remove")) {
        recordBeforeChange();
      }
      onEdgesChange(changes);
    },
    [onEdgesChange, recordBeforeChange],
  );

  // Text-edit mode should end the moment its note is no longer the
  // selected one — clicking a different note, or clicking empty canvas,
  // both already change `nodes[].selected` via React Flow's own click
  // handling, so this just has to notice the mismatch and follow it.
  // Without this, editing a note and then clicking straight past it onto
  // another note would leave the first one stuck in edit mode.
  useEffect(() => {
    if (!editingNoteId) return;
    const editingNote = nodes.find((node) => node.id === editingNoteId);
    if (!editingNote?.selected) {
      setEditingNoteId(null);
    }
  }, [nodes, editingNoteId, setEditingNoteId]);

  // Shrinks a note to fit just its title the moment it stops being edited,
  // and restores whatever height it had before the next time it's opened
  // again. Tracking the *previous* editingNoteId in a ref (rather than
  // reading it from state) is what lets this tell "a note just opened"
  // apart from "a note just closed" in one effect, since by the time it
  // runs, `editingNoteId` itself already only reflects the new state.
  const previousEditingNoteId = useRef<string | null>(null);
  useEffect(() => {
    const previousId = previousEditingNoteId.current;
    previousEditingNoteId.current = editingNoteId;
    if (previousId === editingNoteId) return;

    setNodes((current) =>
      current.map((node) => {
        if (node.id === previousId) {
          return {
            ...node,
            height: COLLAPSED_NOTE_HEIGHT,
            data: {
              ...node.data,
              expandedHeight: node.height ?? DEFAULT_NOTE_HEIGHT,
            },
          };
        }
        if (node.id === editingNoteId) {
          return {
            ...node,
            height: node.data.expandedHeight ?? DEFAULT_NOTE_HEIGHT,
          };
        }
        return node;
      }),
    );
  }, [editingNoteId, setNodes]);

  // A single click opens a note for editing. This is safe against
  // dragging because React Flow already tells the two apart itself:
  // `onNodeClick` only fires for a genuine click (mouseup near where the
  // mousedown started), while an actual drag gesture (mousedown, then
  // move past a small threshold) fires the drag handlers instead and
  // never reaches this one — so grabbing a note and moving it still
  // works exactly as before.
  const handleNodeClick = useCallback<NodeMouseHandler>(
    (_event, node) => {
      setEditingNoteId(node.id);
    },
    [setEditingNoteId],
  );

  // Fired when a connection drag is released on a valid handle. `addEdge`
  // is a small React Flow utility that appends the new edge (filling in an
  // id, and anything from `defaultEdgeOptions`) without us hand-rolling
  // that bookkeeping.
  const handleConnect = useCallback(
    (connection: Connection) => {
      recordBeforeChange();
      // `addEdge`'s own default id (`xy-edge__<source>-<target>`) isn't a
      // valid UUID either, for the same reason `createNote` above needs
      // one — `edges.id` is a `uuid` column too.
      setEdges((current) =>
        addEdge(connection, current, { getEdgeId: () => crypto.randomUUID() }),
      );
    },
    [setEdges, recordBeforeChange],
  );

  const addNoteAtScreenPoint = useCallback(
    (clientX: number, clientY: number) => {
      const flowPosition = screenToFlowPosition({ x: clientX, y: clientY });
      const note = createNote(flowPosition);
      recordBeforeChange();
      // Deselect existing notes so the new one is the only selected one,
      // and open it for typing immediately — creating a note is itself a
      // deliberate enough action that it should be ready to type into
      // right away, the same way double-clicking an existing one is.
      setNodes((current) => [
        ...current.map((node) => ({ ...node, selected: false })),
        note,
      ]);
      setEditingNoteId(note.id);
    },
    [screenToFlowPosition, setNodes, setEditingNoteId, recordBeforeChange],
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
  // just select/focus it, not stack a new note on top) and against
  // double-clicking inside the floating formatting dock — it renders
  // outside any `.react-flow__node`, so it needs its own check.
  const handleWrapperDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest(".react-flow__node")) return;
      if (target.closest("[data-formatting-dock]")) return;
      addNoteAtScreenPoint(event.clientX, event.clientY);
    },
    [addNoteAtScreenPoint],
  );

  const handleFitViewClick = useCallback(() => {
    fitView({ duration: 200, padding: 0.2 });
  }, [fitView]);

  const handleLogoutClick = useCallback(async () => {
    await supabase.auth.signOut();
    // `proxy.ts` would redirect here on the very next request regardless
    // (no session, not a public path), but pushing straight to `/login`
    // avoids a visible round trip through the now-stale board first.
    router.push("/login");
    router.refresh();
  }, [supabase, router]);

  // A safety net for dropping a JPEG onto a note (see NoteNode's own drop
  // handler, which does the actual work): without preventing the default
  // here too, a drop that misses every note and lands on bare canvas
  // would fall through to the browser's own handling, which for a
  // dragged-in file usually means navigating the tab to open it —
  // replacing the whole app. NoteNode's handler calls
  // `stopPropagation()` on a drop it *does* handle, so this only ever
  // fires for drops that no note caught.
  const handleWrapperDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);
  const handleWrapperDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  return (
    <RecordBeforeChangeProvider value={recordBeforeChange}>
      <div
        ref={wrapperRef}
        className="relative h-screen w-screen bg-zinc-50 dark:bg-zinc-950 blueprint:bg-background"
        onDoubleClick={handleWrapperDoubleClick}
        onDragOver={handleWrapperDragOver}
        onDrop={handleWrapperDrop}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={handleConnect}
          onNodeClick={handleNodeClick}
          onNodeDragStart={recordBeforeChange}
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
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color={canvasColors.dots} />
          <Controls showInteractive={false} />
          {/* Default position (bottom-right) pairs with Controls' default
              (bottom-left) below — the conventional, non-colliding layout
              most React Flow boards use. FormattingDock is centered at
              the bottom and stays clear of both corners in practice. */}
          <MiniMap
            pannable
            zoomable
            nodeColor={canvasColors.minimapNode}
            maskColor={canvasColors.minimapMask}
          />
        </ReactFlow>

        {/* `flex-wrap` here (and on the button group below) is what
            keeps this from overflowing off-screen on a narrow viewport —
            confirmed by actually testing at 380px width, where "Log out"
            was previously clipped entirely off the right edge with no
            way to reach it. Wrapping to a second line beats that, even
            though it isn't as polished as a dedicated narrow layout
            would be (out of scope here — see Phase 15 for real
            touch/mobile work; this is just "don't break," per Phase 8's
            breakpoints-not-touch scope). */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-4">
          <div className="pointer-events-auto flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm backdrop-blur transition-colors hover:bg-zinc-100 dark:bg-zinc-900/80 dark:text-white/70 dark:hover:bg-zinc-800 blueprint:bg-white/10 blueprint:text-white blueprint:hover:bg-white/20"
              title="Back to your boards"
            >
              ← NoteMap
            </Link>
            {/* `aria-live="polite"` so a screen reader announces a status
                change without needing focus here — and renders nothing at
                all for "idle", so this doesn't add permanent visual noise
                to the header for the (most common) case of "nothing to
                report right now." */}
            <p
              aria-live="polite"
              className="text-xs font-medium text-zinc-400 dark:text-white/40 blueprint:text-white/60"
            >
              {saveStatus === "saving" && "Saving…"}
              {saveStatus === "saved" && "Saved"}
              {saveStatus === "error" && "Couldn't save — will retry on your next change"}
            </p>
          </div>
          <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={handleFitViewClick}
              title="Fit all notes in view"
              className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm backdrop-blur transition-colors hover:bg-zinc-100 dark:bg-zinc-900/80 dark:text-white/70 dark:hover:bg-zinc-800 blueprint:bg-white/10 blueprint:text-white blueprint:hover:bg-white/20"
            >
              Fit view
            </button>
            <button
              type="button"
              onClick={handleAddNoteButtonClick}
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 blueprint:border blueprint:border-white/40 blueprint:bg-transparent blueprint:text-white blueprint:hover:bg-white/10"
            >
              + Add note
            </button>
            <button
              type="button"
              onClick={handleLogoutClick}
              title="Log out"
              className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm backdrop-blur transition-colors hover:bg-zinc-100 dark:bg-zinc-900/80 dark:text-white/70 dark:hover:bg-zinc-800 blueprint:bg-white/10 blueprint:text-white blueprint:hover:bg-white/20"
            >
              Log out
            </button>
          </div>
        </div>

        {boardStatus === "loading" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-zinc-400 dark:text-white/40 blueprint:text-white/60">
              Loading your board…
            </p>
          </div>
        )}

        {boardStatus === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-50/80 dark:bg-zinc-950/80 blueprint:bg-background/90">
            <div className="pointer-events-auto flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-zinc-600 dark:text-white/60 blueprint:text-white/80">
                Couldn&apos;t reach the database.
              </p>
              <button
                type="button"
                onClick={retryBoardLoad}
                className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 blueprint:border blueprint:border-white/40 blueprint:bg-transparent blueprint:hover:bg-white/10"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Reachable if this board was deleted (in another tab, or by
            this same user earlier) while something still links to its
            URL — see BoardNotFoundError in lib/supabase/board-sync.ts. */}
        {boardStatus === "not-found" && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-50/80 dark:bg-zinc-950/80 blueprint:bg-background/90">
            <div className="pointer-events-auto flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-zinc-600 dark:text-white/60 blueprint:text-white/80">
                This board doesn&apos;t exist, or isn&apos;t yours.
              </p>
              <Link
                href="/"
                className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 blueprint:border blueprint:border-white/40 blueprint:bg-transparent blueprint:hover:bg-white/10"
              >
                Back to your boards
              </Link>
            </div>
          </div>
        )}

        {/* Gated on `boardStatus === "ready"` so this can't flash on
            screen while the real (possibly non-empty) board is still
            loading — it should only ever mean "this board is genuinely
            empty," not "we don't know yet." */}
        {boardStatus === "ready" && nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-zinc-400 dark:text-white/40 blueprint:text-white/60">
              Double-click anywhere, or press “+ Add note”, to create your first note.
            </p>
          </div>
        )}

        <FormattingDock />
      </div>
    </RecordBeforeChangeProvider>
  );
}

/** Public entry point: wraps the canvas in the providers it needs. */
export default function Board({ boardId }: { boardId: string }) {
  return (
    <ReactFlowProvider>
      <ActiveEditorProvider>
        <FlowCanvas boardId={boardId} />
      </ActiveEditorProvider>
    </ReactFlowProvider>
  );
}
