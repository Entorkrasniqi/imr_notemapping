"use client";

import ReaderShell from "./ReaderShell";
import { sanitizeDocumentHtml } from "./sanitize";
import { InvalidFileError, useParsedFile, type Parsed } from "./useParsedFile";
import ViewerMessage from "./ViewerMessage";
import type { ViewerProps } from "./viewer-types";

/**
 * Word → HTML with mammoth (headings, lists, tables, bold/italic, links and
 * embedded pictures), then through the sanitizer. This is a reading view:
 * page layout, headers/footers, comments and exact fonts are not reproduced.
 */
async function parseDocx(bytes: ArrayBuffer): Promise<Parsed<string>> {
  const [{ default: mammoth }, { default: DOMPurify }] = await Promise.all([import("mammoth"), import("dompurify")]);
  let html: string;
  try {
    html = (await mammoth.convertToHtml({ arrayBuffer: bytes })).value;
  } catch {
    throw new InvalidFileError("Not a Word document");
  }
  return { value: sanitizeDocumentHtml(DOMPurify, html) };
}

export default function DocxViewer({ file, getUrl }: ViewerProps) {
  const { state, retry } = useParsedFile(file.storagePath, getUrl, parseDocx);
  return (
    <ReaderShell file={file}>
      <div tabIndex={0} aria-label="Document" className="zt-scroll min-h-0 flex-1 overflow-auto p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--zt-select)">
        {state.kind !== "ready" ? (
          <ViewerMessage state={state} fileName={file.name} what="a Word document (.docx)" onRetry={retry} />
        ) : state.value.trim() === "" ? (
          <p className="py-16 text-center text-[13px] text-(--zt-dim)">This document has no text to show.</p>
        ) : (
          // A white sheet whatever the theme: documents bring their own colors.
          <article
            className="doc-prose doc-paper mx-auto max-w-[820px] rounded bg-white px-8 py-8 text-zinc-900 shadow-md ring-1 ring-black/10"
            dangerouslySetInnerHTML={{ __html: state.value }}
          />
        )}
      </div>
    </ReaderShell>
  );
}
