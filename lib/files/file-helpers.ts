/**
 * The most items one board's sidebar holds. Mirrors the database trigger
 * (`enforce_board_file_limit`, see the `board_files` migration): the
 * trigger is what enforces it, this copy lets the sidebar disable "Add"
 * before a request goes out. Links count too.
 */
export const MAX_FILES_PER_BOARD = 10;

/** 20 MiB — the same cap as the `board_files` shape check and the bucket. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** Mirrors the database's limit on a link's address. */
export const MAX_LINK_LENGTH = 2000;

/**
 * What a sidebar item is. `link` has no stored file; every other format is
 * a file in Storage and has a viewer in `components/files/`.
 */
export type FileFormat = "pdf" | "image" | "text" | "markdown" | "docx" | "pptx" | "epub" | "link";
export type StoredFormat = Exclude<FileFormat, "link">;

/**
 * The stored types — exactly the list in the `board_files_shape` check and
 * the bucket's allowed types. SVG is absent on purpose (it can carry
 * script), as are the legacy `.doc` / `.ppt` binary formats.
 */
const FORMAT_BY_MIME: Record<string, StoredFormat> = {
  "application/pdf": "pdf",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "image/gif": "image",
  "text/plain": "text",
  "text/markdown": "markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/epub+zip": "epub",
};

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

export function formatOfMime(mime: string | null | undefined): StoredFormat | null {
  return (mime && FORMAT_BY_MIME[mime]) || null;
}

/** For the file picker's `accept` attribute. */
export const ACCEPTED_FILES = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.markdown,.docx,.pptx,.epub";

/** Why a picked or dropped file was turned away before any upload started. */
export type FileRejection = "unsupported" | "too-large" | "empty";

export type IdentifyResult = { ok: true; mime: string; format: StoredFormat } | { ok: false; reason: FileRejection };

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, index) => bytes[offset + index] === byte);

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

/**
 * The text a PDF always starts with. Some files carry a few bytes of junk
 * before it (the spec tolerates up to 1024), so look in the first kilobyte,
 * as readers do.
 */
export function startsLikePdf(bytes: Uint8Array): boolean {
  const signature = ascii("%PDF-");
  const limit = Math.min(bytes.length, 1024) - signature.length;
  for (let start = 0; start <= limit; start++) {
    if (startsWith(bytes, signature, start)) return true;
  }
  return false;
}

function extensionOf(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return match ? match[1].toLowerCase() : "";
}

/**
 * Text has no signature, so it's recognised by extension and then checked
 * to really be text: no NUL bytes and valid UTF-8. When `truncated` (the
 * sample is only the start of a bigger file), a multi-byte character cut
 * off at its end is fine; at the true end of a file it isn't.
 */
function looksLikeText(sample: Uint8Array, truncated: boolean): boolean {
  if (sample.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(sample, { stream: truncated });
    return true;
  } catch {
    return false;
  }
}

/**
 * Works out what a file really is from its *contents*, not its name or the
 * browser-reported type — both are whatever the file was called. Images,
 * PDFs and the zip-based formats are checked by signature (a zip is then
 * told apart as Word, PowerPoint or EPUB by its extension, and checked
 * properly when it is opened); text is checked to be text.
 */
export async function identifyFile(file: File): Promise<IdentifyResult> {
  if (file.size === 0) return { ok: false, reason: "empty" };
  if (file.size > MAX_FILE_BYTES) return { ok: false, reason: "too-large" };

  const SAMPLE_BYTES = 64 * 1024;
  const sample = new Uint8Array(await file.slice(0, SAMPLE_BYTES).arrayBuffer());
  const extension = extensionOf(file.name);

  if (startsLikePdf(sample.subarray(0, 1024))) return { ok: true, mime: "application/pdf", format: "pdf" };
  if (startsWith(sample, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ok: true, mime: "image/png", format: "image" };
  if (startsWith(sample, [0xff, 0xd8, 0xff])) return { ok: true, mime: "image/jpeg", format: "image" };
  if (startsWith(sample, ascii("GIF87a")) || startsWith(sample, ascii("GIF89a"))) return { ok: true, mime: "image/gif", format: "image" };
  if (startsWith(sample, ascii("RIFF")) && startsWith(sample, ascii("WEBP"), 8)) return { ok: true, mime: "image/webp", format: "image" };

  if (startsWith(sample, [0x50, 0x4b, 0x03, 0x04])) {
    if (extension === "docx") return { ok: true, mime: DOCX_MIME, format: "docx" };
    if (extension === "pptx") return { ok: true, mime: PPTX_MIME, format: "pptx" };
    if (extension === "epub") return { ok: true, mime: "application/epub+zip", format: "epub" };
    return { ok: false, reason: "unsupported" };
  }

  if (["txt", "text", "md", "markdown"].includes(extension) && looksLikeText(sample, file.size > SAMPLE_BYTES)) {
    const markdown = extension === "md" || extension === "markdown";
    return { ok: true, mime: markdown ? "text/markdown" : "text/plain", format: markdown ? "markdown" : "text" };
  }

  return { ok: false, reason: "unsupported" };
}

export function describeRejection(rejection: FileRejection, fileName: string): string {
  switch (rejection) {
    case "unsupported":
      return `“${fileName}” isn’t a supported file. Add a PDF, image, text or Markdown file, a Word (.docx) or PowerPoint (.pptx) file, or an EPUB.`;
    case "too-large":
      return `“${fileName}” is over ${formatFileSize(MAX_FILE_BYTES)}.`;
    case "empty":
      return `“${fileName}” is empty.`;
  }
}

/** `Attention Is All You Need.pdf` → `Attention Is All You Need`, capped at the column's 200 characters. */
export function titleFromFileName(fileName: string): string {
  const withoutExtension = fileName
    .trim()
    .replace(/\.(pdf|png|jpe?g|webp|gif|txt|text|md|markdown|docx|pptx|epub)$/i, "")
    .trim();
  return (withoutExtension || "Untitled").slice(0, 200);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes < 10 ? megabytes.toFixed(1) : Math.round(megabytes)} MB`;
}

/**
 * Turns what someone typed into a link address, or `null` if it isn't one
 * we'll keep: only http(s), no embedded `user:password@` (a common phishing
 * shape), and within the database's length limit. A bare `example.com/page`
 * gets `https://`.
 */
export function normalizeLinkUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^[^/]*:\d+(\/|$)/.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
  const href = url.href;
  return href.length <= MAX_LINK_LENGTH ? href : null;
}

/** A readable default title for a link: its host, without a leading `www.`. */
export function titleFromUrl(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, "").slice(0, 200);
  } catch {
    return "Link";
  }
}
