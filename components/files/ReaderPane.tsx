"use client";

import type { StoredBoardFile } from "@/lib/supabase/board-files";
import FileViewer from "./FileViewer";
import { FORMAT_META } from "./format-meta";
import { CloseIcon } from "./icons";

type ReaderPaneProps = {
  /** Every open file, in tab order. */
  files: StoredBoardFile[];
  activeId: string;
  /** The pane's width in px when it sits beside the board (from `md` up). */
  width: number;
  getUrl: (storagePath: string) => Promise<string>;
  onActivate: (fileId: string) => void;
  onCloseTab: (fileId: string) => void;
};

/**
 * The reader: a grey tab strip over the open file, like Zotero's. Every open
 * file stays mounted (hidden when it isn't the active tab), so switching
 * tabs keeps your place and a PDF doesn't reload. It sits beside the board
 * on wide screens, so a note can be written while reading, and takes the
 * whole screen on narrow ones.
 */
export default function ReaderPane({ files, activeId, width, getUrl, onActivate, onCloseTab }: ReaderPaneProps) {
  const active = files.find((file) => file.id === activeId) ?? files[0];

  return (
    <section
      aria-label="Reader"
      className="zt fixed inset-0 z-40 flex min-w-0 flex-col bg-(--zt-reader-bg) md:static md:inset-auto md:z-auto md:h-full md:w-[var(--reader-width)] md:shrink-0"
      style={{ "--reader-width": `${width}px` } as React.CSSProperties}
      data-pdf-reader
    >
      <h2 className="sr-only">{active.name}</h2>
      <div
        role="tablist"
        aria-label="Open files"
        className="flex h-9 shrink-0 items-end gap-px overflow-x-auto bg-(--zt-chrome-2) px-1 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {files.map((file) => {
          const { Icon, tone } = FORMAT_META[file.format];
          const isActive = file.id === active.id;
          return (
            <div
              key={file.id}
              role="presentation"
              // Middle-click closes a tab, as in a browser.
              onAuxClick={(event) => {
                if (event.button === 1) onCloseTab(file.id);
              }}
              className={`group flex h-8 min-w-[7rem] max-w-[11rem] shrink-0 items-center rounded-t-md border border-b-0 ${
                isActive
                  ? "border-(--zt-border) bg-(--zt-chrome) text-(--zt-text)"
                  : "border-transparent text-(--zt-dim) hover:bg-(--zt-hover)"
              }`}
            >
              <button
                type="button"
                role="tab"
                id={`reader-tab-${file.id}`}
                aria-selected={isActive}
                aria-controls={`reader-panel-${file.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onActivate(file.id)}
                title={file.name}
                className="flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-t-md pl-2 pr-1 text-left outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-(--zt-select)"
              >
                <Icon className={`h-3.5 w-3.5 shrink-0 ${tone}`} />
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
              </button>
              <button
                type="button"
                onClick={() => onCloseTab(file.id)}
                aria-label={`Close ${file.name}`}
                title="Close tab"
                className={`mr-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-(--zt-dim) hover:bg-(--zt-hover) hover:text-(--zt-text) ${
                  isActive ? "" : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                }`}
              >
                <CloseIcon className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="relative min-h-0 flex-1 border-t border-(--zt-border)">
        {files.map((file) => {
          const isActive = file.id === active.id;
          return (
            <div
              key={file.id}
              role="tabpanel"
              id={`reader-panel-${file.id}`}
              aria-labelledby={`reader-tab-${file.id}`}
              // Hidden tabs stay laid out (invisible, not display:none) so a
              // PDF keeps its size and scroll position; `inert` keeps them
              // out of reach of the keyboard and screen readers.
              inert={!isActive}
              className={`absolute inset-0 ${isActive ? "" : "invisible pointer-events-none"}`}
            >
              <FileViewer file={file} getUrl={getUrl} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
