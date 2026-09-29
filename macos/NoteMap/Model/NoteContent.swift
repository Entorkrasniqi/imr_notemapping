import Foundation

/// Helpers for a note's Tiptap document — a port of the web app's
/// `lib/editor/content.ts`, working on `JSONValue` instead of Tiptap's
/// `JSONContent`. Behavior matches the web version except where noted.
enum NoteContent {
    /// Same cap as the web app: base64 inflates a file by about a third and
    /// the whole note lives in one `jsonb` value.
    static let maxImageBytes = 8 * 1024 * 1024

    static var emptyParagraph: JSONValue { .node("paragraph") }

    /// No real text at all — `nil`, or only empty paragraphs.
    static func isEmpty(_ content: JSONValue?) -> Bool {
        guard let blocks = content?["content"]?.arrayValue else { return true }
        return blocks.allSatisfy { block in
            block.nodeType == "paragraph" && block.children.isEmpty
        }
    }

    /// Appends an image as a new last block (`appendImageBlock` on the web)
    /// — used when a JPEG is dropped onto a closed note tile. An empty note
    /// gets the image as its only block, exactly as the web app does it.
    static func appendingImage(to content: JSONValue?, src: String) -> JSONValue {
        let image = JSONValue.node("image", attrs: ["src": .string(src)])
        if isEmpty(content) {
            return .node("doc", content: [image])
        }
        return .node("doc", content: (content?.children ?? []) + [image])
    }

    /// Whether a note's first block reads as its title line. The web
    /// version treats *any* first block as the title; a first block that
    /// isn't text (an image dropped onto an empty tile, a list) then
    /// becomes an empty title and falls out of the editor entirely. Here
    /// only paragraphs/headings count as the title, and anything else stays
    /// in the body, so opening such a note natively can't lose it.
    private static func isTitleBlock(_ block: JSONValue?) -> Bool {
        block?.nodeType == "paragraph" || block?.nodeType == "heading"
    }

    /// The title as plain text (`extractTitleText`).
    static func titleText(_ content: JSONValue?) -> String {
        guard let first = content?.children.first, isTitleBlock(first) else { return "" }
        return first.children.map { $0["text"]?.stringValue ?? "" }.joined()
    }

    /// Every block after the title (`extractBodyContent`), always at least
    /// one paragraph — the minimum a valid Tiptap document needs.
    static func bodyDocument(_ content: JSONValue?) -> JSONValue {
        let blocks = content?.children ?? []
        let body = isTitleBlock(blocks.first) ? Array(blocks.dropFirst()) : blocks
        return .node("doc", content: body.isEmpty ? [emptyParagraph] : body)
    }

    /// Reassembles the full document from a plain-text title and a body
    /// document (`buildContentFromTitleAndBody`).
    static func document(title: String, body: JSONValue) -> JSONValue {
        let titleBlock: JSONValue = title.isEmpty
            ? .node("paragraph")
            : .node("paragraph", content: [.object(["type": .string("text"), "text": .string(title)])])
        return .node("doc", content: [titleBlock] + body.children)
    }

    /// Builds a `data:` URL for an image file the same way the browser's
    /// `FileReader.readAsDataURL` does for a dropped JPEG.
    static func dataURL(forJPEGAt url: URL) throws -> String {
        let data = try Data(contentsOf: url)
        guard data.count <= maxImageBytes else { throw ImageDropError.tooLarge }
        return "data:image/jpeg;base64," + data.base64EncodedString()
    }

    enum ImageDropError: LocalizedError {
        case tooLarge
        var errorDescription: String? { "Image too large to embed (max 8MB)." }
    }
}
