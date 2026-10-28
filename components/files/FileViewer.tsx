"use client";

import DocxViewer from "./DocxViewer";
import EpubViewer from "./EpubViewer";
import ImageViewer from "./ImageViewer";
import PdfReader from "./PdfReader";
import PptxViewer from "./PptxViewer";
import TextViewer from "./TextViewer";
import type { ViewerProps } from "./viewer-types";

/**
 * Picks the viewer for a stored file. Each one fetches the file itself and
 * pulls in its own libraries only when opened (pdf.js, mammoth, jszip and
 * the Markdown renderer all load on demand), so a board with no open file
 * costs none of them.
 */
export default function FileViewer(props: ViewerProps) {
  switch (props.file.format) {
    case "pdf":
      return <PdfReader {...props} />;
    case "image":
      return <ImageViewer {...props} />;
    case "text":
    case "markdown":
      return <TextViewer {...props} />;
    case "docx":
      return <DocxViewer {...props} />;
    case "pptx":
      return <PptxViewer {...props} />;
    case "epub":
      return <EpubViewer {...props} />;
    default:
      return null;
  }
}
