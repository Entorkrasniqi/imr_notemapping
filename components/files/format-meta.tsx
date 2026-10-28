import type { FileFormat } from "@/lib/files/file-helpers";
import {
  BookIcon,
  ImageFileIcon,
  LinkIcon,
  PdfFileIcon,
  SlidesIcon,
  TextFileIcon,
  WordFileIcon,
} from "./icons";

type FormatMeta = {
  /** For the screen-reader name and tooltips, e.g. "PDF". */
  label: string;
  Icon: (props: { className?: string }) => React.ReactElement;
  /** Text color for the icon in each theme (an unselected row; a selected one is white). */
  tone: string;
};

/**
 * One look per kind of item, so the sidebar can be scanned the way
 * Zotero's item list can: the icon says what it is before the name does.
 */
export const FORMAT_META: Record<FileFormat, FormatMeta> = {
  pdf: { label: "PDF", Icon: PdfFileIcon, tone: "text-red-500 dark:text-red-400 blueprint:text-red-300" },
  image: { label: "Image", Icon: ImageFileIcon, tone: "text-emerald-600 dark:text-emerald-400 blueprint:text-emerald-300" },
  text: { label: "Text file", Icon: TextFileIcon, tone: "text-zinc-500 dark:text-zinc-400 blueprint:text-white/70" },
  markdown: { label: "Markdown", Icon: TextFileIcon, tone: "text-sky-600 dark:text-sky-400 blueprint:text-sky-300" },
  docx: { label: "Word document", Icon: WordFileIcon, tone: "text-blue-600 dark:text-blue-400 blueprint:text-blue-300" },
  pptx: { label: "PowerPoint", Icon: SlidesIcon, tone: "text-orange-500 dark:text-orange-400 blueprint:text-orange-300" },
  epub: { label: "EPUB book", Icon: BookIcon, tone: "text-violet-600 dark:text-violet-400 blueprint:text-violet-300" },
  link: { label: "Web link", Icon: LinkIcon, tone: "text-teal-600 dark:text-teal-400 blueprint:text-teal-300" },
};
