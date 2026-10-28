"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { OnProgressParameters, PDFDocumentProxy } from "pdfjs-dist";
import { ChevronIcon, PlusIcon, SpinnerIcon } from "./icons";
import ReaderShell, { readerField, readerToolButton } from "./ReaderShell";
import type { ViewerProps } from "./viewer-types";
import PdfPage, { type PageSize, type PdfJs } from "./PdfPage";

type PdfReaderProps = ViewerProps;

type LoadState =
  | { kind: "loading"; progress: number | null }
  | { kind: "ready"; pdfjs: PdfJs; pdf: PDFDocumentProxy; firstPage: PageSize }
  | { kind: "error"; reason: "missing" | "password" | "invalid" | "failed" };

/** 100% zoom, as every PDF viewer defines it: one PDF point is 96/72 CSS pixels. */
const CSS_UNITS = 96 / 72;
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

let pdfjsPromise: Promise<PdfJs> | null = null;

/**
 * pdf.js is large, so it's only fetched when someone opens a file. The
 * worker is a separate file the bundler emits next to the app's own
 * scripts; the CSP's `worker-src 'self' blob:` is what lets it start.
 */
function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    return pdfjs;
  });
  return pdfjsPromise;
}

function classifyError(error: unknown): Extract<LoadState, { kind: "error" }>["reason"] {
  const { name, message } = (error ?? {}) as { name?: string; message?: string };
  if (name === "PasswordException") return "password";
  if (name === "InvalidPDFException") return "invalid";
  // The signed-link request fails with "Object not found" when the bytes
  // are gone; pdf.js reports a 404 from the link itself as a missing PDF.
  if (name === "MissingPDFException" || /not found/i.test(message ?? "")) return "missing";
  return "failed";
}

const ERROR_TEXT = {
  missing: "This file is missing from storage. Remove it from the sidebar and add it again.",
  password: "This PDF is password-protected, which isn’t supported yet.",
  invalid: "This file couldn’t be read as a PDF.",
  failed: "Couldn’t load the file. Check your connection and try again.",
} as const;

/**
 * The PDF reading pane: a title bar with page and zoom controls over a
 * continuously scrolling stack of pages. Sits beside the board on wide
 * screens (so a note can be written while reading) and takes the whole
 * screen on narrow ones.
 */
export default function PdfReader({ file, getUrl }: PdfReaderProps) {
  const { id: fileId, storagePath } = file;
  const [state, setState] = useState<LoadState>({ kind: "loading", progress: null });
  const [attempt, setAttempt] = useState(0);
  // The scrolling element, twice: as state so the pages learn when it
  // exists (they observe visibility against it), and as a ref because
  // moving its scroll position is a mutation of the DOM node.
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const attachScroller = useCallback((element: HTMLDivElement | null) => {
    scrollerRef.current = element;
    setScroller(element);
  }, []);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [zoom, setZoom] = useState<"fit" | number>("fit");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState<string | null>(null);
  // Where in the document the reader was (0–1), so a zoom or resize keeps
  // them on the same paragraph instead of jumping to the same pixel offset.
  const scrollRatio = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | null = null;

    async function load() {
      setState({ kind: "loading", progress: null });
      try {
        const [pdfjs, url] = await Promise.all([loadPdfJs(), getUrl(storagePath)]);
        if (cancelled) return;
        const loadingTask = pdfjs.getDocument({ url });
        task = loadingTask;
        loadingTask.onProgress = ({ loaded, total }: OnProgressParameters) => {
          if (cancelled || !total) return;
          setState((current) => (current.kind === "loading" ? { kind: "loading", progress: loaded / total } : current));
        };
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        const first = (await pdf.getPage(1)).getViewport({ scale: 1 });
        if (cancelled) return;
        setCurrentPage(1);
        setState({ kind: "ready", pdfjs, pdf, firstPage: { width: first.width, height: first.height } });
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to open the PDF:", error);
        setState({ kind: "error", reason: classifyError(error) });
      }
    }

    load();
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [fileId, storagePath, getUrl, attempt]);

  // How wide the reading area is, for "fit width". A ResizeObserver's
  // `contentRect` already excludes the scroller's padding, which is the
  // gutter around the pages.
  useEffect(() => {
    if (!scroller) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setAvailableWidth((current) => (Math.abs(current - width) < 1 ? current : width));
    });
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [scroller]);

  const firstPage = state.kind === "ready" ? state.firstPage : null;
  const fitScale = firstPage && availableWidth > 0 ? Math.max(0.2, availableWidth / firstPage.width) : CSS_UNITS;
  const cssScale = zoom === "fit" ? fitScale : zoom * CSS_UNITS;
  const percent = Math.round((cssScale / CSS_UNITS) * 100);

  // After a zoom or resize changes every page's height, put the reader
  // back where they were in the document.
  useLayoutEffect(() => {
    const element = scrollerRef.current;
    if (element) element.scrollTop = scrollRatio.current * element.scrollHeight;
  }, [cssScale]);

  const pageCount = state.kind === "ready" ? state.pdf.numPages : 0;

  // "Which page am I on": the one under the top third of the viewport.
  const handleScroll = useCallback(() => {
    if (!scroller) return;
    scrollRatio.current = scroller.scrollTop / Math.max(1, scroller.scrollHeight);
    const probe = scroller.scrollTop + scroller.clientHeight / 3;
    const pages = scroller.querySelectorAll<HTMLElement>("[data-page]");
    let current = pages.length;
    for (const page of pages) {
      if (page.offsetTop + page.offsetHeight > probe) {
        current = Number(page.dataset.page);
        break;
      }
    }
    setCurrentPage(Math.max(1, current));
  }, [scroller]);

  const goToPage = useCallback(
    (pageNumber: number) => {
      if (!scroller || pageCount === 0) return;
      const target = Math.min(pageCount, Math.max(1, Math.round(pageNumber)));
      const page = scroller.querySelector<HTMLElement>(`[data-page="${target}"]`);
      if (page) scroller.scrollTo({ top: page.offsetTop - 12 });
    },
    [scroller, pageCount],
  );

  const stepZoom = (direction: 1 | -1) => {
    const currentZoom = cssScale / CSS_UNITS;
    const next =
      direction === 1
        ? ZOOM_STEPS.find((step) => step > currentZoom + 0.01)
        : [...ZOOM_STEPS].reverse().find((step) => step < currentZoom - 0.01);
    if (next) setZoom(next);
  };

  return (
    <ReaderShell
      file={file}
      toolbar={
        <>
          <button type="button" onClick={() => goToPage(currentPage - 1)} disabled={pageCount === 0 || currentPage <= 1} aria-label="Previous page" className={readerToolButton}>
            <ChevronIcon direction="up" />
          </button>
          <button type="button" onClick={() => goToPage(currentPage + 1)} disabled={pageCount === 0 || currentPage >= pageCount} aria-label="Next page" className={readerToolButton}>
            <ChevronIcon direction="down" />
          </button>
          <div className="flex items-center gap-1 tabular-nums">
            <input
              aria-label="Page number"
              inputMode="numeric"
              disabled={pageCount === 0}
              value={pageInput ?? String(pageCount === 0 ? "" : currentPage)}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => setPageInput(event.target.value.replace(/\D/g, ""))}
              onBlur={() => setPageInput(null)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                const target = Number(pageInput);
                if (target > 0) goToPage(target);
                setPageInput(null);
                event.currentTarget.blur();
              }}
              className={`${readerField} w-10 text-center`}
            />
            <span>of {pageCount || "–"}</span>
          </div>
          <span className="flex-1" />
          <button type="button" onClick={() => stepZoom(-1)} disabled={state.kind !== "ready" || cssScale / CSS_UNITS <= ZOOM_STEPS[0] + 0.01} aria-label="Zoom out" className={readerToolButton}>
            <span aria-hidden className="text-base leading-none">−</span>
          </button>
          <span className="w-10 text-center tabular-nums" aria-live="polite" aria-label={`Zoom ${percent} percent`}>
            {state.kind === "ready" ? `${percent}%` : "–"}
          </span>
          <button type="button" onClick={() => stepZoom(1)} disabled={state.kind !== "ready" || cssScale / CSS_UNITS >= ZOOM_STEPS[ZOOM_STEPS.length - 1] - 0.01} aria-label="Zoom in" className={readerToolButton}>
            <PlusIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom("fit")}
            disabled={state.kind !== "ready" || zoom === "fit"}
            aria-pressed={zoom === "fit"}
            title="Fit the page to the width of this pane"
            className={`${readerToolButton} px-2 aria-pressed:bg-(--zt-hover)`}
          >
            Fit
          </button>
        </>
      }
    >
      <div
        ref={attachScroller}
        onScroll={handleScroll}
        tabIndex={0}
        aria-label="PDF pages"
        // `overflow-y-scroll`, not `auto`: a classic (space-taking) scroll bar
        // that appears and disappears changes the width "Fit" measures, and a
        // page that is only just tall enough to need one would flicker between
        // two sizes forever. Always reserving it keeps the width constant.
        className="zt-scroll relative min-h-0 flex-1 overflow-x-auto overflow-y-scroll px-4 py-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--zt-select)"
      >
        {state.kind === "ready" &&
          Array.from({ length: state.pdf.numPages }, (_, index) => (
            <PdfPage
              key={index + 1}
              pdfjs={state.pdfjs}
              pdf={state.pdf}
              pageNumber={index + 1}
              cssScale={cssScale}
              fallbackSize={state.firstPage}
              scrollRoot={scroller}
            />
          ))}

        {state.kind === "loading" && (
          <p className="flex items-center justify-center gap-2 py-16 text-[13px] text-(--zt-dim)">
            <SpinnerIcon className="h-4 w-4" />
            Opening {file.name}…{state.progress !== null && ` ${Math.round(state.progress * 100)}%`}
          </p>
        )}

        {state.kind === "error" && (
          <div className="mx-auto flex max-w-xs flex-col items-center gap-3 py-16 text-center text-[13px] text-(--zt-dim)">
            <p>{ERROR_TEXT[state.reason]}</p>
            {state.reason === "failed" && (
              <button
                type="button"
                onClick={() => setAttempt((count) => count + 1)}
                className="rounded border border-(--zt-field-border) bg-(--zt-field) px-3 py-1 text-(--zt-text) hover:bg-(--zt-hover)"
              >
                Try again
              </button>
            )}
          </div>
        )}
      </div>
    </ReaderShell>
  );
}
