import { describe, expect, it } from "vitest";
import { imageTypeOfPath, isExternalHref, resolveZipPath } from "./zip-paths";

describe("resolveZipPath", () => {
  it("resolves relative to the file that mentions it", () => {
    expect(resolveZipPath("OEBPS/text/ch1.xhtml", "../images/cover.png")).toBe("OEBPS/images/cover.png");
    expect(resolveZipPath("OEBPS/content.opf", "text/ch1.xhtml")).toBe("OEBPS/text/ch1.xhtml");
    expect(resolveZipPath("ch1.xhtml", "img/a.jpg")).toBe("img/a.jpg");
    expect(resolveZipPath("ppt/presentation.xml", "slides/slide1.xml")).toBe("ppt/slides/slide1.xml");
  });

  it("drops fragments and queries, and decodes percent-encoding", () => {
    expect(resolveZipPath("OEBPS/a.xhtml", "b.xhtml#section-2")).toBe("OEBPS/b.xhtml");
    expect(resolveZipPath("OEBPS/a.xhtml", "my%20image.png?x=1")).toBe("OEBPS/my image.png");
    expect(resolveZipPath("OEBPS/a.xhtml", "100%.png")).toBe("OEBPS/100%.png");
  });

  it("treats a leading slash as the zip's root and never climbs above it", () => {
    expect(resolveZipPath("OEBPS/a.xhtml", "/META-INF/container.xml")).toBe("META-INF/container.xml");
    expect(resolveZipPath("a.xhtml", "../../../etc/passwd")).toBe("etc/passwd");
  });

  it("ignores empty and current-directory segments", () => {
    expect(resolveZipPath("OEBPS/a.xhtml", "./x//y.png")).toBe("OEBPS/x/y.png");
  });
});

describe("isExternalHref", () => {
  it("tells addresses with a scheme from paths in the book", () => {
    expect(isExternalHref("https://example.com")).toBe(true);
    expect(isExternalHref("mailto:a@b.c")).toBe(true);
    expect(isExternalHref("javascript:alert(1)")).toBe(true);
    expect(isExternalHref("chapter2.xhtml#x")).toBe(false);
    expect(isExternalHref("../text/ch3.xhtml")).toBe(false);
    expect(isExternalHref("#top")).toBe(false);
  });
});

describe("imageTypeOfPath", () => {
  it("knows the image types by extension", () => {
    expect(imageTypeOfPath("OEBPS/cover.JPG")).toBe("image/jpeg");
    expect(imageTypeOfPath("a/b.svg")).toBe("image/svg+xml");
    expect(imageTypeOfPath("a/b.xhtml")).toBeNull();
    expect(imageTypeOfPath("noextension")).toBeNull();
  });
});
