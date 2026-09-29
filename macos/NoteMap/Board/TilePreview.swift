import AppKit

/// What a note's canvas tile shows: only its first block, as a title line
/// — the web app's `NotePreview` (NoteNode.tsx). The full body is only
/// ever shown in the editor.
enum TileContent {
    /// Nothing typed yet — "Type something…".
    case placeholder
    case text(NSAttributedString)
    case image(NSImage?)
}

struct TileRender {
    let revision: Int
    let content: TileContent
    /// More than one block — shows the small "···" hint.
    let hasMore: Bool
}

enum TilePreview {
    static func render(_ content: JSONValue?, revision: Int, theme: Theme) -> TileRender {
        let blocks = content?.children ?? []
        let hasMore = blocks.count > 1
        guard let first = blocks.first, !(first.nodeType == "paragraph" && first.children.isEmpty) else {
            return TileRender(revision: revision, content: .placeholder, hasMore: hasMore)
        }
        if first.nodeType == "image" {
            let image = ImageDecoding.image(fromSource: first.attrs["src"]?.stringValue)
            return TileRender(revision: revision, content: .image(image), hasMore: hasMore)
        }
        guard let textblock = firstTextblock(in: first) else {
            return TileRender(revision: revision, content: .text(NSAttributedString()), hasMore: hasMore)
        }

        let imported = TiptapConverter.importDocument(.node("doc", content: [textblock]), context: .tile(theme))
        let line = NSMutableAttributedString(attributedString: imported.text)
        // One line only, as `white-space: nowrap` does on the web tile.
        let string = line.string as NSString
        var searchStart = 0
        while true {
            let found = string.range(of: "\u{2028}", options: [], range: NSRange(location: searchStart, length: string.length - searchStart))
            guard found.location != NSNotFound else { break }
            line.replaceCharacters(in: found, with: " ")
            searchStart = found.location + 1
        }
        return TileRender(revision: revision, content: .text(line), hasMore: hasMore)
    }

    /// The first paragraph/heading inside a list, blockquote, etc.
    private static func firstTextblock(in node: JSONValue) -> JSONValue? {
        switch node.nodeType {
        case "paragraph", "heading": return node
        case "codeBlock":
            let text = node.children.compactMap { $0["text"]?.stringValue }.joined()
            let firstLine = text.components(separatedBy: "\n").first ?? ""
            return .node("paragraph", content: firstLine.isEmpty ? [] : [.object(["type": .string("text"), "text": .string(firstLine)])])
        default:
            for child in node.children {
                if let found = firstTextblock(in: child) { return found }
            }
            return nil
        }
    }
}
