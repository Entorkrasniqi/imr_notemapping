"use client";

import Toolbar from "@/components/editor/Toolbar";
import { useActiveEditor } from "@/lib/editor/active-editor-context";

/**
 * A small floating dock, centered under the canvas, holding formatting
 * controls for whichever note is currently selected.
 *
 * It's deliberately compact — capped at 10% of the viewport height via
 * `max-h-[10vh]`, with everything in one horizontally-scrollable row
 * rather than wrapping to a second — and always present rather than
 * appearing/disappearing with selection, so the board's chrome doesn't
 * jump around as you click between notes. With nothing selected, its
 * controls simply render inactive (see `Toolbar`).
 */
export default function FormattingDock() {
  const { activeEditor } = useActiveEditor();

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
      <div
        // Read by Board's double-click-to-create guard: a stray double
        // click while scrubbing through these controls shouldn't be
        // treated as "double-click empty canvas" (this dock sits outside
        // any `.react-flow__node`).
        data-formatting-dock=""
        className="pointer-events-auto flex max-h-[10vh] max-w-[min(90vw,44rem)] items-center overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white/85 px-2 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.10)] backdrop-blur-md"
      >
        <Toolbar editor={activeEditor} />
      </div>
    </div>
  );
}
