"use client";

import { useMemo, useRef, useState, type DragEventHandler } from "react";
import { ACCEPTED_FILES, formatFileSize, MAX_FILES_PER_BOARD } from "@/lib/files/file-helpers";
import { MORE_TYPES_MIGRATION, type FileEntry, type FilesStatus } from "@/hooks/useBoardFiles";
import type { BoardFile, FilesSchema } from "@/lib/supabase/board-files";
import { FORMAT_META } from "./format-meta";
import {
  ChevronIcon,
  CloseIcon,
  ExternalIcon,
  FilesIcon,
  LinkIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SortArrowIcon,
  SpinnerIcon,
  TrashIcon,
} from "./icons";

type DropHandlers = {
  onDragOver: DragEventHandler;
  onDragEnter: DragEventHandler;
  onDragLeave: DragEventHandler;
  onDrop: DragEventHandler;
};

type AddLinkResult = { ok: true } | { ok: false; message: string };

type FilesSidebarProps = {
  status: FilesStatus;
  /** `legacy` until the second migration is applied: PDFs only, no links. */
  schema: FilesSchema;
  files: FileEntry[];
  /** The highlighted item (usually the tab in front; a link is selected without a tab). */
  selectedId: string | null;
  /**
   * `null` until the saved preference has been read (the server can't know
   * it, or the window width). Both versions are then in the page and CSS
   * alone picks one — the rail below `lg`, the full list from `lg` — so the
   * first paint never shows the wrong one and then jumps.
   */
  collapsed: boolean | null;
  /** True while a file is being dragged over the panel. */
  dropActive: boolean;
  dropHandlers: DropHandlers;
  notice: string | null;
  onToggleCollapsed: () => void;
  /** Open a stored file in a tab (and select it). */
  onOpen: (fileId: string) => void;
  onSelect: (fileId: string) => void;
  onAdd: (files: File[]) => void;
  onAddLink: (address: string) => Promise<AddLinkResult>;
  onRename: (fileId: string, name: string) => void;
  onRemove: (file: BoardFile) => void;
  onRetry: () => void;
  onDismissNotice: () => void;
};

// A toolbar button: flat, square, a soft grey on hover — Zotero's toolbar icons.
const toolButton =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded text-(--zt-text) transition-colors hover:bg-(--zt-hover) disabled:pointer-events-none disabled:opacity-35 aria-expanded:bg-(--zt-hover)";

// A plain outlined button, for in-pane actions ("Check again", "Try again").
const outlineButton =
  "rounded border border-(--zt-field-border) bg-(--zt-field) px-3 py-1 text-(--zt-text) hover:bg-(--zt-hover)";

const panel = "zt flex h-full shrink-0 flex-col border-r border-(--zt-border) bg-(--zt-list)";

type SortKey = "name" | "added";
type Sort = { key: SortKey; dir: "asc" | "desc" };

function sortFiles(files: FileEntry[], { key, dir }: Sort): FileEntry[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...files].sort((a, b) =>
    key === "name"
      ? sign * a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
      : sign * (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0),
  );
}

/** "28 Oct", or "28 Oct 25" for an earlier year — short enough for a narrow column. */
function formatAdded(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "2-digit" });
}

/**
 * The board's files, laid out like Zotero 7's items pane: a grey toolbar
 * (collapse, add files, add link, search), a column header you can sort by,
 * a white list with faint stripes and a blue selection bar, an Info section
 * for the selected item, and a status line. Collapses to a slim rail so the
 * board can have the whole width back.
 */
export default function FilesSidebar({
  status,
  schema,
  files,
  selectedId,
  collapsed,
  dropActive,
  dropHandlers,
  notice,
  onToggleCollapsed,
  onOpen,
  onSelect,
  onAdd,
  onAddLink,
  onRename,
  onRemove,
  onRetry,
  onDismissNotice,
}: FilesSidebarProps) {
  const [linkFormOpen, setLinkFormOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "added", dir: "asc" });
  const [infoOpen, setInfoOpen] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const isFull = files.length >= MAX_FILES_PER_BOARD;
  const canAdd = status === "ready" && !isFull;
  const totalBytes = files.reduce((sum, file) => sum + file.sizeBytes, 0);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matching = needle
      ? files.filter((file) => file.name.toLowerCase().includes(needle) || (file.url ?? "").toLowerCase().includes(needle))
      : files;
    return sortFiles(matching, sort);
  }, [files, query, sort]);
  const selected = files.find((file) => file.id === selectedId) ?? null;

  const openPicker = () => inputRef.current?.click();
  const hiddenInput = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPTED_FILES}
      multiple
      hidden
      aria-label="Choose files to add"
      onChange={(event) => {
        const picked = Array.from(event.target.files ?? []);
        // Reset so choosing the same file again still fires `change`.
        event.target.value = "";
        if (picked.length > 0) onAdd(picked);
      }}
    />
  );

  const undecided = collapsed === null;

  const rail = (
    <aside
      aria-label="Board files"
      {...dropHandlers}
      className={`${panel} w-11 items-center gap-1 bg-(--zt-chrome) py-1.5 ${undecided ? "lg:hidden" : ""} ${dropActive ? "ring-2 ring-inset ring-(--zt-select)" : ""}`}
    >
      {/* Only one file input exists at a time: while undecided, the full
          sidebar's is the one in the page. */}
      {!undecided && hiddenInput}
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label={`Show files (${files.length} of ${MAX_FILES_PER_BOARD})`}
        title="Show files"
        className={`${toolButton} relative`}
      >
        <FilesIcon />
        {files.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-(--zt-select) px-1 text-[9px] font-semibold leading-none text-white">
            {files.length}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={openPicker}
        disabled={!canAdd}
        aria-label="Add files"
        title={isFull ? `${MAX_FILES_PER_BOARD} of ${MAX_FILES_PER_BOARD} items — remove one first` : "Add files"}
        className={toolButton}
      >
        <PlusIcon />
      </button>
      <button
        type="button"
        onClick={() => {
          setLinkFormOpen(true);
          onToggleCollapsed();
        }}
        disabled={!canAdd}
        aria-label="Add a web link"
        title="Add a web link"
        className={toolButton}
      >
        <LinkIcon />
      </button>
    </aside>
  );
  if (collapsed === true) return rail;

  const full = (
    <>
      {/* Below `lg` there isn't room to push the reader and board aside, so
          the open sidebar floats over them instead; this keeps the rail's
          width free so they don't jump when it opens and closes. */}
      <div className={`w-11 shrink-0 lg:hidden ${undecided ? "hidden" : ""}`} aria-hidden />
      {/* Click anywhere outside a floating sidebar to put it away. */}
      {!undecided && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close files"
          onClick={onToggleCollapsed}
          className="fixed inset-0 z-20 cursor-default lg:hidden"
        />
      )}
      <aside
        aria-label="Board files"
        {...dropHandlers}
        className={`${panel} w-72 max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-30 max-lg:shadow-2xl ${undecided ? "max-lg:hidden" : ""} ${dropActive ? "ring-2 ring-inset ring-(--zt-select)" : ""}`}
      >
        {hiddenInput}
        <h2 className="sr-only">Files</h2>

        <div className="flex h-9 shrink-0 items-center gap-0.5 border-b border-(--zt-border) bg-(--zt-chrome) px-1.5">
          <button type="button" onClick={onToggleCollapsed} aria-label="Hide files" title="Hide files" className={toolButton}>
            <ChevronIcon direction="left" />
          </button>
          <button
            type="button"
            onClick={openPicker}
            disabled={!canAdd}
            aria-label="Add files"
            title={isFull ? `${MAX_FILES_PER_BOARD} of ${MAX_FILES_PER_BOARD} items — remove one first` : "Add files"}
            className={toolButton}
          >
            <PlusIcon />
          </button>
          <button
            type="button"
            onClick={() => setLinkFormOpen((open) => !open)}
            disabled={!canAdd && !linkFormOpen}
            aria-label="Add a web link"
            aria-expanded={linkFormOpen}
            title="Add a web link"
            className={toolButton}
          >
            <LinkIcon />
          </button>
          <div className="relative ml-1 min-w-0 flex-1">
            <SearchIcon className="pointer-events-none absolute left-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--zt-dim)" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Escape" && setQuery("")}
              placeholder="Search"
              aria-label="Search files"
              autoComplete="off"
              spellCheck={false}
              className="h-6 w-full rounded-md border border-(--zt-field-border) bg-(--zt-field) pl-6 pr-6 text-[12px] text-(--zt-text) outline-(--zt-select) placeholder:text-(--zt-dim) [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear the search"
                className="absolute right-1 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full text-(--zt-dim) hover:bg-(--zt-hover) hover:text-(--zt-text)"
              >
                <CloseIcon className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {linkFormOpen && status === "ready" && <LinkForm onSubmit={onAddLink} onClose={() => setLinkFormOpen(false)} />}

        {status === "ready" && files.length > 0 && (
          <div className="flex h-6 shrink-0 items-stretch border-b border-(--zt-border) bg-(--zt-chrome) text-[11px] text-(--zt-dim)">
            <ColumnHeader label="Title" active={sort.key === "name"} dir={sort.dir} onClick={() => setSort((s) => toggleSort(s, "name"))} className="flex-1 pl-8" />
            <ColumnHeader label="Added" active={sort.key === "added"} dir={sort.dir} onClick={() => setSort((s) => toggleSort(s, "added"))} className="w-16 justify-end border-l border-(--zt-border) pr-2" />
          </div>
        )}

        <div className="zt-scroll min-h-0 flex-1 overflow-y-auto">
          {status === "loading" && (
            <p className="flex items-center gap-2 px-3 py-4 text-(--zt-dim)">
              <SpinnerIcon className="h-3.5 w-3.5" /> Loading files…
            </p>
          )}

          {status === "error" && (
            <div className="flex flex-col items-start gap-2 px-3 py-4 text-(--zt-dim)">
              <p>Couldn’t load the files.</p>
              <button type="button" onClick={onRetry} className={outlineButton}>
                Try again
              </button>
            </div>
          )}

          {status === "not-set-up" && (
            <div className="flex flex-col items-start gap-2 px-3 py-4 text-[12px] leading-relaxed text-(--zt-dim)">
              <p className="text-[13px] font-semibold text-(--zt-text)">File storage isn’t set up yet</p>
              <p>
                This database is missing the <code className="font-mono">board_files</code> table or the{" "}
                <code className="font-mono">board-files</code> bucket. Apply the migration{" "}
                <code className="break-all font-mono">20261028120000_board_files.sql</code> (and then{" "}
                <code className="break-all font-mono">{MORE_TYPES_MIGRATION}</code>), then check again. Your board and
                notes are not affected.
              </p>
              <button type="button" onClick={onRetry} className={outlineButton}>
                Check again
              </button>
            </div>
          )}

          {status === "ready" && files.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 px-5 py-10 text-center text-(--zt-dim)">
              <FilesIcon className="h-7 w-7 opacity-60" />
              <p className="text-[13px] font-medium text-(--zt-text)">Keep up to {MAX_FILES_PER_BOARD} important files here</p>
              <p className="text-[12px] leading-relaxed">
                {schema === "legacy"
                  ? "Drop a PDF anywhere on this panel."
                  : "PDFs, images, text, Word, PowerPoint, EPUB — drop them anywhere on this panel, or add a web link."}
              </p>
              <button type="button" onClick={openPicker} className={`${outlineButton} mt-1`}>
                Choose files…
              </button>
            </div>
          )}

          {status === "ready" && files.length > 0 && visible.length === 0 && (
            <p className="px-3 py-4 text-center text-(--zt-dim)">No items match “{query.trim()}”.</p>
          )}

          {status === "ready" && visible.length > 0 && (
            <ul
              aria-label="Files and links"
              onKeyDown={(event) => {
                if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                const rows = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-row-main]:not(:disabled)")];
                const at = rows.indexOf(document.activeElement as HTMLButtonElement);
                if (at < 0) return;
                event.preventDefault();
                rows[Math.max(0, Math.min(rows.length - 1, at + (event.key === "ArrowDown" ? 1 : -1)))]?.focus();
              }}
            >
              {visible.map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                  selected={file.id === selectedId}
                  onOpen={() => onOpen(file.id)}
                  onSelect={() => onSelect(file.id)}
                  onRename={(name) => onRename(file.id, name)}
                  onRemove={() => onRemove(file)}
                />
              ))}
            </ul>
          )}
        </div>

        {status === "ready" && files.length > 0 && <InfoSection file={selected} open={infoOpen} onToggle={() => setInfoOpen((open) => !open)} />}

        {status === "ready" && schema === "legacy" && (
          <div className="shrink-0 border-t border-(--zt-border) px-3 py-2 text-[11px] leading-snug text-(--zt-dim)">
            <p>
              Only PDFs for now. Apply <code className="break-all font-mono">{MORE_TYPES_MIGRATION}</code> to add
              images, text, Word, PowerPoint, EPUB and web links.
            </p>
            <button type="button" onClick={onRetry} className="mt-1 font-medium underline underline-offset-2 hover:no-underline">
              Check again
            </button>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="zt-banner shrink-0 items-start rounded-none border-x-0 border-b-0 text-[12px]"
          >
            <p className="min-w-0 flex-1 [overflow-wrap:anywhere]">{notice}</p>
            <button type="button" onClick={onDismissNotice} aria-label="Dismiss" className="shrink-0 opacity-70 hover:opacity-100">
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {status === "ready" && (
          <footer className="flex h-6 shrink-0 items-center gap-1 border-t border-(--zt-border) bg-(--zt-chrome) px-2.5 text-[11px] text-(--zt-dim)">
            <span aria-label={`${files.length} of ${MAX_FILES_PER_BOARD} items`} className={isFull ? "font-medium text-(--zt-warn-text)" : ""}>
              {files.length} of {MAX_FILES_PER_BOARD} items
            </span>
            {isFull ? (
              <span>· full — remove one to add another</span>
            ) : (
              totalBytes > 0 && <span>· {formatFileSize(totalBytes)}</span>
            )}
          </footer>
        )}
      </aside>
    </>
  );
  if (collapsed === false) return full;

  return (
    <>
      {rail}
      {full}
    </>
  );
}

/** Clicking the active column flips its direction; another column starts ascending. */
function toggleSort(current: Sort, key: SortKey): Sort {
  return current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" };
}

function ColumnHeader({
  label,
  active,
  dir,
  onClick,
  className = "",
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Sort by ${label}`}
      title={`Sort by ${label}`}
      className={`flex items-center gap-1 text-left outline-offset-[-2px] hover:bg-(--zt-hover) focus-visible:outline-2 focus-visible:outline-(--zt-select) ${className}`}
    >
      <span className={active ? "font-semibold text-(--zt-text)" : ""}>{label}</span>
      {active && <SortArrowIcon direction={dir} />}
    </button>
  );
}

type FileRowProps = {
  file: FileEntry;
  selected: boolean;
  onOpen: () => void;
  onSelect: () => void;
  onRename: (name: string) => void;
  onRemove: () => void;
};

function FileRow({ file, selected, onOpen, onSelect, onRename, onRemove }: FileRowProps) {
  const [mode, setMode] = useState<"view" | "rename" | "confirm-remove">("view");
  const busy = file.state !== "ready";
  const { Icon, tone: iconTone, label } = FORMAT_META[file.format];
  const isLink = file.kind === "link";

  // Alternating rows like Zotero's list; the selected one is the blue bar.
  const rowTone = selected ? "bg-(--zt-select) text-(--zt-select-text)" : "odd:bg-(--zt-list) even:bg-(--zt-stripe) text-(--zt-text)";
  const actionButton = "flex h-5 w-5 items-center justify-center rounded hover:bg-black/15 dark:hover:bg-white/20";

  if (mode === "rename") {
    return (
      <li className={`flex h-7 items-center gap-1.5 px-2 ${rowTone}`}>
        <Icon className="h-4 w-4 shrink-0" />
        <input
          autoFocus
          aria-label={`Rename ${file.name}`}
          defaultValue={file.name}
          maxLength={200}
          onFocus={(event) => event.currentTarget.select()}
          onBlur={(event) => {
            onRename(event.currentTarget.value);
            setMode("view");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              // Skip the blur-commit: Escape means "never mind".
              event.currentTarget.value = file.name;
              event.currentTarget.blur();
            }
          }}
          className="h-5 min-w-0 flex-1 rounded border border-(--zt-field-border) bg-(--zt-field) px-1.5 text-[13px] text-(--zt-text) outline-2 outline-(--zt-select)"
        />
      </li>
    );
  }

  if (mode === "confirm-remove") {
    return (
      <li className="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1 bg-[color-mix(in_srgb,#dc2626_14%,var(--zt-list))] px-2 py-1 text-[12px] text-(--zt-text)">
        <span className="min-w-0 flex-1 truncate">Remove “{file.name}”?</span>
        <button
          type="button"
          autoFocus
          onClick={() => {
            setMode("view");
            onRemove();
          }}
          className="rounded bg-red-600 px-2 py-0.5 font-medium text-white hover:bg-red-700"
        >
          Remove
        </button>
        <button type="button" onClick={() => setMode("view")} className="rounded px-2 py-0.5 font-medium hover:bg-(--zt-hover)">
          Keep
        </button>
      </li>
    );
  }

  return (
    <li className={`group relative flex h-7 items-center ${rowTone} ${file.state === "removing" ? "opacity-50" : ""}`}>
      <button
        type="button"
        data-row-main
        onClick={() => {
          // A link has no reader: it's selected (its address shows under
          // Info) and opens where links open, in a new tab with no access
          // back to this one.
          if (isLink && file.url) {
            onSelect();
            window.open(file.url, "_blank", "noopener,noreferrer");
          } else onOpen();
        }}
        onDoubleClick={() => !busy && setMode("rename")}
        disabled={file.state === "uploading"}
        aria-current={selected ? "true" : undefined}
        aria-label={isLink ? `${file.name} (web link, opens in a new tab)` : undefined}
        title={isLink ? `${file.name} · ${file.url}` : `${file.name} · ${label} · ${formatFileSize(file.sizeBytes)}`}
        className={`flex h-full min-w-0 flex-1 items-center gap-1.5 pl-2 pr-1 text-left outline-offset-[-2px] focus-visible:outline-2 disabled:cursor-default ${selected ? "focus-visible:outline-white" : "focus-visible:outline-(--zt-select)"}`}
      >
        {file.state === "uploading" ? (
          <SpinnerIcon className="h-4 w-4 shrink-0" />
        ) : (
          <Icon className={`h-4 w-4 shrink-0 ${selected ? "" : iconTone}`} />
        )}
        <span className="min-w-0 flex-1 truncate">{file.name}</span>
        {isLink && <ExternalIcon className="h-3 w-3 shrink-0 opacity-50" />}
      </button>
      <span className={`w-16 shrink-0 pr-2 text-right text-[11px] ${selected ? "text-white/80" : "text-(--zt-dim)"} ${busy ? "" : "group-has-[:focus-visible]:invisible group-hover:invisible"}`}>
        {file.state === "uploading" ? "Uploading…" : file.state === "removing" ? "Removing…" : formatAdded(file.createdAt)}
      </span>
      {!busy && (
        // Present in the page (so a screen reader finds them) but transparent
        // and click-through until the row is hovered or focused, so an unseen
        // button can't catch a stray click on the date.
        <span className="pointer-events-none absolute inset-y-0 right-1 flex items-center gap-0.5 opacity-0 group-has-[:focus-visible]:pointer-events-auto group-has-[:focus-visible]:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
          <button type="button" onClick={() => setMode("rename")} aria-label={`Rename ${file.name}`} title="Rename" className={actionButton}>
            <PencilIcon className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => setMode("confirm-remove")} aria-label={`Remove ${file.name}`} title="Remove" className={actionButton}>
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        </span>
      )}
    </li>
  );
}

/** Zotero's "Info" section: field names on the left, values on the right, for the selected item. */
function InfoSection({ file, open, onToggle }: { file: FileEntry | null; open: boolean; onToggle: () => void }) {
  const fields: { label: string; value: React.ReactNode }[] = [];
  if (file) {
    const { label } = FORMAT_META[file.format];
    fields.push({ label: "Title", value: file.name }, { label: "Item Type", value: label });
    if (file.kind === "link" && file.url) {
      fields.push({
        label: "URL",
        value: (
          <a href={file.url} target="_blank" rel="noopener noreferrer" className="zt-link">
            {file.url}
          </a>
        ),
      });
    } else {
      fields.push({ label: "File Size", value: formatFileSize(file.sizeBytes) });
    }
    const added = new Date(file.createdAt);
    if (!Number.isNaN(added.getTime())) fields.push({ label: "Added", value: added.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) });
  }

  return (
    <section aria-label="Item info" className="shrink-0 border-t border-(--zt-border)">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex h-7 w-full items-center gap-1 bg-(--zt-chrome) px-2 text-left text-[12px] font-semibold text-(--zt-text) hover:bg-(--zt-hover)"
      >
        <ChevronIcon direction={open ? "down" : "right"} className="h-3 w-3" />
        Info
      </button>
      {open &&
        (file ? (
          <dl className="grid max-h-44 grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 overflow-y-auto bg-(--zt-list) px-3 py-2 text-[12px]">
            {fields.map(({ label, value }) => (
              <div key={label} className="contents">
                <dt className="text-right text-(--zt-dim)">{label}</dt>
                <dd className="min-w-0 [overflow-wrap:anywhere]">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="bg-(--zt-list) px-3 py-3 text-[12px] text-(--zt-dim)">Select an item to see its details.</p>
        ))}
    </section>
  );
}

/** The inline form under the toolbar for saving a web link. */
function LinkForm({ onSubmit, onClose }: { onSubmit: (address: string) => Promise<AddLinkResult>; onClose: () => void }) {
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!address.trim() || saving) return;
    setSaving(true);
    const result = await onSubmit(address);
    setSaving(false);
    if (result.ok) onClose();
    else setError(result.message);
  }

  return (
    <form onSubmit={submit} className="shrink-0 border-b border-(--zt-border) bg-(--zt-chrome) px-2 pb-2 pt-1.5">
      <label className="block text-[11px] font-medium text-(--zt-dim)" htmlFor="board-link-address">
        Web address
      </label>
      <div className="mt-1 flex gap-1">
        <input
          id="board-link-address"
          autoFocus
          value={address}
          onChange={(event) => {
            setAddress(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => event.key === "Escape" && onClose()}
          placeholder="https://…"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error !== null}
          aria-describedby={error ? "board-link-error" : undefined}
          className="h-6 min-w-0 flex-1 rounded border border-(--zt-field-border) bg-(--zt-field) px-2 text-[12px] text-(--zt-text) outline-(--zt-select)"
        />
        <button
          type="submit"
          disabled={!address.trim() || saving}
          className="h-6 rounded bg-(--zt-select) px-2.5 text-[12px] font-medium text-white hover:brightness-110 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Add"}
        </button>
      </div>
      {error && (
        <p id="board-link-error" role="alert" className="mt-1 text-[11px] text-(--zt-danger)">
          {error}
        </p>
      )}
    </form>
  );
}
