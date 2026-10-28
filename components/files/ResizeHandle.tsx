"use client";

import { useRef } from "react";

type ResizeHandleProps = {
  /** The width being controlled, in px — the pane to the handle's left. */
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
};

const KEYBOARD_STEP = 24;

/**
 * The draggable divider between the PDF reader and the board. A real
 * `role="separator"` with a value, so it works from the keyboard too
 * (arrow keys, Home/End) and a screen reader announces what it resizes.
 */
export default function ResizeHandle({ value, min, max, onChange, label }: ResizeHandleProps) {
  const drag = useRef<{ startX: number; startValue: number } | null>(null);
  const clamp = (next: number) => Math.min(max, Math.max(min, next));

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      // `touch-action: none` so a finger drag resizes instead of scrolling.
      className="group relative z-10 hidden w-1.5 shrink-0 cursor-col-resize touch-none bg-(--zt-border) outline-none transition-colors hover:bg-(--zt-select) focus-visible:bg-(--zt-select) data-[dragging=true]:bg-(--zt-select) md:block"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.dataset.dragging = "true";
        drag.current = { startX: event.clientX, startValue: value };
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        onChange(clamp(drag.current.startValue + event.clientX - drag.current.startX));
      }}
      onPointerUp={(event) => {
        drag.current = null;
        delete event.currentTarget.dataset.dragging;
      }}
      onPointerCancel={(event) => {
        drag.current = null;
        delete event.currentTarget.dataset.dragging;
      }}
      onKeyDown={(event) => {
        const next =
          event.key === "ArrowLeft"
            ? value - KEYBOARD_STEP
            : event.key === "ArrowRight"
              ? value + KEYBOARD_STEP
              : event.key === "Home"
                ? min
                : event.key === "End"
                  ? max
                  : null;
        if (next === null) return;
        event.preventDefault();
        onChange(clamp(next));
      }}
    >
      {/* A wider invisible grab area; the visible line stays thin. */}
      <span className="absolute inset-y-0 -left-1.5 -right-1.5" />
    </div>
  );
}
