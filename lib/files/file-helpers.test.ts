import { describe, expect, it } from "vitest";
import {
  describeRejection,
  formatFileSize,
  formatOfMime,
  identifyFile,
  MAX_FILE_BYTES,
  normalizeLinkUrl,
  startsLikePdf,
  titleFromFileName,
  titleFromUrl,
} from "./file-helpers";

const bytes = (text: string) => new TextEncoder().encode(text);
const named = (name: string, content: BlobPart) => new File([content], name);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0]);

describe("startsLikePdf", () => {
  it("accepts the header and tolerates junk before it", () => {
    expect(startsLikePdf(bytes("%PDF-1.4"))).toBe(true);
    expect(startsLikePdf(bytes("\r\n  %PDF-1.4"))).toBe(true);
  });

  it("rejects other files, short files and a header past the first kilobyte", () => {
    expect(startsLikePdf(bytes("PK\u0003\u0004"))).toBe(false);
    expect(startsLikePdf(bytes("%PD"))).toBe(false);
    expect(startsLikePdf(bytes(" ".repeat(1100) + "%PDF-1.4"))).toBe(false);
  });
});

describe("identifyFile", () => {
  it("recognises a PDF whatever it is called", async () => {
    expect(await identifyFile(named("paper.pdf", "%PDF-1.7\n"))).toEqual({ ok: true, mime: "application/pdf", format: "pdf" });
    expect(await identifyFile(named("no-extension", "%PDF-1.7\n"))).toMatchObject({ format: "pdf" });
  });

  it("recognises images by their signature", async () => {
    expect(await identifyFile(named("a.png", PNG))).toEqual({ ok: true, mime: "image/png", format: "image" });
    expect(await identifyFile(named("a.jpg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0])))).toMatchObject({ mime: "image/jpeg" });
    expect(await identifyFile(named("a.gif", bytes("GIF89a\u0001")))).toMatchObject({ mime: "image/gif" });
    expect(await identifyFile(named("a.webp", bytes("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ")))).toMatchObject({ mime: "image/webp" });
  });

  it("trusts the contents over a misleading name", async () => {
    expect(await identifyFile(named("scan.pdf", PNG))).toMatchObject({ mime: "image/png", format: "image" });
    expect(await identifyFile(named("notes.txt", "%PDF-1.4\n"))).toMatchObject({ format: "pdf" });
  });

  it("tells the zip-based formats apart by extension", async () => {
    expect(await identifyFile(named("essay.docx", ZIP))).toMatchObject({ format: "docx" });
    expect(await identifyFile(named("deck.PPTX", ZIP))).toMatchObject({ format: "pptx" });
    expect(await identifyFile(named("book.epub", ZIP))).toMatchObject({ format: "epub", mime: "application/epub+zip" });
  });

  it("refuses a plain zip, and anything claiming to be a zip format without being one", async () => {
    expect(await identifyFile(named("archive.zip", ZIP))).toEqual({ ok: false, reason: "unsupported" });
    expect(await identifyFile(named("fake.docx", "just text"))).toEqual({ ok: false, reason: "unsupported" });
  });

  it("accepts text and Markdown by extension, as UTF-8 text only", async () => {
    expect(await identifyFile(named("n.txt", "plain notes åäö"))).toEqual({ ok: true, mime: "text/plain", format: "text" });
    expect(await identifyFile(named("n.md", "# Title"))).toEqual({ ok: true, mime: "text/markdown", format: "markdown" });
    expect(await identifyFile(named("n.markdown", "# Title"))).toMatchObject({ format: "markdown" });
    expect(await identifyFile(named("bin.txt", new Uint8Array([0x41, 0, 0x42])))).toEqual({ ok: false, reason: "unsupported" });
    expect(await identifyFile(named("latin1.txt", new Uint8Array([0x63, 0x61, 0x66, 0xe9])))).toEqual({ ok: false, reason: "unsupported" });
  });

  it("allows a multi-byte character cut off at the end of the sample", async () => {
    const body = new Uint8Array(64 * 1024 + 1);
    body.fill(0x61);
    body.set([0xe2, 0x82], 64 * 1024 - 2); // first two bytes of "€" at the sample boundary
    body[64 * 1024] = 0xac;
    expect(await identifyFile(named("long.txt", body))).toMatchObject({ ok: true, format: "text" });
  });

  it("refuses unsupported types, SVG included", async () => {
    expect(await identifyFile(named("vector.svg", '<svg xmlns="http://www.w3.org/2000/svg"/>'))).toEqual({ ok: false, reason: "unsupported" });
    expect(await identifyFile(named("run.exe", new Uint8Array([0x4d, 0x5a, 0x90])))).toEqual({ ok: false, reason: "unsupported" });
    expect(await identifyFile(named("page.html", "<html></html>"))).toEqual({ ok: false, reason: "unsupported" });
  });

  it("refuses empty and oversized files, but allows exactly the limit", async () => {
    expect(await identifyFile(named("empty.pdf", ""))).toEqual({ ok: false, reason: "empty" });
    expect(await identifyFile(named("huge.pdf", new Uint8Array(MAX_FILE_BYTES + 1)))).toEqual({ ok: false, reason: "too-large" });
    const max = new Uint8Array(MAX_FILE_BYTES);
    max.set(bytes("%PDF-1.7"));
    expect(await identifyFile(named("max.pdf", max))).toMatchObject({ ok: true });
  });
});

describe("formatOfMime", () => {
  it("maps every stored type and nothing else", () => {
    expect(formatOfMime("application/pdf")).toBe("pdf");
    expect(formatOfMime("image/webp")).toBe("image");
    expect(formatOfMime("text/markdown")).toBe("markdown");
    expect(formatOfMime("image/svg+xml")).toBeNull();
    expect(formatOfMime("application/msword")).toBeNull();
    expect(formatOfMime(null)).toBeNull();
  });
});

describe("describeRejection", () => {
  it("names the file and the problem", () => {
    expect(describeRejection("unsupported", "a.zip")).toContain("“a.zip” isn’t a supported file");
    expect(describeRejection("too-large", "b.pdf")).toBe("“b.pdf” is over 20 MB.");
    expect(describeRejection("empty", "c.pdf")).toBe("“c.pdf” is empty.");
  });
});

describe("titleFromFileName", () => {
  it("drops a known extension in any case and trims", () => {
    expect(titleFromFileName("Attention Is All You Need.pdf")).toBe("Attention Is All You Need");
    expect(titleFromFileName("  Thesis.PDF ")).toBe("Thesis");
    expect(titleFromFileName("notes.v2.md")).toBe("notes.v2");
    expect(titleFromFileName("Lecture 3.pptx")).toBe("Lecture 3");
    expect(titleFromFileName("photo.JPEG")).toBe("photo");
  });

  it("never returns an empty or over-long title (the column allows 1–200)", () => {
    expect(titleFromFileName(".pdf")).toBe("Untitled");
    expect(titleFromFileName("x".repeat(300) + ".epub")).toHaveLength(200);
  });
});

describe("normalizeLinkUrl", () => {
  it("keeps http(s) addresses and adds https:// to a bare one", () => {
    expect(normalizeLinkUrl("https://example.com/paper?id=1")).toBe("https://example.com/paper?id=1");
    expect(normalizeLinkUrl("  http://example.com ")).toBe("http://example.com/");
    expect(normalizeLinkUrl("example.com/page")).toBe("https://example.com/page");
    expect(normalizeLinkUrl("example.com:8080/x")).toBe("https://example.com:8080/x");
    expect(normalizeLinkUrl("localhost:3000")).toBe("https://localhost:3000/");
  });

  it("refuses anything that isn't a plain web address", () => {
    expect(normalizeLinkUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeLinkUrl("data:text/html,<script>1</script>")).toBeNull();
    expect(normalizeLinkUrl("ftp://example.com/file")).toBeNull();
    expect(normalizeLinkUrl("file:///etc/passwd")).toBeNull();
    expect(normalizeLinkUrl("mailto:me@example.com")).toBeNull();
    expect(normalizeLinkUrl("https://user:pass@example.com")).toBeNull();
    expect(normalizeLinkUrl("https://exa mple.com")).toBeNull();
    expect(normalizeLinkUrl("notaurl")).toBeNull();
    expect(normalizeLinkUrl("")).toBeNull();
  });

  it("respects the database's 2000-character limit", () => {
    expect(normalizeLinkUrl("https://example.com/" + "a".repeat(1980))?.length).toBe(2000);
    expect(normalizeLinkUrl("https://example.com/" + "a".repeat(1981))).toBeNull();
  });
});

describe("titleFromUrl", () => {
  it("uses the host without www.", () => {
    expect(titleFromUrl("https://www.example.com/a/b")).toBe("example.com");
    expect(titleFromUrl("https://docs.example.org/")).toBe("docs.example.org");
  });
});

describe("formatFileSize", () => {
  it("picks a readable unit", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
    expect(formatFileSize(18 * 1024 * 1024)).toBe("18 MB");
  });
});
