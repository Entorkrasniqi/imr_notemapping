import AppKit

/// Converts between a Tiptap document (`JSONValue`) and the attributed
/// text the native editor works on.
///
/// This is the piece that lets both clients edit the same notes: whatever
/// the native editor writes back has to be a document the web app's
/// Tiptap schema (`lib/editor/extensions.ts`) accepts and renders the same
/// way. So the export side mirrors Tiptap's own `getJSON()` output — same
/// node shapes, same always-present attrs, same mark order — and repairs
/// anything the schema would reject (a list item must start with a
/// paragraph, a document needs at least one block). Nodes this editor has
/// no UI for (tables, task lists, …) are carried through untouched as
/// atoms rather than dropped.
enum TiptapConverter {
    struct Imported {
        let text: NSAttributedString
        /// The block style of an empty last paragraph — it has no
        /// characters to carry an attribute, so it travels separately.
        let trailingBlock: BlockStyle?
    }

    // MARK: - Import

    private struct ParagraphDraft {
        var content = NSMutableAttributedString()
        var block: BlockStyle
        var lastMarks: InlineMarks = .plain
    }

    static func importDocument(_ doc: JSONValue, context: TextStyleContext) -> Imported {
        var paragraphs: [ParagraphDraft] = []
        importBlocks(doc.children, containers: [], firstStartsItem: false, into: &paragraphs, context: context)
        if paragraphs.isEmpty { paragraphs.append(ParagraphDraft(block: .paragraph)) }

        let result = NSMutableAttributedString()
        for (index, paragraph) in paragraphs.enumerated() {
            result.append(paragraph.content)
            if index < paragraphs.count - 1 {
                let terminator = TextStyler.attributes(marks: paragraph.lastMarks, block: paragraph.block, context: context)
                result.append(NSAttributedString(string: "\n", attributes: terminator))
            }
        }
        TextStyler.clearLineBreakBackgrounds(result, in: NSRange(location: 0, length: result.length))
        let last = paragraphs[paragraphs.count - 1]
        return Imported(text: result, trailingBlock: last.content.length == 0 ? last.block : nil)
    }

    private static func importBlocks(_ blocks: [JSONValue], containers: [BlockContainer], firstStartsItem: Bool,
                                     into paragraphs: inout [ParagraphDraft], context: TextStyleContext) {
        for (index, block) in blocks.enumerated() {
            let startsItem = firstStartsItem && index == 0
            switch block.nodeType {
            case "paragraph":
                let style = BlockStyle(kind: .paragraph, attrs: block.attrs, containers: containers, startsItem: startsItem)
                paragraphs.append(textblock(block.children, style: style, context: context))

            case "heading":
                let level = block.attrs["level"]?.intValue ?? 1
                let style = BlockStyle(kind: .heading(level), attrs: block.attrs, containers: containers, startsItem: startsItem)
                paragraphs.append(textblock(block.children, style: style, context: context))

            case "codeBlock":
                let text = block.children.compactMap { $0["text"]?.stringValue }.joined()
                let group = UUID()
                for (lineIndex, line) in text.components(separatedBy: "\n").enumerated() {
                    let style = BlockStyle(kind: .codeLine(group), attrs: block.attrs, containers: containers,
                                           startsItem: startsItem && lineIndex == 0)
                    let draft = ParagraphDraft(block: style)
                    draft.content.append(NSAttributedString(
                        string: line, attributes: TextStyler.attributes(marks: .plain, block: style, context: context)))
                    paragraphs.append(draft)
                }

            case "bulletList", "orderedList":
                let kind: BlockContainer.Kind = block.nodeType == "bulletList" ? .bulletList : .orderedList
                let container = BlockContainer(kind: kind, id: UUID(), attrs: block.attrs)
                for item in block.children {
                    let itemBlocks = item.nodeType == "listItem" ? item.children : [item]
                    importBlocks(itemBlocks.isEmpty ? [NoteContent.emptyParagraph] : itemBlocks,
                                 containers: containers + [container], firstStartsItem: true,
                                 into: &paragraphs, context: context)
                }

            case "blockquote":
                let container = BlockContainer(kind: .blockquote, id: UUID(), attrs: block.attrs)
                let children = block.children.isEmpty ? [NoteContent.emptyParagraph] : block.children
                importBlocks(children, containers: containers + [container], firstStartsItem: false,
                             into: &paragraphs, context: context)

            default:
                let kind: AtomBox.Kind
                switch block.nodeType {
                case "image": kind = .image
                case "horizontalRule": kind = .horizontalRule
                default: kind = .opaqueBlock
                }
                let style = BlockStyle(kind: .paragraph, attrs: ["textAlign": .null], containers: containers, startsItem: startsItem)
                let draft = ParagraphDraft(block: style)
                draft.content.append(atomString(AtomBox(kind: kind, json: block), block: style, context: context))
                paragraphs.append(draft)
            }
        }
    }

    private static func textblock(_ inline: [JSONValue], style: BlockStyle, context: TextStyleContext) -> ParagraphDraft {
        var draft = ParagraphDraft(block: style)
        for node in inline {
            switch node.nodeType {
            case "text":
                let marks = InlineMarks(json: node["marks"]?.arrayValue ?? [])
                let text = node["text"]?.stringValue ?? ""
                draft.content.append(NSAttributedString(
                    string: text, attributes: TextStyler.attributes(marks: marks, block: style, context: context)))
                draft.lastMarks = marks
            case "hardBreak":
                draft.content.append(NSAttributedString(
                    string: "\u{2028}", attributes: TextStyler.attributes(marks: draft.lastMarks, block: style, context: context)))
            default:
                draft.content.append(atomString(AtomBox(kind: .opaqueInline, json: node), block: style, context: context))
            }
        }
        return draft
    }

    /// One attachment character carrying `box`.
    static func atomString(_ box: AtomBox, block: BlockStyle, context: TextStyleContext) -> NSAttributedString {
        let attachment = NSTextAttachment()
        attachment.attachmentCell = AtomAttachmentCell(box: box, tint: context.textColor)
        var attributes = TextStyler.attributes(marks: .plain, block: block, context: context)
        attributes[.attachment] = attachment
        attributes[.noteAtom] = box
        return NSAttributedString(string: "\u{FFFC}", attributes: attributes)
    }

    // MARK: - Export

    private struct Entry {
        enum Node {
            case textblock(JSONValue)
            case codeLine(group: UUID, attrs: [String: JSONValue], text: String)
            case atom(JSONValue)
        }

        let node: Node
        let containers: [BlockContainer]
        let startsItem: Bool
    }

    static func exportDocument(_ text: NSAttributedString, trailingBlock: BlockStyle?) -> JSONValue {
        let entries = flatten(text, trailingBlock: trailingBlock)
        let blocks = buildBlocks(entries[...], depth: 0)
        return .node("doc", content: blocks.isEmpty ? [defaultParagraph] : blocks)
    }

    private static var defaultParagraph: JSONValue { .node("paragraph", attrs: ["textAlign": .null]) }

    /// Text → one entry per paragraph (or per atom inside one).
    private static func flatten(_ text: NSAttributedString, trailingBlock: BlockStyle?) -> [Entry] {
        let string = text.string as NSString
        var entries: [Entry] = []
        var location = 0
        while true {
            let newline = string.range(of: "\n", options: [], range: NSRange(location: location, length: string.length - location))
            let hasTerminator = newline.location != NSNotFound
            let end = hasTerminator ? newline.location : string.length
            let contentRange = NSRange(location: location, length: end - location)

            let block: BlockStyle
            if contentRange.length > 0 {
                block = text.attribute(.noteBlock, at: location, effectiveRange: nil) as? BlockStyle ?? .paragraph
            } else if hasTerminator {
                block = text.attribute(.noteBlock, at: end, effectiveRange: nil) as? BlockStyle ?? .paragraph
            } else {
                block = trailingBlock ?? .paragraph
            }
            appendEntries(for: contentRange, block: block, in: text, to: &entries)

            guard hasTerminator else { break }
            location = end + 1
        }
        return entries
    }

    private static func appendEntries(for range: NSRange, block: BlockStyle, in text: NSAttributedString, to entries: inout [Entry]) {
        let string = text.string as NSString

        if case .codeLine(let group) = block.kind {
            // Code is plain text in Tiptap's schema — marks and atoms dropped.
            let line = string.substring(with: range).replacingOccurrences(of: "\u{FFFC}", with: "")
                .replacingOccurrences(of: "\u{2028}", with: "\n")
            entries.append(Entry(node: .codeLine(group: group, attrs: block.attrs, text: line),
                                 containers: block.containers, startsItem: block.startsItem))
            return
        }

        var inline: [JSONValue] = []
        var lastTextMarks: InlineMarks?
        var startsItem = block.startsItem
        var emittedAtom = false

        func flushTextblock() {
            entries.append(Entry(node: .textblock(textblockJSON(block, inline: inline)),
                                 containers: block.containers, startsItem: startsItem))
            startsItem = false
            inline = []
            lastTextMarks = nil
        }

        func appendText(_ piece: String, marks: InlineMarks) {
            if let lastTextMarks, lastTextMarks == marks, case .object(var previous) = inline[inline.count - 1],
               let previousText = previous["text"]?.stringValue {
                previous["text"] = .string(previousText + piece)
                inline[inline.count - 1] = .object(previous)
                return
            }
            var node: [String: JSONValue] = ["type": .string("text"), "text": .string(piece)]
            let marksJSON = marks.json
            if !marksJSON.isEmpty { node["marks"] = .array(marksJSON) }
            inline.append(.object(node))
            lastTextMarks = marks
        }

        text.enumerateAttributes(in: range) { attributes, subrange, _ in
            if let atom = attributes[.noteAtom] as? AtomBox {
                for _ in 0..<subrange.length {
                    if atom.isBlock {
                        if !inline.isEmpty { flushTextblock() }
                        entries.append(Entry(node: .atom(atom.json), containers: block.containers, startsItem: startsItem))
                        startsItem = false
                        emittedAtom = true
                    } else {
                        inline.append(atom.json)
                        lastTextMarks = nil
                    }
                }
                return
            }
            // A foreign attachment (e.g. from an RTFD paste) has no Tiptap equivalent.
            if attributes[.attachment] != nil { return }

            let marks = attributes[.noteMarks] as? InlineMarks ?? .plain
            let piece = string.substring(with: subrange).replacingOccurrences(of: "\u{FFFC}", with: "")
            for (index, segment) in piece.components(separatedBy: "\u{2028}").enumerated() {
                if index > 0 {
                    inline.append(.node("hardBreak"))
                    lastTextMarks = nil
                }
                if !segment.isEmpty { appendText(segment, marks: marks) }
            }
        }

        if !inline.isEmpty || !emittedAtom { flushTextblock() }
    }

    private static func textblockJSON(_ block: BlockStyle, inline: [JSONValue]) -> JSONValue {
        var attrs = block.attrs
        if attrs["textAlign"] == nil { attrs["textAlign"] = .null }
        switch block.kind {
        case .heading(let level):
            attrs["level"] = .int(level)
            return .node("heading", attrs: attrs, content: inline)
        default:
            attrs["level"] = nil
            return .node("paragraph", attrs: attrs, content: inline)
        }
    }

    /// Rebuilds the nested tree from flat entries. A run of consecutive
    /// entries sharing a container id at `depth` becomes that container's
    /// node; within a list, an entry whose innermost container is this
    /// list and that `startsItem` begins the next `listItem`.
    private static func buildBlocks(_ entries: ArraySlice<Entry>, depth: Int) -> [JSONValue] {
        var blocks: [JSONValue] = []
        var index = entries.startIndex
        while index < entries.endIndex {
            let entry = entries[index]

            if entry.containers.count <= depth {
                switch entry.node {
                case .textblock(let json), .atom(let json):
                    blocks.append(json)
                    index += 1
                case .codeLine(let group, let attrs, _):
                    var lines: [String] = []
                    var next = index
                    while next < entries.endIndex, entries[next].containers.count <= depth,
                          case .codeLine(let otherGroup, _, let line) = entries[next].node, otherGroup == group {
                        lines.append(line)
                        next += 1
                    }
                    let text = lines.joined(separator: "\n")
                    let content: [JSONValue] = text.isEmpty ? [] : [.object(["type": .string("text"), "text": .string(text)])]
                    blocks.append(.node("codeBlock", attrs: attrs.isEmpty ? ["language": .null] : attrs, content: content))
                    index = next
                }
                continue
            }

            let container = entry.containers[depth]
            var end = index + 1
            while end < entries.endIndex, entries[end].containers.count > depth,
                  entries[end].containers[depth].id == container.id {
                end += 1
            }
            let run = entries[index..<end]

            switch container.kind {
            case .blockquote:
                blocks.append(.node("blockquote", attrs: container.attrs.isEmpty ? nil : container.attrs,
                                    content: buildBlocks(run, depth: depth + 1)))
            case .bulletList, .orderedList:
                var items: [JSONValue] = []
                var itemStart = run.startIndex
                for position in (run.startIndex + 1)...run.endIndex {
                    let isBoundary = position == run.endIndex
                        || (run[position].containers.count == depth + 1 && run[position].startsItem)
                    guard isBoundary else { continue }
                    var content = buildBlocks(run[itemStart..<position], depth: depth + 1)
                    // Tiptap's `listItem` is `paragraph block*`.
                    if content.first?.nodeType != "paragraph" { content.insert(defaultParagraph, at: 0) }
                    items.append(.node("listItem", content: content))
                    itemStart = position
                }
                let type = container.kind == .bulletList ? "bulletList" : "orderedList"
                let attrs = container.attrs.isEmpty && container.kind == .orderedList
                    ? BlockContainer.defaultAttrs(for: .orderedList) : container.attrs
                blocks.append(.node(type, attrs: attrs.isEmpty ? nil : attrs, content: items))
            }
            index = end
        }
        return blocks
    }
}

/// Draws an atom inside the editor: the image itself, a horizontal rule,
/// or a labelled placeholder for content this editor can't show.
final class AtomAttachmentCell: NSTextAttachmentCell {
    let box: AtomBox
    var tint: NSColor
    private let decodedImage: NSImage?

    init(box: AtomBox, tint: NSColor) {
        self.box = box
        self.tint = tint
        self.decodedImage = box.kind == .image ? ImageDecoding.image(fromSource: box.json.attrs["src"]?.stringValue) : nil
        super.init(imageCell: nil)
    }

    required init(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    private var placeholderLabel: String {
        switch box.kind {
        case .image: return "Image"
        default: return "Unsupported content (\(box.json.nodeType ?? "unknown"))"
        }
    }

    override func cellSize() -> NSSize {
        if let decodedImage { return decodedImage.size }
        return NSSize(width: 220, height: 24)
    }

    override func cellFrame(for textContainer: NSTextContainer, proposedLineFragment lineFrag: NSRect,
                            glyphPosition position: NSPoint, characterIndex charIndex: Int) -> NSRect {
        let available = max(lineFrag.width - position.x - textContainer.lineFragmentPadding * 2, 40)
        switch box.kind {
        case .horizontalRule:
            return NSRect(x: 0, y: 0, width: available, height: 17)
        case .image where decodedImage != nil:
            let size = decodedImage!.size
            let scale = min(1, available / max(size.width, 1))
            return NSRect(x: 0, y: 0, width: size.width * scale, height: size.height * scale)
        default:
            let label = placeholderLabel as NSString
            let width = label.size(withAttributes: [.font: NSFont.systemFont(ofSize: 12)]).width + 20
            return NSRect(x: 0, y: -4, width: min(width, available), height: 24)
        }
    }

    override func draw(withFrame cellFrame: NSRect, in controlView: NSView?) {
        switch box.kind {
        case .horizontalRule:
            tint.withAlphaComponent(0.35).setFill()
            NSRect(x: cellFrame.minX, y: cellFrame.midY.rounded(), width: cellFrame.width, height: 1).fill()
        case .image where decodedImage != nil:
            decodedImage!.draw(in: cellFrame, from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: nil)
        default:
            let path = NSBezierPath(roundedRect: cellFrame.insetBy(dx: 0.5, dy: 0.5), xRadius: 5, yRadius: 5)
            tint.withAlphaComponent(0.08).setFill()
            path.fill()
            tint.withAlphaComponent(0.25).setStroke()
            path.stroke()
            let attributes: [NSAttributedString.Key: Any] = [
                .font: NSFont.systemFont(ofSize: 12),
                .foregroundColor: tint.withAlphaComponent(0.6),
            ]
            (placeholderLabel as NSString).draw(
                in: cellFrame.insetBy(dx: 10, dy: 4), withAttributes: attributes)
        }
    }

    override func cellBaselineOffset() -> NSPoint { .zero }
    override func wantsToTrackMouse() -> Bool { false }
}

/// Decodes an image node's `src`. Only `data:` URLs are decoded — that's
/// how the web app embeds dropped images; a remote URL just shows the
/// placeholder rather than having the editor fetch arbitrary content.
enum ImageDecoding {
    private static let cache = NSCache<NSString, NSImage>()

    static func image(fromSource source: String?) -> NSImage? {
        guard let source, source.hasPrefix("data:"), let comma = source.firstIndex(of: ",") else { return nil }
        // Cheap cache key: the length plus both ends of the payload.
        let key = "\(source.count):\(source.prefix(96)):\(source.suffix(64))" as NSString
        if let cached = cache.object(forKey: key) { return cached }

        let header = source[..<comma]
        let payload = source[source.index(after: comma)...]
        guard header.hasSuffix(";base64"),
              let data = Data(base64Encoded: String(payload), options: .ignoreUnknownCharacters),
              let image = NSImage(data: data)
        else { return nil }
        cache.setObject(image, forKey: key)
        return image
    }
}
