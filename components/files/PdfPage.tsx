"use client";

import { memo, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

export type PdfJs = typeof import("pdfjs-dist");
export type PageSize = { width: number; height: number };

type PdfPageProps = {
  pdfjs: PdfJs;
  pdf: PDFDocumentProxy;
  pageNumber: number;
  /** CSS pixels per PDF point (100% zoom is 96 / 72). */
  cssScale: number;
  /** Page 1's size in points — what every page is laid out as until it's been measured. */
  fallbackSize: PageSize;
  /** The scrolling element the page lives in; pages near its viewport get drawn. */
  scrollRoot: HTMLElement | null;
};

// A canvas bigger than this gets drawn at a lower resolution instead —
// browsers silently refuse (or crash on) very large canvases, and a
// huge page at 300% zoom on a retina screen would be one.
const MAX_CANVAS_PIXELS = 16 * 1024 * 1024;
const RERENDER_DELAY_MS = 150;

/**
 * One PDF page: a white sheet sized to the page, a canvas for the artwork,
 * and an invisible text layer on top so text can be selected and copied.
 *
 * Only pages within about a screen of the viewport are drawn; scrolling
 * away frees the canvas again, so memory stays flat however long the
 * document is. Until a page has been drawn, the sheet is already the right
 * size (from page 1's shape, then its own once measured), so the scroll
 * bar and page numbers are stable from the start.
 */
function PdfPage({ pdfjs, pdf, pageNumber, cssScale, fallbackSize, scrollRoot }: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(pageNumber <= 2);
  const [measured, setMeasured] = useState<PageSize | null>(null);
  const [drawn, setDrawn] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet || !scrollRoot) return;
    const observer = new IntersectionObserver((entries) => setNear(entries.some((entry) => entry.isIntersecting)), {
      root: scrollRoot,
      rootMargin: "100% 0px",
    });
    observer.observe(sheet);
    return () => observer.disconnect();
  }, [scrollRoot]);

  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    let textLayer: InstanceType<PdfJs["TextLayer"]> | null = null;

    // A zoom change fires this many times in a row; wait for it to settle.
    // The first draw of a page goes straight away.
    const timer = window.setTimeout(
      async () => {
        try {
          const page = await pdf.getPage(pageNumber);
          if (cancelled) return;
          const natural = page.getViewport({ scale: 1 });
          setMeasured({ width: natural.width, height: natural.height });

          const viewport = page.getViewport({ scale: cssScale });
          const canvas = canvasRef.current;
          const textContainer = textLayerRef.current;
          if (!canvas || !textContainer) return;

          let outputScale = Math.min(window.devicePixelRatio || 1, 2);
          const pixels = viewport.width * viewport.height * outputScale * outputScale;
          if (pixels > MAX_CANVAS_PIXELS) outputScale *= Math.sqrt(MAX_CANVAS_PIXELS / pixels);
          canvas.width = Math.floor(viewport.width * outputScale);
          canvas.height = Math.floor(viewport.height * outputScale);

          renderTask = page.render({
            canvas,
            viewport,
            transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
          });
          await renderTask.promise;
          if (cancelled) return;
          setDrawn(true);
          setFailed(false);

          textContainer.replaceChildren();
          textLayer = new pdfjs.TextLayer({
            textContentSource: page.streamTextContent(),
            container: textContainer,
            viewport,
          });
          await textLayer.render();
        } catch (error) {
          if (cancelled || (error as { name?: string })?.name === "RenderingCancelledException") return;
          console.error(`Failed to draw page ${pageNumber}:`, error);
          setFailed(true);
        }
      },
      drawn ? RERENDER_DELAY_MS : 0,
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      renderTask?.cancel();
      textLayer?.cancel();
    };
    // `drawn` only picks the delay above; it must not restart the draw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near, pdf, pdfjs, pageNumber, cssScale]);

  // Scrolled far away: give the canvas and text back.
  useEffect(() => {
    if (near) return;
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    textLayerRef.current?.replaceChildren();
    // Resetting "drawn" here is what shows the page-number placeholder again.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDrawn(false);
    void pdf.getPage(pageNumber).then((page) => page.cleanup());
  }, [near, pdf, pageNumber]);

  const size = measured ?? fallbackSize;
  const width = size.width * cssScale;
  const height = size.height * cssScale;

  return (
    <div
      ref={sheetRef}
      data-page={pageNumber}
      className="relative mx-auto mb-3 bg-white shadow-md ring-1 ring-black/10"
      style={{ width, height }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
      <div
        ref={textLayerRef}
        className="pdf-text-layer"
        // The text layer sizes its text from this variable, so a zoom
        // change rescales it immediately, before the redraw lands.
        style={{ "--total-scale-factor": cssScale } as React.CSSProperties}
      />
      {!drawn && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-zinc-400">
          {failed ? `Couldn’t draw page ${pageNumber}` : `Page ${pageNumber}`}
        </span>
      )}
    </div>
  );
}

export default memo(PdfPage);
