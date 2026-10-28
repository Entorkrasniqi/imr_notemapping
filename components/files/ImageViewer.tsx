"use client";

import { useCallback, useRef, useState } from "react";
import { PlusIcon } from "./icons";
import ReaderShell, { readerToolButton } from "./ReaderShell";
import { useParsedFile, type Parsed } from "./useParsedFile";
import ViewerMessage from "./ViewerMessage";
import type { ViewerProps } from "./viewer-types";

const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

/**
 * Pictures, shown from a blob URL made from the downloaded bytes — the CSP
 * allows `blob:` images but not the Storage origin, and this keeps it so.
 * "Fit" shows the whole picture in the pane; zooming shows it at a real
 * multiple of its own size, scrolling when it's bigger than the pane.
 */
export default function ImageViewer({ file, getUrl }: ViewerProps) {
  const mimeType = file.mimeType ?? "image/png";
  const parse = useCallback(
    async (bytes: ArrayBuffer): Promise<Parsed<string>> => {
      const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
      return { value: url, dispose: () => URL.revokeObjectURL(url) };
    },
    [mimeType],
  );
  const { state, retry } = useParsedFile(file.storagePath, getUrl, parse);

  const imageRef = useRef<HTMLImageElement>(null);
  const [zoom, setZoom] = useState<"fit" | number>("fit");
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);

  // What "fit" currently amounts to, so + and − step from where you are.
  const currentZoom = () => {
    if (zoom !== "fit") return zoom;
    const image = imageRef.current;
    return image && natural ? image.clientWidth / natural.width : 1;
  };
  const stepZoom = (direction: 1 | -1) => {
    const current = currentZoom();
    const next =
      direction === 1
        ? ZOOM_STEPS.find((step) => step > current + 0.01)
        : [...ZOOM_STEPS].reverse().find((step) => step < current - 0.01);
    if (next) setZoom(next);
  };
  const ready = state.kind === "ready" && natural !== null;

  return (
    <ReaderShell
      file={file}
      toolbar={
        <>
          <span className="flex-1 truncate tabular-nums text-(--zt-dim)">{natural ? `${natural.width} × ${natural.height}` : ""}</span>
          <button type="button" onClick={() => stepZoom(-1)} disabled={!ready} aria-label="Zoom out" className={readerToolButton}>
            <span aria-hidden className="text-base leading-none">−</span>
          </button>
          <span className="w-10 text-center tabular-nums" aria-live="polite">
            {ready ? (zoom === "fit" ? "Fit" : `${Math.round(zoom * 100)}%`) : "–"}
          </span>
          <button type="button" onClick={() => stepZoom(1)} disabled={!ready} aria-label="Zoom in" className={readerToolButton}>
            <PlusIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom("fit")}
            disabled={!ready || zoom === "fit"}
            aria-pressed={zoom === "fit"}
            title="Fit the picture to this pane"
            className={`${readerToolButton} px-2 aria-pressed:bg-(--zt-hover)`}
          >
            Fit
          </button>
        </>
      }
    >
      <div tabIndex={0} aria-label="Image" className="zt-scroll min-h-0 flex-1 overflow-auto p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--zt-select)">
        {state.kind !== "ready" ? (
          <ViewerMessage state={state} fileName={file.name} what="an image" onRetry={retry} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- a blob URL of the user's own file; next/image can't optimise it
          <img
            ref={imageRef}
            src={state.value}
            alt={file.name}
            onLoad={(event) => setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
            onError={() => setNatural(null)}
            className="mx-auto block max-w-none rounded bg-white/5 shadow-md ring-1 ring-black/10"
            style={zoom === "fit" ? { maxWidth: "100%", height: "auto" } : { width: natural ? natural.width * zoom : undefined }}
          />
        )}
      </div>
    </ReaderShell>
  );
}
