"use client";

import { useCallback, useEffect, useState } from "react";
import { useBoardFiles } from "@/hooks/useBoardFiles";
import { isStoredFile, type BoardFile } from "@/lib/supabase/board-files";
import FilesSidebar from "./FilesSidebar";
import ReaderPane from "./ReaderPane";
import ResizeHandle from "./ResizeHandle";

type FilesPanelProps = {
  boardId: string;
  /** Told whenever the reader appears or goes away — the board docks its note editor beside it. */
  onReaderOpenChange: (open: boolean) => void;
};

const COLLAPSED_KEY = "notemap:files-collapsed";
const READER_WIDTH_KEY = "notemap:reader-width";
const SIDEBAR_WIDTH = 288;
const RAIL_WIDTH = 44;
const MIN_READER_WIDTH = 280;
/** The board always keeps at least this much room beside the reader. */
const MIN_BOARD_WIDTH = 360;
/** The draggable divider between reader and board (`w-1.5` in ResizeHandle). */
const DIVIDER_WIDTH = 6;
/**
 * Matches Tailwind's `lg` breakpoint. From here the open sidebar pushes the
 * reader and board aside; below it, it floats over them (FilesSidebar), since
 * 288 + 280 + 360 px of sidebar, reader and board doesn't fit.
 */
const SIDEBAR_PUSHES_QUERY = "(min-width: 1024px)";
const SIDEBAR_PUSHES_FROM = 1024;

// Per-viewer conveniences only — a blocked or cleared store must never
// break the page, so every access is guarded.
function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not saved this time; the panel still works.
  }
}

/**
 * Everything to the left of the board: the files sidebar and, when a file
 * is open, the reader (a tab strip over the open files) with a draggable
 * divider. Owns the files' data (`useBoardFiles`), which files are open in
 * tabs, which item is selected, and the panel layout preferences. The board
 * is only told whether a reader is showing.
 */
export default function FilesPanel({ boardId, onReaderOpenChange }: FilesPanelProps) {
  const { status, schema, files, notice, add, addLink, rename, remove, getUrl, retry, dismissNotice } = useBoardFiles(boardId);
  // `null` until the saved preference is read; see FilesSidebar.
  const [collapsed, setCollapsed] = useState<boolean | null>(null);
  const [readerWidth, setReaderWidth] = useState(480);
  const [viewportWidth, setViewportWidth] = useState(1280);
  const [dropActive, setDropActive] = useState(false);
  // Open files, in tab order; the tab in front; and the item highlighted in
  // the list (usually the tab in front, but a link is selected without a tab).
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Restore preferences after mount (reading storage during the first
  // render would differ from the server's HTML). The saved open/closed
  // choice is a wide-screen preference: on a narrower window the sidebar
  // starts as the slim rail whatever was saved — an open one would float
  // over the content.
  useEffect(() => {
    const storedCollapsed = readStored(COLLAPSED_KEY);
    const storedWidth = Number(readStored(READER_WIDTH_KEY));
    /* eslint-disable react-hooks/set-state-in-effect */
    setCollapsed(window.matchMedia(SIDEBAR_PUSHES_QUERY).matches ? storedCollapsed === "true" : true);
    setReaderWidth(storedWidth > 0 ? storedWidth : Math.round(window.innerWidth * 0.42));
    setViewportWidth(window.innerWidth);
    /* eslint-enable react-hooks/set-state-in-effect */
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const sidebarPushes = viewportWidth >= SIDEBAR_PUSHES_FROM;
  // A floating sidebar leaves just the rail's width in the layout.
  const sidebarWidth = collapsed === true || !sidebarPushes ? RAIL_WIDTH : SIDEBAR_WIDTH;
  const maxReaderWidth = Math.max(MIN_READER_WIDTH, viewportWidth - sidebarWidth - DIVIDER_WIDTH - MIN_BOARD_WIDTH);
  const effectiveReaderWidth = Math.min(maxReaderWidth, Math.max(MIN_READER_WIDTH, readerWidth));
  const openFiles = openIds
    .map((id) => files.find((file) => file.id === id))
    .filter((file): file is NonNullable<typeof file> & { storagePath: string } => Boolean(file && file.state === "ready" && isStoredFile(file)));
  const activeFile = openFiles.find((file) => file.id === activeId) ?? openFiles[openFiles.length - 1] ?? null;

  useEffect(() => {
    onReaderOpenChange(openFiles.length > 0);
  }, [openFiles.length, onReaderOpenChange]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !(current ?? !sidebarPushes);
      if (sidebarPushes) writeStored(COLLAPSED_KEY, String(next));
      return next;
    });
  }, [sidebarPushes]);

  const changeReaderWidth = useCallback((width: number) => {
    setReaderWidth(width);
    writeStored(READER_WIDTH_KEY, String(Math.round(width)));
  }, []);

  // Opening a file puts it in a tab (once) and brings that tab to the front.
  // From a floating sidebar it also closes the list, so the file it opened
  // is what you see rather than the list that opened it.
  const openFromList = useCallback(
    (fileId: string) => {
      setOpenIds((current) => (current.includes(fileId) ? current : [...current, fileId]));
      setActiveId(fileId);
      setSelectedId(fileId);
      if (!sidebarPushes) setCollapsed(true);
    },
    [sidebarPushes],
  );

  const closeTab = useCallback(
    (fileId: string) => {
      setOpenIds((current) => {
        const next = current.filter((id) => id !== fileId);
        // Closing the front tab brings its neighbour forward.
        if (fileId === activeId) setActiveId(next[Math.min(current.indexOf(fileId), next.length - 1)] ?? null);
        return next;
      });
    },
    [activeId],
  );

  const activateTab = useCallback((fileId: string) => {
    setActiveId(fileId);
    setSelectedId(fileId);
  }, []);

  const handleAdd = useCallback(
    async (picked: File[]) => {
      const added = await add(picked);
      // Adding is almost always "I want to read this now".
      const first = added.find(isStoredFile);
      if (first) openFromList(first.id);
    },
    [add, openFromList],
  );

  const handleRemove = useCallback(
    (file: BoardFile) => {
      closeTab(file.id);
      setSelectedId((current) => (current === file.id ? null : current));
      void remove(file);
    },
    [closeTab, remove],
  );

  // Dropping files anywhere on the sidebar or the reader adds them. Every
  // file drag is claimed (not just PDFs) so a stray drop can never make
  // the browser navigate away from the board to open the file.
  const isFileDrag = (event: React.DragEvent) => event.dataTransfer.types.includes("Files");
  const dropHandlers = {
    onDragOver: (event: React.DragEvent) => {
      if (isFileDrag(event)) event.preventDefault();
    },
    onDragEnter: (event: React.DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      setDropActive(true);
    },
    onDragLeave: (event: React.DragEvent) => {
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
      setDropActive(false);
    },
    onDrop: (event: React.DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      setDropActive(false);
      const dropped = Array.from(event.dataTransfer.files);
      if (dropped.length > 0) void handleAdd(dropped);
    },
  };

  return (
    <>
      <FilesSidebar
        status={status}
        schema={schema}
        files={files}
        selectedId={selectedId}
        collapsed={collapsed}
        dropActive={dropActive}
        dropHandlers={dropHandlers}
        notice={notice}
        onToggleCollapsed={toggleCollapsed}
        onOpen={openFromList}
        onSelect={setSelectedId}
        onAdd={handleAdd}
        onAddLink={addLink}
        onRename={rename}
        onRemove={handleRemove}
        onRetry={retry}
        onDismissNotice={dismissNotice}
      />
      {activeFile && (
        <>
          <div className="contents" {...dropHandlers}>
            <ReaderPane
              files={openFiles}
              activeId={activeFile.id}
              width={effectiveReaderWidth}
              getUrl={getUrl}
              onActivate={activateTab}
              onCloseTab={closeTab}
            />
          </div>
          <ResizeHandle
            value={effectiveReaderWidth}
            min={MIN_READER_WIDTH}
            max={maxReaderWidth}
            onChange={changeReaderWidth}
            label="Resize the reader"
          />
        </>
      )}
    </>
  );
}
