"use client";

import type { ReactNode } from "react";
import type { StoredBoardFile } from "@/lib/supabase/board-files";

/** Buttons in a reader's toolbar: flat, with a soft hover, like Zotero's reader toolbar. */
export const readerToolButton =
  "flex h-6 min-w-6 items-center justify-center rounded px-1 text-(--zt-text) transition-colors hover:bg-(--zt-hover) disabled:pointer-events-none disabled:opacity-35";

/** A small outlined field in a toolbar (page number, chapter picker). */
export const readerField =
  "h-6 rounded border border-(--zt-field-border) bg-(--zt-field) px-1 text-(--zt-text) outline-(--zt-select) disabled:opacity-40";

type ReaderShellProps = {
  file: StoredBoardFile;
  /** The controls row: page and zoom, chapter picker… Omitted for viewers with none. */
  toolbar?: ReactNode;
  children: ReactNode;
};

/**
 * What every viewer shares: an optional toolbar row over its content. The
 * file's name and the close button are on its tab (ReaderPane), as in
 * Zotero, not repeated here.
 */
export default function ReaderShell({ file, toolbar, children }: ReaderShellProps) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col" data-reader-format={file.format}>
      {toolbar && (
        <div className="flex h-9 shrink-0 items-center gap-1 border-b border-(--zt-border) bg-(--zt-chrome) px-2 text-[12px] text-(--zt-dim)">
          {toolbar}
        </div>
      )}
      {children}
    </div>
  );
}
