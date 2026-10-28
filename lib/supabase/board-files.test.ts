import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  addBoardFile,
  addBoardLink,
  BOARD_FILES_BUCKET,
  createBoardFileUrl,
  FileLimitError,
  FileRejectedError,
  FilesNotSetUpError,
  FileTypeNotEnabledError,
  InvalidLinkError,
  listBoardFiles,
  removeBoardFile,
  removeStoredFilesForBoard,
  type BoardFile,
} from "./board-files";
import { deleteBoard } from "./boards";

type Failure = { code?: string; message?: string } | null;
type Failures = Partial<
  Record<"select" | "selectNewColumns" | "insert" | "delete" | "update" | "upload" | "remove" | "sign", Failure>
>;

const ROW = {
  id: "f1",
  board_id: "b1",
  name: "Paper",
  size_bytes: 9,
  kind: "file",
  mime_type: "application/pdf",
  url: null,
  storage_path: "b1/f1.pdf",
  created_at: "2026-10-28T10:00:00Z",
};

/** Records every call, in order, the way the two APIs would receive them. */
function recordingClient(failures: Failures = {}, rows: unknown[] = [ROW]) {
  const calls: string[] = [];
  const uploadedTypes: string[] = [];
  const returningColumns: string[] = [];
  const result = (key: keyof Failures, data: unknown) => {
    const error = failures[key] ?? null;
    return { data: error ? null : data, error };
  };
  const client = {
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: string) => {
          calls.push(`select ${table} where ${column}=${value}`);
          // The first migration's table has no `kind`; asking for it fails the way PostgREST would.
          const outcome = columns.includes("kind") && failures.selectNewColumns ? result("selectNewColumns", null) : result("select", rows);
          // `listBoardFiles` orders the result; `removeStoredFilesForBoard` awaits it directly.
          return Object.assign(Promise.resolve(outcome), {
            order: async (orderColumn: string) => {
              calls.push(`order by ${orderColumn}${columns.includes("kind") ? "" : " (legacy columns)"}`);
              return outcome;
            },
          });
        },
      }),
      insert: (row: Record<string, unknown>) => ({
        select: (columns: string) => ({
          single: async () => {
            returningColumns.push(columns);
            calls.push(`insert ${table} ${row.id} kind=${row.kind ?? "-"} name=${row.name} size=${row.size_bytes} mime=${row.mime_type} url=${row.url ?? "-"}`);
            const path = row.kind === "link" ? null : `${row.board_id}/${row.id}.${row.mime_type === "image/png" ? "png" : "pdf"}`;
            return result("insert", { ...ROW, ...row, storage_path: path });
          },
        }),
      }),
      update: (values: Record<string, unknown>) => ({
        eq: async (_column: string, id: string) => {
          calls.push(`update ${table} ${id} ${JSON.stringify(values)}`);
          return result("update", null);
        },
      }),
      delete: () => ({
        eq: async (column: string, value: string) => {
          calls.push(`delete ${table} where ${column}=${value}`);
          return result("delete", null);
        },
      }),
    }),
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, body: File, options: { contentType: string; upsert: boolean }) => {
          calls.push(`upload ${bucket}/${path} ${options.contentType} upsert=${options.upsert}`);
          uploadedTypes.push(body.type);
          return result("upload", { path });
        },
        remove: async (paths: string[]) => {
          calls.push(`remove ${bucket}/${paths.join(",")}`);
          return result("remove", []);
        },
        createSignedUrl: async (path: string, seconds: number) => {
          calls.push(`sign ${bucket}/${path} ${seconds}s`);
          return result("sign", { signedUrl: `https://files.test/${path}?token=t` });
        },
      }),
    },
  };
  return { client: client as unknown as SupabaseClient, calls, uploadedTypes, returningColumns };
}

const pdfFile = (name = "Paper.pdf") => new File(["%PDF-1.7"], name, { type: "application/pdf" });
const pngFile = (name = "Diagram.png") => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])], name);
const stored: BoardFile = {
  id: "f1",
  boardId: "b1",
  name: "Paper",
  sizeBytes: 9,
  kind: "file",
  format: "pdf",
  mimeType: "application/pdf",
  url: null,
  storagePath: "b1/f1.pdf",
  createdAt: "2026-10-28T10:00:00Z",
};

describe("listBoardFiles", () => {
  it("maps rows to files, oldest first", async () => {
    const { client, calls } = recordingClient();
    expect(await listBoardFiles(client, "b1")).toEqual({ files: [stored], schema: "current" });
    expect(calls).toEqual(["select board_files where board_id=b1", "order by created_at"]);
  });

  it("reads a link row as a link", async () => {
    const link = { ...ROW, id: "l1", kind: "link", mime_type: null, url: "https://example.com/", storage_path: null, size_bytes: 0 };
    const { files } = await listBoardFiles(recordingClient({}, [link]).client, "b1");
    expect(files[0]).toMatchObject({ kind: "link", format: "link", url: "https://example.com/", storagePath: null, mimeType: null });
  });

  it("falls back to the first migration's columns, reading every row as a PDF, until the second is applied", async () => {
    const legacyRow = { id: "f1", board_id: "b1", name: "Paper", size_bytes: 9, storage_path: "b1/f1.pdf", created_at: ROW.created_at };
    const { client, calls } = recordingClient({ selectNewColumns: { code: "42703", message: "column board_files.kind does not exist" } }, [legacyRow]);
    expect(await listBoardFiles(client, "b1")).toEqual({ files: [stored], schema: "legacy" });
    expect(calls.at(-1)).toBe("order by created_at (legacy columns)");
  });

  it.each([
    ["PostgREST's schema cache", { code: "PGRST205", message: "Could not find the table 'public.board_files'" }],
    ["Postgres", { code: "42P01", message: 'relation "board_files" does not exist' }],
  ])("reports a missing table (%s) as 'not set up', not as a failure to retry", async (_name, error) => {
    const { client } = recordingClient({ select: error });
    await expect(listBoardFiles(client, "b1")).rejects.toBeInstanceOf(FilesNotSetUpError);
  });

  it("lets any other failure through unchanged", async () => {
    const { client } = recordingClient({ select: { code: "500", message: "boom" } });
    await expect(listBoardFiles(client, "b1")).rejects.toMatchObject({ message: "boom" });
  });
});

describe("addBoardFile", () => {
  it("inserts the row first, then uploads to the path the database generated", async () => {
    const { client, calls } = recordingClient();
    const added = await addBoardFile(client, "b1", pdfFile(), "f9");
    expect(calls).toEqual([
      "insert board_files f9 kind=- name=Paper size=8 mime=application/pdf url=-",
      `upload ${BOARD_FILES_BUCKET}/b1/f9.pdf application/pdf upsert=false`,
    ]);
    expect(added).toMatchObject({ id: "f9", boardId: "b1", name: "Paper", storagePath: "b1/f9.pdf" });
  });

  it("only asks the insert to return columns the first migration already has, so adding works before the second is applied", async () => {
    const { client, returningColumns } = recordingClient();
    await addBoardFile(client, "b1", pdfFile(), "f9");
    expect(returningColumns[0]).not.toMatch(/\b(kind|url)\b/);
  });

  it("sends an image with its own type and gets an image back", async () => {
    const { client, calls } = recordingClient();
    const added = await addBoardFile(client, "b1", pngFile(), "i1");
    expect(calls[0]).toContain("name=Diagram size=9 mime=image/png");
    expect(calls[1]).toBe(`upload ${BOARD_FILES_BUCKET}/b1/i1.png image/png upsert=false`);
    expect(added).toMatchObject({ format: "image", mimeType: "image/png" });
  });

  it("uploads the file carrying the detected type even when the browser reported none (Storage checks it)", async () => {
    const { client, uploadedTypes } = recordingClient();
    const epubLike = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0])], "Book.epub"); // browsers often give "" for .epub
    expect(epubLike.type).toBe("");
    await addBoardFile(client, "b1", epubLike, "e1");
    expect(uploadedTypes).toEqual(["application/epub+zip"]);
  });

  it("sends nothing at all for a file that isn't supported", async () => {
    const { client, calls } = recordingClient();
    await expect(addBoardFile(client, "b1", new File(["MZ"], "run.exe"), "x")).rejects.toMatchObject({
      name: FileRejectedError.name,
      reason: "unsupported",
    });
    expect(calls).toEqual([]);
  });

  it("maps the database's ten-item limit to FileLimitError and never uploads", async () => {
    const { client, calls } = recordingClient({ insert: { code: "P0001" } });
    await expect(addBoardFile(client, "b1", pdfFile(), "f9")).rejects.toBeInstanceOf(FileLimitError);
    expect(calls.some((call) => call.startsWith("upload"))).toBe(false);
  });

  it("reports a missing table as 'not set up'", async () => {
    const { client } = recordingClient({ insert: { code: "PGRST205" } });
    await expect(addBoardFile(client, "b1", pdfFile(), "f9")).rejects.toBeInstanceOf(FilesNotSetUpError);
  });

  it("reports a type the database doesn't know yet (second migration missing) in plain terms", async () => {
    const { client } = recordingClient({ insert: { code: "23514", message: "board_files_mime_type" } });
    await expect(addBoardFile(client, "b1", pngFile(), "i1")).rejects.toBeInstanceOf(FileTypeNotEnabledError);
  });

  it("deletes the row again when the upload fails, so no unopenable item is left in the sidebar", async () => {
    const { client, calls } = recordingClient({ upload: { message: "network down" } });
    await expect(addBoardFile(client, "b1", pdfFile(), "f9")).rejects.toMatchObject({ message: "network down" });
    expect(calls.at(-1)).toBe("delete board_files where id=f9");
  });

  it("reports a missing bucket as 'not set up' (and still removes the row)", async () => {
    const { client, calls } = recordingClient({ upload: { message: "Bucket not found" } });
    await expect(addBoardFile(client, "b1", pdfFile(), "f9")).rejects.toBeInstanceOf(FilesNotSetUpError);
    expect(calls.at(-1)).toBe("delete board_files where id=f9");
  });

  it("reports a bucket that refuses the type (bucket not updated yet) and removes the row", async () => {
    const { client, calls } = recordingClient({ upload: { message: "mime type image/png is not supported" } });
    await expect(addBoardFile(client, "b1", pngFile(), "i1")).rejects.toBeInstanceOf(FileTypeNotEnabledError);
    expect(calls.at(-1)).toBe("delete board_files where id=i1");
  });
});

describe("addBoardLink", () => {
  it("saves a link as a row with no stored file, titled by its host", async () => {
    const { client, calls } = recordingClient();
    const added = await addBoardLink(client, "b1", "www.example.com/paper", undefined, "l1");
    expect(calls).toEqual(["insert board_files l1 kind=link name=example.com size=0 mime=null url=https://www.example.com/paper"]);
    expect(added).toMatchObject({ kind: "link", format: "link", url: "https://www.example.com/paper", storagePath: null });
  });

  it("uses a given title, trimmed", async () => {
    const { client, calls } = recordingClient();
    await addBoardLink(client, "b1", "https://example.com", "  My reading list ", "l1");
    expect(calls[0]).toContain("name=My reading list");
  });

  it("refuses an address that isn't http(s) without sending anything", async () => {
    const { client, calls } = recordingClient();
    await expect(addBoardLink(client, "b1", "javascript:alert(1)")).rejects.toBeInstanceOf(InvalidLinkError);
    expect(calls).toEqual([]);
  });

  it("explains a database that doesn't know links yet", async () => {
    const { client } = recordingClient({ insert: { code: "PGRST204", message: "Could not find the 'kind' column" } });
    await expect(addBoardLink(client, "b1", "https://example.com")).rejects.toBeInstanceOf(FileTypeNotEnabledError);
  });

  it("maps the ten-item limit too", async () => {
    const { client } = recordingClient({ insert: { code: "P0001" } });
    await expect(addBoardLink(client, "b1", "https://example.com")).rejects.toBeInstanceOf(FileLimitError);
  });
});

describe("removeBoardFile", () => {
  it("removes the stored bytes before the row", async () => {
    const { client, calls } = recordingClient();
    await removeBoardFile(client, stored);
    expect(calls).toEqual([`remove ${BOARD_FILES_BUCKET}/b1/f1.pdf`, "delete board_files where id=f1"]);
  });

  it("removes a link without touching Storage", async () => {
    const { client, calls } = recordingClient();
    await removeBoardFile(client, { ...stored, id: "l1", kind: "link", format: "link", mimeType: null, url: "https://example.com/", storagePath: null });
    expect(calls).toEqual(["delete board_files where id=l1"]);
  });

  it("keeps the row when the bytes couldn't be removed, so it can be retried", async () => {
    const { client, calls } = recordingClient({ remove: { message: "storage down" } });
    await expect(removeBoardFile(client, stored)).rejects.toMatchObject({ message: "storage down" });
    expect(calls.some((call) => call.startsWith("delete"))).toBe(false);
  });
});

describe("createBoardFileUrl", () => {
  it("asks for an hour-long signed link to the file's path", async () => {
    const { client, calls } = recordingClient();
    expect(await createBoardFileUrl(client, "b1/f1.pdf")).toBe("https://files.test/b1/f1.pdf?token=t");
    expect(calls).toEqual([`sign ${BOARD_FILES_BUCKET}/b1/f1.pdf 3600s`]);
  });

  it("throws the storage error (e.g. 'Object not found') for the viewer to explain", async () => {
    const { client } = recordingClient({ sign: { message: "Object not found" } });
    await expect(createBoardFileUrl(client, "b1/f1.pdf")).rejects.toMatchObject({ message: "Object not found" });
  });
});

describe("removeStoredFilesForBoard / deleteBoard", () => {
  it("removes every stored file of the board, skipping links", async () => {
    const { client, calls } = recordingClient({}, [{ storage_path: "b1/a.pdf" }, { storage_path: null }, { storage_path: "b1/b.png" }]);
    await removeStoredFilesForBoard(client, "b1");
    expect(calls).toEqual(["select board_files where board_id=b1", `remove ${BOARD_FILES_BUCKET}/b1/a.pdf,b1/b.png`]);
  });

  it("does nothing for a board without stored files", async () => {
    const { client, calls } = recordingClient({}, [{ storage_path: null }]);
    await removeStoredFilesForBoard(client, "b1");
    expect(calls).toEqual(["select board_files where board_id=b1"]);
  });

  it("never throws, even where the table doesn't exist or Storage fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      removeStoredFilesForBoard(recordingClient({ select: { code: "PGRST205" } }).client, "b1"),
    ).resolves.toBeUndefined();
    await expect(
      removeStoredFilesForBoard(recordingClient({ remove: { message: "down" } }, [{ storage_path: "x" }]).client, "b1"),
    ).resolves.toBeUndefined();
    warn.mockRestore();
  });

  it("deletes the board's files from Storage before the board itself, and still deletes it if that step fails", async () => {
    const { client, calls } = recordingClient({ remove: { message: "down" } }, [{ storage_path: "b1/a.pdf" }]);
    // `boards.delete().eq()` — the fake's `delete` serves the board row too.
    await deleteBoard(client, "b1");
    expect(calls).toEqual([
      "select board_files where board_id=b1",
      `remove ${BOARD_FILES_BUCKET}/b1/a.pdf`,
      "delete boards where id=b1",
    ]);
  });
});
