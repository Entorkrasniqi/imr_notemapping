"use client";

import ReaderShell from "./ReaderShell";
import { InvalidFileError, useParsedFile, type Parsed } from "./useParsedFile";
import ViewerMessage from "./ViewerMessage";
import type { ViewerProps } from "./viewer-types";
import { resolveZipPath } from "@/lib/files/zip-paths";

const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

type Block = { level: number; text: string };
type Slide = { number: number; title: string | null; blocks: Block[]; tables: string[][][]; notes: string[] };

/** Placeholders that are furniture (slide number, footer, date), not content. */
const FURNITURE = new Set(["sldNum", "ftr", "dt"]);

function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) throw new InvalidFileError("Bad XML");
  return doc;
}

/** The text of each paragraph (`a:p`) under `root`, with its bullet level. */
function paragraphsOf(root: Element): Block[] {
  const blocks: Block[] = [];
  for (const paragraph of Array.from(root.getElementsByTagNameNS(NS_A, "p"))) {
    let text = "";
    for (const child of Array.from(paragraph.children)) {
      if (child.localName === "br") text += "\n";
      else if (child.localName === "r" || child.localName === "fld") {
        for (const run of Array.from(child.getElementsByTagNameNS(NS_A, "t"))) text += run.textContent ?? "";
      }
    }
    text = text.trim();
    if (!text) continue;
    const level = Number(paragraph.getElementsByTagNameNS(NS_A, "pPr")[0]?.getAttribute("lvl") ?? 0);
    blocks.push({ level: Number.isFinite(level) ? Math.min(level, 4) : 0, text });
  }
  return blocks;
}

function relationships(doc: Document | null): { id: string; type: string; target: string }[] {
  if (!doc) return [];
  return Array.from(doc.getElementsByTagName("Relationship")).map((rel) => ({
    id: rel.getAttribute("Id") ?? "",
    type: rel.getAttribute("Type") ?? "",
    target: rel.getAttribute("Target") ?? "",
  }));
}

/**
 * A PowerPoint file as an outline: for each slide in order, its title, its
 * text (with bullet levels), tables as rows of cells, and speaker notes.
 * Pictures, charts, shapes and layout aren't reproduced — there is no
 * practical way to draw real slides in the browser without a large engine —
 * but the words, which is what you take notes from, are all here.
 */
async function parsePptx(bytes: ArrayBuffer): Promise<Parsed<Slide[]>> {
  const JSZip = (await import("jszip")).default;
  let zip: Awaited<ReturnType<typeof JSZip.loadAsync>>;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new InvalidFileError("Not a zip");
  }
  const read = async (path: string) => (await zip.file(path)?.async("string")) ?? null;

  // Slide order lives in presentation.xml; the files are named by creation order.
  let slidePaths: string[] = [];
  const presentation = await read("ppt/presentation.xml");
  if (presentation === null) throw new InvalidFileError("No presentation.xml");
  const rels = relationships(await read("ppt/_rels/presentation.xml.rels").then((t) => (t ? parseXml(t) : null)));
  for (const id of Array.from(parseXml(presentation).getElementsByTagNameNS(NS_P, "sldId"))) {
    const target = rels.find((rel) => rel.id === id.getAttributeNS(NS_R, "id"))?.target;
    if (target) slidePaths.push(resolveZipPath("ppt/presentation.xml", target));
  }
  if (slidePaths.length === 0) {
    slidePaths = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => Number(a.match(/\d+/g)?.pop()) - Number(b.match(/\d+/g)?.pop()));
  }
  if (slidePaths.length === 0) throw new InvalidFileError("No slides");

  const slides: Slide[] = [];
  for (const [index, path] of slidePaths.entries()) {
    const xml = await read(path);
    if (xml === null) continue;
    const doc = parseXml(xml);
    const slide: Slide = { number: index + 1, title: null, blocks: [], tables: [], notes: [] };

    for (const shape of Array.from(doc.getElementsByTagNameNS(NS_P, "sp"))) {
      const type = shape.getElementsByTagNameNS(NS_P, "ph")[0]?.getAttribute("type") ?? null;
      if (type && FURNITURE.has(type)) continue;
      const paragraphs = paragraphsOf(shape);
      if (paragraphs.length === 0) continue;
      if ((type === "title" || type === "ctrTitle") && slide.title === null) slide.title = paragraphs.map((p) => p.text).join(" ");
      else slide.blocks.push(...paragraphs);
    }
    for (const table of Array.from(doc.getElementsByTagNameNS(NS_A, "tbl"))) {
      slide.tables.push(
        Array.from(table.getElementsByTagNameNS(NS_A, "tr")).map((row) =>
          Array.from(row.getElementsByTagNameNS(NS_A, "tc")).map((cell) => paragraphsOf(cell).map((p) => p.text).join(" ")),
        ),
      );
    }

    // Speaker notes hang off the slide through its own relationships file.
    const slideRels = relationships(await read(resolveZipPath(path, `_rels/${path.split("/").pop()}.rels`)).then((t) => (t ? parseXml(t) : null)));
    const notesTarget = slideRels.find((rel) => rel.type.endsWith("/notesSlide"))?.target;
    const notesXml = notesTarget ? await read(resolveZipPath(path, notesTarget)) : null;
    if (notesXml) {
      for (const shape of Array.from(parseXml(notesXml).getElementsByTagNameNS(NS_P, "sp"))) {
        const type = shape.getElementsByTagNameNS(NS_P, "ph")[0]?.getAttribute("type");
        if (type === "body") slide.notes.push(...paragraphsOf(shape).map((p) => p.text));
      }
    }
    slides.push(slide);
  }
  return { value: slides };
}

export default function PptxViewer({ file, getUrl }: ViewerProps) {
  const { state, retry } = useParsedFile(file.storagePath, getUrl, parsePptx);
  return (
    <ReaderShell
      file={file}
      toolbar={<span className="truncate">{state.kind === "ready" ? `${state.value.length} slide${state.value.length === 1 ? "" : "s"} · text outline` : ""}</span>}
    >
      <div tabIndex={0} aria-label="Slides" className="zt-scroll min-h-0 flex-1 overflow-auto p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--zt-select)">
        {state.kind !== "ready" ? (
          <ViewerMessage state={state} fileName={file.name} what="a PowerPoint presentation (.pptx)" onRetry={retry} />
        ) : (
          <div className="mx-auto flex max-w-[70ch] flex-col gap-3">
            <p className="text-xs text-(--zt-dim)">
              The words of each slide. Pictures, charts and layout aren’t shown.
            </p>
            {state.value.map((slide) => (
              <article
                key={slide.number}
                data-slide={slide.number}
                className="rounded-md border border-(--zt-border) bg-(--zt-list) px-5 py-4 text-(--zt-text) shadow-sm"
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-(--zt-dim)">Slide {slide.number}</p>
                <h3 className="mt-0.5 text-base font-semibold">{slide.title ?? <span className="font-normal italic opacity-60">Untitled slide</span>}</h3>
                {slide.blocks.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1 text-[13px] leading-snug">
                    {slide.blocks.map((block, i) => (
                      <li key={i} className="whitespace-pre-line" style={{ marginLeft: block.level * 16 }}>
                        <span aria-hidden className="mr-1.5 opacity-50">{block.level === 0 ? "•" : "–"}</span>
                        {block.text}
                      </li>
                    ))}
                  </ul>
                )}
                {slide.tables.map((table, t) => (
                  <table key={t} className="mt-3 w-full border-collapse text-xs">
                    <tbody>
                      {table.map((row, r) => (
                        <tr key={r}>
                          {row.map((cell, c) => (
                            <td key={c} className="border border-(--zt-border) px-2 py-1 align-top">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ))}
                {slide.notes.length > 0 && (
                  <div className="mt-3 rounded bg-(--zt-stripe) px-3 py-2 text-xs text-(--zt-dim)">
                    <p className="font-medium">Notes</p>
                    {slide.notes.map((note, i) => (
                      <p key={i} className="mt-0.5">{note}</p>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </ReaderShell>
  );
}
