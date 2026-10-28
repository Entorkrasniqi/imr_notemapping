"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { describeRejection, identifyFile, MAX_FILES_PER_BOARD, titleFromFileName } from "@/lib/files/file-helpers";
import { createClient } from "@/lib/supabase/client";
import { ensureSession } from "@/lib/supabase/board-sync";
import {
  addBoardFile,
  addBoardLink,
  createBoardFileUrl,
  FileLimitError,
  FileRejectedError,
  FilesNotSetUpError,
  FileTypeNotEnabledError,
  InvalidLinkError,
  listBoardFiles,
  removeBoardFile,
  renameBoardFile,
  type BoardFile,
  type FilesSchema,
} from "@/lib/supabase/board-files";

/** Where to send someone whose database predates the second migration. */
export const MORE_TYPES_MIGRATION = "20261028150000_board_files_more_types.sql";
const NEEDS_MIGRATION = `Apply the migration ${MORE_TYPES_MIGRATION} to add this kind of item.`;

/** An item as the sidebar shows it: the stored row, plus what's happening to it right now. */
export type FileEntry = BoardFile & { state: "ready" | "uploading" | "removing" };

/**
 * `not-set-up` is its own state, not a flavour of `error`: it means the
 * database is missing the table or bucket, which no amount of retrying
 * fixes, so the sidebar explains it instead of offering "Try again".
 */
export type FilesStatus = "loading" | "ready" | "not-set-up" | "error";

/**
 * The board's files: load once, then add / rename / remove with the
 * sidebar's state kept in step. Separate from the board's own sync hook on
 * purpose — files are not part of the note/edge snapshot, and a board must
 * keep working when this fails (or the migration isn't applied yet).
 */
export function useBoardFiles(boardId: string) {
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<FilesStatus>("loading");
  const [files, setFiles] = useState<FileEntry[]>([]);
  // `legacy` until the second migration is applied: PDFs only, no links.
  const [schema, setSchema] = useState<FilesSchema>("current");
  const [notice, setNotice] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus("loading");
      try {
        await ensureSession(supabase);
        const loaded = await listBoardFiles(supabase, boardId);
        if (cancelled) return;
        setFiles(loaded.files.map((file) => ({ ...file, state: "ready" })));
        setSchema(loaded.schema);
        setStatus("ready");
      } catch (error) {
        if (cancelled) return;
        if (error instanceof FilesNotSetUpError) {
          setStatus("not-set-up");
          return;
        }
        console.error("Failed to load the board's files:", error);
        setStatus("error");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, boardId, retryToken]);

  const retry = useCallback(() => setRetryToken((token) => token + 1), []);
  const dismissNotice = useCallback(() => setNotice(null), []);

  /**
   * Adds files one after another (a row appears the moment its upload
   * starts). Resolves to the files that made it, so the caller can open the
   * first one; whatever didn't is explained in one notice.
   */
  const add = useCallback(
    async (picked: File[]): Promise<BoardFile[]> => {
      const added: BoardFile[] = [];
      const problems: string[] = [];
      let used = files.length;

      for (const file of picked) {
        if (used >= MAX_FILES_PER_BOARD) {
          problems.push(`A board holds ${MAX_FILES_PER_BOARD} files — “${file.name}” wasn’t added.`);
          continue;
        }
        const identified = await identifyFile(file);
        if (!identified.ok) {
          problems.push(describeRejection(identified.reason, file.name));
          continue;
        }
        // Without the second migration the database only takes PDFs; say so
        // up front instead of letting a row appear and vanish.
        if (schema === "legacy" && identified.format !== "pdf") {
          problems.push(`“${file.name}”: ${NEEDS_MIGRATION}`);
          continue;
        }

        const id = crypto.randomUUID();
        used++;
        setFiles((current) => [
          ...current,
          {
            id,
            boardId,
            name: titleFromFileName(file.name),
            sizeBytes: file.size,
            kind: "file",
            format: identified.format,
            mimeType: identified.mime,
            url: null,
            storagePath: null,
            createdAt: new Date().toISOString(),
            state: "uploading",
          },
        ]);
        try {
          const created = await addBoardFile(supabase, boardId, file, id);
          setFiles((current) => current.map((entry) => (entry.id === id ? { ...created, state: "ready" } : entry)));
          added.push(created);
        } catch (error) {
          used--;
          setFiles((current) => current.filter((entry) => entry.id !== id));
          if (error instanceof FilesNotSetUpError) {
            setStatus("not-set-up");
            return added;
          }
          if (error instanceof FileRejectedError) problems.push(describeRejection(error.reason, file.name));
          else if (error instanceof FileTypeNotEnabledError) problems.push(`“${file.name}”: ${NEEDS_MIGRATION}`);
          else if (error instanceof FileLimitError) problems.push(`A board holds ${MAX_FILES_PER_BOARD} files — “${file.name}” wasn’t added.`);
          else {
            console.error("Failed to add a file:", error);
            problems.push(`Couldn’t upload “${file.name}”. Check your connection and try again.`);
          }
        }
      }

      if (problems.length > 0) setNotice(problems.join(" "));
      return added;
    },
    [supabase, boardId, files.length, schema],
  );

  /**
   * Saves a web link. Unlike `add`, the caller (the link form) wants to show
   * a problem next to its own input, so this resolves to the explanation
   * instead of raising a notice.
   */
  const addLink = useCallback(
    async (address: string, title?: string): Promise<{ ok: true; file: BoardFile } | { ok: false; message: string }> => {
      if (files.length >= MAX_FILES_PER_BOARD) {
        return { ok: false, message: `A board holds ${MAX_FILES_PER_BOARD} items — remove one to add a link.` };
      }
      if (schema === "legacy") return { ok: false, message: NEEDS_MIGRATION };
      try {
        const created = await addBoardLink(supabase, boardId, address, title);
        setFiles((current) => [...current, { ...created, state: "ready" }]);
        return { ok: true, file: created };
      } catch (error) {
        if (error instanceof InvalidLinkError) return { ok: false, message: "That doesn’t look like a web address (https://…)." };
        if (error instanceof FileTypeNotEnabledError) return { ok: false, message: NEEDS_MIGRATION };
        if (error instanceof FileLimitError) return { ok: false, message: `A board holds ${MAX_FILES_PER_BOARD} items.` };
        if (error instanceof FilesNotSetUpError) {
          setStatus("not-set-up");
          return { ok: false, message: "File storage isn’t set up yet." };
        }
        console.error("Failed to add a link:", error);
        return { ok: false, message: "Couldn’t save the link. Check your connection and try again." };
      }
    },
    [supabase, boardId, files.length, schema],
  );

  const rename = useCallback(
    async (fileId: string, name: string) => {
      const trimmed = name.trim().slice(0, 200);
      const previous = files.find((entry) => entry.id === fileId)?.name;
      if (!trimmed || trimmed === previous) return;

      setFiles((current) => current.map((entry) => (entry.id === fileId ? { ...entry, name: trimmed } : entry)));
      try {
        await renameBoardFile(supabase, fileId, trimmed);
      } catch (error) {
        console.error("Failed to rename a file:", error);
        setFiles((current) =>
          current.map((entry) => (entry.id === fileId && previous ? { ...entry, name: previous } : entry)),
        );
        setNotice("Couldn’t rename the file. Try again.");
      }
    },
    [supabase, files],
  );

  const remove = useCallback(
    async (file: BoardFile) => {
      setFiles((current) => current.map((entry) => (entry.id === file.id ? { ...entry, state: "removing" } : entry)));
      try {
        await removeBoardFile(supabase, file);
        setFiles((current) => current.filter((entry) => entry.id !== file.id));
      } catch (error) {
        console.error("Failed to remove a file:", error);
        setFiles((current) => current.map((entry) => (entry.id === file.id ? { ...entry, state: "ready" } : entry)));
        setNotice(`Couldn’t remove “${file.name}”. Try again.`);
      }
    },
    [supabase],
  );

  const getUrl = useCallback((storagePath: string) => createBoardFileUrl(supabase, storagePath), [supabase]);

  return { status, schema, files, notice, add, addLink, rename, remove, getUrl, retry, dismissNotice };
}
