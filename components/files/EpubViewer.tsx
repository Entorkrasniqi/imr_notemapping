"use client";

import { useEffect, useRef, useState } from "react";
import { imageTypeOfPath, isExternalHref, resolveZipPath } from "@/lib/files/zip-paths";
import { ChevronIcon } from "./icons";
import ReaderShell, { readerField, readerToolButton } from "./ReaderShell";
import { sanitizeDocumentHtml } from "./sanitize";
import { InvalidFileError, useParsedFile, type Parsed } from "./useParsedFile";
import ViewerMessage from "./ViewerMessage";
import type { ViewerProps } from "./viewer-types";

type Chapter = { path: string; label: string };
type Epub = { title: string | null; chapters: Chapter[]; loadChapter: (index: number) => Promise<{ html: string; revoke: () => void }> };

/** A chapter bigger than this (as text) is refused rather than frozen into the page. */
const MAX_CHAPTER_CHARS = 5_000_000;

function parseXml(text: string, type: DOMParserSupportedType = "application/xml"): Document {
  const doc = new DOMParser().parseFromString(text, type);
  if (doc.getElementsByTagName("parsererror").length > 0) throw new InvalidFileError("Bad XML");
  return doc;
}

const named = (root: Document | Element, name: string) => Array.from(root.getElementsByTagNameNS("*", name));

/**
 * Opens an EPUB (a zip of XHTML chapters). Chapters are read on demand: the
 * book's own CSS is dropped in favour of this app's typography, the markup is
 * sanitized, and pictures are swapped for blob URLs made from the zip. The
 * reading order comes from the spine; chapter names from the book's table of
 * contents (EPUB 3 nav, or the older NCX), falling back to "Section n".
 */
async function openEpub(bytes: ArrayBuffer): Promise<Parsed<Epub>> {
  const [{ default: JSZip }, { default: DOMPurify }] = await Promise.all([import("jszip"), import("dompurify")]);
  let zip: Awaited<ReturnType<typeof JSZip.loadAsync>>;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new InvalidFileError("Not a zip");
  }
  const read = async (path: string) => (await zip.file(path)?.async("string")) ?? null;

  const container = await read("META-INF/container.xml");
  if (container === null) throw new InvalidFileError("No container.xml");
  const opfPath = named(parseXml(container), "rootfile")[0]?.getAttribute("full-path");
  const opfText = opfPath ? await read(opfPath) : null;
  if (!opfPath || opfText === null) throw new InvalidFileError("No package document");
  const opf = parseXml(opfText);

  const manifest = new Map<string, { path: string; type: string; properties: string }>();
  for (const item of named(opf, "item")) {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (id && href) {
      manifest.set(id, {
        path: resolveZipPath(opfPath, href),
        type: item.getAttribute("media-type") ?? "",
        properties: item.getAttribute("properties") ?? "",
      });
    }
  }

  const chapterPaths: string[] = [];
  for (const ref of named(opf, "itemref")) {
    if (ref.getAttribute("linear") === "no") continue;
    const item = manifest.get(ref.getAttribute("idref") ?? "");
    if (item && /html/.test(item.type)) chapterPaths.push(item.path);
  }
  if (chapterPaths.length === 0) throw new InvalidFileError("Empty reading order");

  // Chapter names from the table of contents.
  const labels = new Map<string, string>();
  const navItem = [...manifest.values()].find((item) => item.properties.split(/\s+/).includes("nav"));
  const navText = navItem ? await read(navItem.path) : null;
  if (navItem && navText) {
    const nav = parseXml(navText, "application/xhtml+xml");
    const toc = named(nav, "nav").find((element) => Array.from(element.attributes).some((a) => a.localName === "type" && /\btoc\b/.test(a.value)));
    for (const anchor of toc ? Array.from(toc.getElementsByTagName("a")) : []) {
      const href = anchor.getAttribute("href");
      const label = anchor.textContent?.replace(/\s+/g, " ").trim();
      if (href && label) {
        const path = resolveZipPath(navItem.path, href);
        if (!labels.has(path)) labels.set(path, label);
      }
    }
  } else {
    const ncxId = opf.getElementsByTagNameNS("*", "spine")[0]?.getAttribute("toc");
    const ncx = ncxId ? manifest.get(ncxId) : [...manifest.values()].find((item) => item.type === "application/x-dtbncx+xml");
    const ncxText = ncx ? await read(ncx.path) : null;
    if (ncx && ncxText) {
      for (const point of named(parseXml(ncxText), "navPoint")) {
        const label = named(point, "text")[0]?.textContent?.replace(/\s+/g, " ").trim();
        const src = named(point, "content")[0]?.getAttribute("src");
        if (label && src) {
          const path = resolveZipPath(ncx.path, src);
          if (!labels.has(path)) labels.set(path, label);
        }
      }
    }
  }

  const chapters: Chapter[] = chapterPaths.map((path, index) => ({ path, label: labels.get(path) ?? `Section ${index + 1}` }));
  const title = named(opf, "title")[0]?.textContent?.trim() || null;

  async function loadChapter(index: number) {
    const chapter = chapters[index];
    const source = await read(chapter.path);
    if (source === null) throw new InvalidFileError("Missing chapter");
    if (source.length > MAX_CHAPTER_CHARS) throw new InvalidFileError("Chapter too large");

    let doc: Document;
    try {
      doc = parseXml(source, "application/xhtml+xml");
    } catch {
      doc = new DOMParser().parseFromString(source, "text/html");
    }
    const clean = sanitizeDocumentHtml(DOMPurify, (doc.body ?? doc.documentElement).innerHTML);

    // Swap the book's pictures for blob URLs from the zip; drop anything remote or missing.
    const template = document.createElement("template");
    template.innerHTML = clean;
    const urls: string[] = [];
    for (const image of Array.from(template.content.querySelectorAll("img"))) {
      const src = image.getAttribute("src");
      const path = src && !isExternalHref(src) ? resolveZipPath(chapter.path, src) : null;
      const type = path ? imageTypeOfPath(path) : null;
      const entry = path && type ? zip.file(path) : null;
      if (entry && type) {
        const url = URL.createObjectURL(new Blob([await entry.async("arraybuffer")], { type }));
        urls.push(url);
        image.setAttribute("src", url);
      } else {
        image.removeAttribute("src");
      }
    }
    return { html: template.innerHTML, revoke: () => urls.forEach((url) => URL.revokeObjectURL(url)) };
  }

  return { value: { title, chapters, loadChapter } };
}

export default function EpubViewer({ file, getUrl }: ViewerProps) {
  const { state, retry } = useParsedFile(file.storagePath, getUrl, openEpub);
  return state.kind === "ready" ? (
    <EpubReader epub={state.value} file={file} />
  ) : (
    <ReaderShell file={file}>
      <div className="min-h-0 flex-1 overflow-auto">
        <ViewerMessage state={state} fileName={file.name} what="an EPUB book" onRetry={retry} />
      </div>
    </ReaderShell>
  );
}

function EpubReader({ epub, file }: { epub: Epub } & Pick<ViewerProps, "file">) {
  const [index, setIndex] = useState(0);
  const [chapter, setChapter] = useState<{ index: number; html: string } | { index: number; error: true } | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const last = epub.chapters.length - 1;

  useEffect(() => {
    let cancelled = false;
    let revoke: (() => void) | undefined;
    epub
      .loadChapter(index)
      .then((loaded) => {
        if (cancelled) {
          loaded.revoke();
          return;
        }
        revoke = loaded.revoke;
        setChapter({ index, html: loaded.html });
        scrollerRef.current?.scrollTo({ top: 0 });
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Failed to open a chapter:", error);
        setChapter({ index, error: true });
      });
    return () => {
      cancelled = true;
      revoke?.();
    };
  }, [epub, index]);

  // Links inside the book jump to the chapter they point at; the rest open in
  // a new tab (the sanitizer set that), and anything unresolvable does nothing.
  const handleClick = (event: React.MouseEvent) => {
    const anchor = (event.target as HTMLElement).closest("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href || isExternalHref(href)) return;
    event.preventDefault();
    const target = epub.chapters.findIndex((c) => c.path === resolveZipPath(epub.chapters[index].path, href));
    if (target >= 0) setIndex(target);
  };

  const current = chapter && chapter.index === index ? chapter : null;
  return (
    <ReaderShell
      file={file}
      toolbar={
        <>
          <button type="button" onClick={() => setIndex(index - 1)} disabled={index <= 0} aria-label="Previous section" className={readerToolButton}>
            <ChevronIcon direction="left" />
          </button>
          <select
            aria-label="Section"
            value={index}
            onChange={(event) => setIndex(Number(event.target.value))}
            className={`${readerField} min-w-0 flex-1 truncate text-xs`}
          >
            {epub.chapters.map((c, i) => (
              <option key={c.path} value={i}>
                {c.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setIndex(index + 1)} disabled={index >= last} aria-label="Next section" className={readerToolButton}>
            <ChevronIcon direction="right" />
          </button>
          <span className="w-14 text-right tabular-nums">{index + 1} / {last + 1}</span>
        </>
      }
    >
      <div ref={scrollerRef} tabIndex={0} aria-label="Book text" onClick={handleClick} className="zt-scroll min-h-0 flex-1 overflow-auto bg-(--zt-list) px-6 py-5 text-(--zt-text) outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--zt-select)">
        {epub.title && index === 0 && <p className="mx-auto mb-3 max-w-[70ch] text-xs uppercase tracking-wide opacity-60">{epub.title}</p>}
        {current && "error" in current ? (
          <p className="py-12 text-center text-sm opacity-70">This section couldn’t be read.</p>
        ) : current ? (
          current.html.trim() === "" ? (
            <p className="py-12 text-center text-sm opacity-60">This section has no text.</p>
          ) : (
            <article className="doc-prose mx-auto max-w-[70ch]" dangerouslySetInnerHTML={{ __html: current.html }} />
          )
        ) : (
          <p className="py-12 text-center text-sm opacity-60">Opening…</p>
        )}
        {current && !("error" in current) && index < last && (
          <div className="mx-auto mt-8 max-w-[70ch] text-center">
            <button type="button" onClick={() => setIndex(index + 1)} className="rounded-full border border-current/20 px-4 py-1.5 text-xs opacity-80 hover:opacity-100">
              Next: {epub.chapters[index + 1].label}
            </button>
          </div>
        )}
      </div>
    </ReaderShell>
  );
}
