import AppKit

// How a note's rich text is represented inside AppKit's text system.
//
// Every character carries *semantic* attributes — `InlineMarks` (the
// Tiptap marks on it) and `BlockStyle` (the Tiptap block it belongs to) —
// and those are the source of truth. Fonts, colors, and paragraph styles
// are derived from them by `TextStyler`, never the other way round, which
// is what makes converting back to Tiptap JSON exact rather than a guess
// from whatever font a run happens to be drawn in.

extension NSAttributedString.Key {
    static let noteMarks = NSAttributedString.Key("NoteMapMarks")
    static let noteBlock = NSAttributedString.Key("NoteMapBlock")
    /// A non-text node — image, horizontal rule, or anything this app
    /// doesn't know how to edit — carried by one attachment character.
    static let noteAtom = NSAttributedString.Key("NoteMapAtom")
}

/// The Tiptap marks on a run of text. Immutable; an `NSObject` so AppKit
/// can compare runs with `isEqual:` when coalescing attributes.
final class InlineMarks: NSObject {
    let bold: Bool
    let italic: Bool
    let underline: Bool
    let strike: Bool
    let code: Bool
    /// The whole `link` mark, kept verbatim (links render as plain text in
    /// the web app too — Tailwind's reset strips anchor styling).
    let link: JSONValue?
    /// Non-null `textStyle` attrs: `color`, `fontFamily`, `fontSize`, …
    let textStyle: [String: JSONValue]
    /// Non-null `highlight` attrs when highlighted, `nil` when not.
    let highlight: [String: JSONValue]?
    /// Marks this app doesn't handle, preserved as-is.
    let others: [JSONValue]

    static let plain = InlineMarks()

    init(bold: Bool = false, italic: Bool = false, underline: Bool = false, strike: Bool = false,
         code: Bool = false, link: JSONValue? = nil, textStyle: [String: JSONValue] = [:],
         highlight: [String: JSONValue]? = nil, others: [JSONValue] = []) {
        self.bold = bold
        self.italic = italic
        self.underline = underline
        self.strike = strike
        self.code = code
        self.link = link
        self.textStyle = textStyle
        self.highlight = highlight
        self.others = others
    }

    var color: String? { textStyle["color"]?.stringValue }
    var fontFamily: String? { textStyle["fontFamily"]?.stringValue }
    var fontSize: String? { textStyle["fontSize"]?.stringValue }
    var isHighlighted: Bool { highlight != nil }
    var highlightColor: String? { highlight?["color"]?.stringValue }

    func with(bold: Bool? = nil, italic: Bool? = nil, underline: Bool? = nil) -> InlineMarks {
        InlineMarks(bold: bold ?? self.bold, italic: italic ?? self.italic, underline: underline ?? self.underline,
                    strike: strike, code: code, link: link, textStyle: textStyle, highlight: highlight, others: others)
    }

    /// Sets (or with `nil`, clears) one `textStyle` attribute.
    func withTextStyle(_ key: String, _ value: String?) -> InlineMarks {
        var style = textStyle
        style[key] = value.map(JSONValue.string)
        return InlineMarks(bold: bold, italic: italic, underline: underline, strike: strike, code: code,
                           link: link, textStyle: style, highlight: highlight, others: others)
    }

    func withHighlight(_ color: String?, enabled: Bool) -> InlineMarks {
        let highlight: [String: JSONValue]? = enabled ? (color.map { ["color": .string($0)] } ?? [:]) : nil
        return InlineMarks(bold: bold, italic: italic, underline: underline, strike: strike, code: code,
                           link: link, textStyle: textStyle, highlight: highlight, others: others)
    }

    convenience init(json marks: [JSONValue]) {
        var bold = false, italic = false, underline = false, strike = false, code = false
        var link: JSONValue?
        var textStyle: [String: JSONValue] = [:]
        var highlight: [String: JSONValue]?
        var others: [JSONValue] = []
        for mark in marks {
            switch mark.nodeType {
            case "bold": bold = true
            case "italic": italic = true
            case "underline": underline = true
            case "strike": strike = true
            case "code": code = true
            case "link": link = mark
            case "textStyle":
                for (key, value) in mark.attrs where !value.isNull { textStyle[key] = value }
            case "highlight": highlight = mark.attrs.filter { !$0.value.isNull }
            default: others.append(mark)
            }
        }
        self.init(bold: bold, italic: italic, underline: underline, strike: strike, code: code,
                  link: link, textStyle: textStyle, highlight: highlight, others: others)
    }

    /// Back to Tiptap's JSON, in Tiptap's own schema order (link, textStyle,
    /// bold, code, italic, strike, underline, highlight) and with the same
    /// always-present attrs, so an unedited note round-trips byte-for-byte.
    var json: [JSONValue] {
        var marks: [JSONValue] = []
        if let link { marks.append(link) }
        if !textStyle.isEmpty {
            var attrs: [String: JSONValue] = ["color": .null, "fontSize": .null, "fontFamily": .null]
            attrs.merge(textStyle) { _, new in new }
            marks.append(.node("textStyle", attrs: attrs))
        }
        if bold { marks.append(.node("bold")) }
        if code { marks.append(.node("code")) }
        if italic { marks.append(.node("italic")) }
        if strike { marks.append(.node("strike")) }
        if underline { marks.append(.node("underline")) }
        if let highlight {
            var attrs: [String: JSONValue] = ["color": .null]
            attrs.merge(highlight) { _, new in new }
            marks.append(.node("highlight", attrs: attrs))
        }
        return marks + others
    }

    override func isEqual(_ object: Any?) -> Bool {
        guard let other = object as? InlineMarks else { return false }
        return bold == other.bold && italic == other.italic && underline == other.underline
            && strike == other.strike && code == other.code && link == other.link
            && textStyle == other.textStyle && highlight == other.highlight && others == other.others
    }

    override var hash: Int {
        var hasher = Hasher()
        hasher.combine(bold); hasher.combine(italic); hasher.combine(underline)
        hasher.combine(strike); hasher.combine(code); hasher.combine(textStyle)
        return hasher.finalize()
    }
}

/// A list or blockquote a paragraph sits inside. Paragraphs sharing a
/// container `id` belong to the same list/blockquote node.
struct BlockContainer: Hashable {
    enum Kind: Hashable { case bulletList, orderedList, blockquote }

    var kind: Kind
    var id: UUID
    var attrs: [String: JSONValue]

    var isList: Bool { kind != .blockquote }

    static func list(_ kind: Kind) -> BlockContainer {
        BlockContainer(kind: kind, id: UUID(), attrs: defaultAttrs(for: kind))
    }

    static func defaultAttrs(for kind: Kind) -> [String: JSONValue] {
        kind == .orderedList ? ["start": .int(1), "type": .null] : [:]
    }
}

/// The Tiptap block a paragraph of text represents. The document tree is
/// flattened into paragraphs: nesting lives in `containers` (outermost
/// first), and `startsItem` marks a paragraph that begins a new list item
/// in its innermost list — everything `TiptapConverter` needs to rebuild
/// the exact tree on the way back out.
final class BlockStyle: NSObject {
    enum Kind: Hashable {
        case paragraph
        case heading(Int)
        /// One line of a code block; lines sharing the id form one block.
        case codeLine(UUID)
    }

    let kind: Kind
    let attrs: [String: JSONValue]
    let containers: [BlockContainer]
    let startsItem: Bool

    init(kind: Kind, attrs: [String: JSONValue], containers: [BlockContainer] = [], startsItem: Bool = false) {
        self.kind = kind
        self.attrs = attrs
        self.containers = containers
        self.startsItem = startsItem
    }

    static let paragraph = BlockStyle(kind: .paragraph, attrs: ["textAlign": .null])

    var textAlign: String? { attrs["textAlign"]?.stringValue }
    var isCode: Bool { if case .codeLine = kind { return true } else { return false } }
    var headingLevel: Int? { if case .heading(let level) = kind { return level } else { return nil } }
    var innermostList: BlockContainer? { containers.last.flatMap { $0.isList ? $0 : nil } }
    var isListItemStart: Bool { startsItem && innermostList != nil }
    var listDepth: Int { containers.filter(\.isList).count }

    /// Left indent: 20pt per list level (the web's `padding-left: 1.25rem`
    /// on `ul`/`ol`) and 16pt per blockquote.
    var indentation: CGFloat {
        containers.reduce(0) { $0 + ($1.isList ? 20 : 16) }
    }

    func with(kind: Kind? = nil, attrs: [String: JSONValue]? = nil,
              containers: [BlockContainer]? = nil, startsItem: Bool? = nil) -> BlockStyle {
        BlockStyle(kind: kind ?? self.kind, attrs: attrs ?? self.attrs,
                   containers: containers ?? self.containers, startsItem: startsItem ?? self.startsItem)
    }

    /// Converts to a plain paragraph or heading, keeping alignment — what
    /// Tiptap's `setParagraph`/`toggleHeading` do to the node's attrs.
    func asTextblock(_ kind: Kind) -> BlockStyle {
        var newAttrs: [String: JSONValue] = ["textAlign": attrs["textAlign"] ?? .null]
        if case .heading(let level) = kind { newAttrs["level"] = .int(level) }
        return with(kind: kind, attrs: newAttrs)
    }

    override func isEqual(_ object: Any?) -> Bool {
        guard let other = object as? BlockStyle else { return false }
        return kind == other.kind && attrs == other.attrs && containers == other.containers && startsItem == other.startsItem
    }

    override var hash: Int {
        var hasher = Hasher()
        hasher.combine(kind); hasher.combine(containers.count); hasher.combine(startsItem)
        return hasher.finalize()
    }
}

/// An image, horizontal rule, or unsupported node, kept as its original
/// JSON. Compared by identity: two atoms are never "the same run".
final class AtomBox: NSObject {
    enum Kind { case image, horizontalRule, opaqueBlock, opaqueInline }

    let kind: Kind
    let json: JSONValue

    init(kind: Kind, json: JSONValue) {
        self.kind = kind
        self.json = json
    }

    var isBlock: Bool { kind != .opaqueInline }

    override func isEqual(_ object: Any?) -> Bool { self === (object as AnyObject?) }
    override var hash: Int { ObjectIdentifier(self).hashValue }
}

/// What the derived attributes depend on besides the semantic ones.
struct TextStyleContext {
    var baseFontSize: CGFloat
    var textColor: NSColor
    var palette: ThemePalette
    /// The canvas tile's title line: everything bold at 1.2em, one line —
    /// the `.prose-note.tiptap > *:first-child` rule in globals.css.
    var isTitleLine = false

    static func editor(_ theme: Theme) -> TextStyleContext {
        TextStyleContext(baseFontSize: 16, textColor: theme.palette.editorText, palette: theme.palette)
    }

    static func tile(_ theme: Theme) -> TextStyleContext {
        TextStyleContext(baseFontSize: 14, textColor: theme.palette.noteText, palette: theme.palette, isTitleLine: true)
    }
}

enum TextStyler {
    /// The web app's heading sizes (`.prose-note.tiptap h1/h2/h3`).
    static func headingScale(_ level: Int) -> CGFloat {
        switch level {
        case 1: return 1.375
        case 2: return 1.2
        case 3: return 1.05
        default: return 1
        }
    }

    static func attributes(marks: InlineMarks, block: BlockStyle, context: TextStyleContext) -> [NSAttributedString.Key: Any] {
        var attributes: [NSAttributedString.Key: Any] = [
            .noteMarks: marks,
            .noteBlock: block,
            .font: font(marks: marks, block: block, context: context),
            .paragraphStyle: paragraphStyle(block: block, context: context),
        ]
        // A `<mark>` without a color falls back to the browser's default
        // yellow-with-black-text; with a color, Tiptap renders it as
        // `background-color: …; color: inherit`.
        let defaultColor = marks.isHighlighted && marks.highlightColor == nil ? NSColor.black : context.textColor
        attributes[.foregroundColor] = CSSColor.parse(marks.color) ?? defaultColor
        if marks.isHighlighted {
            attributes[.backgroundColor] = CSSColor.parse(marks.highlightColor) ?? NSColor(hex: 0xffff00)
        }
        if marks.underline { attributes[.underlineStyle] = NSUnderlineStyle.single.rawValue }
        if marks.strike { attributes[.strikethroughStyle] = NSUnderlineStyle.single.rawValue }
        return attributes
    }

    static func typingAttributes(marks: InlineMarks, block: BlockStyle, context: TextStyleContext) -> [NSAttributedString.Key: Any] {
        attributes(marks: marks, block: block, context: context)
    }

    /// Re-derives display attributes from the semantic ones across `range`
    /// — run after anything changes marks or blocks, or the theme.
    static func restyle(_ storage: NSMutableAttributedString, range: NSRange, context: TextStyleContext) {
        guard range.length > 0 else { return }
        storage.enumerateAttributes(in: range) { existing, subrange, _ in
            let marks = existing[.noteMarks] as? InlineMarks ?? .plain
            let block = existing[.noteBlock] as? BlockStyle ?? .paragraph
            var derived = attributes(marks: marks, block: block, context: context)
            if let atom = existing[.noteAtom] { derived[.noteAtom] = atom }
            if let attachment = existing[.attachment] as? NSTextAttachment {
                derived[.attachment] = attachment
                (attachment.attachmentCell as? AtomAttachmentCell)?.tint = context.textColor
            }
            storage.setAttributes(derived, range: subrange)
        }
        clearLineBreakBackgrounds(storage, in: range)
    }

    private static let lineBreaks = CharacterSet(charactersIn: "\n\u{2028}")

    /// TextKit paints a line break's background color all the way to the
    /// end of the line, so a highlight that runs up to the end of a
    /// paragraph would fill the whole width. Only the display attribute is
    /// removed — the semantic marks (and so the saved note) are untouched.
    static func clearLineBreakBackgrounds(_ storage: NSMutableAttributedString, in range: NSRange) {
        let string = storage.string as NSString
        let end = min(NSMaxRange(range), string.length)
        var location = range.location
        while location < end {
            let found = string.rangeOfCharacter(from: lineBreaks, options: [], range: NSRange(location: location, length: end - location))
            guard found.location != NSNotFound else { break }
            if storage.attribute(.backgroundColor, at: found.location, effectiveRange: nil) != nil {
                storage.removeAttribute(.backgroundColor, range: found)
            }
            location = NSMaxRange(found)
        }
    }

    static func font(marks: InlineMarks, block: BlockStyle, context: TextStyleContext) -> NSFont {
        var size = context.baseFontSize
        var weight = NSFont.Weight.regular
        if context.isTitleLine {
            size *= 1.2
            weight = .bold
        } else if let level = block.headingLevel {
            size *= headingScale(level)
            weight = .semibold
        }
        if let explicit = cssLength(marks.fontSize, relativeTo: size) { size = explicit }
        if marks.bold { weight = .bold }
        let monospace = marks.code || block.isCode
        return FontCache.font(family: monospace ? nil : marks.fontFamily, monospace: monospace,
                              size: size, weight: weight, italic: marks.italic)
    }

    static func paragraphStyle(block: BlockStyle, context: TextStyleContext) -> NSParagraphStyle {
        let style = NSMutableParagraphStyle()
        switch block.textAlign {
        case "center": style.alignment = .center
        case "right": style.alignment = .right
        case "justify": style.alignment = .justified
        case "left": style.alignment = .left
        default: style.alignment = context.isTitleLine ? .center : .natural
        }
        if context.isTitleLine {
            style.lineBreakMode = .byTruncatingTail
            return style
        }
        style.firstLineHeadIndent = block.indentation
        style.headIndent = block.indentation
        let base = context.baseFontSize
        switch block.kind {
        case .heading(let level):
            style.lineHeightMultiple = 1.1
            style.paragraphSpacingBefore = base * headingScale(level) * 0.6
            style.paragraphSpacing = base * 0.3
        case .codeLine:
            style.lineHeightMultiple = 1.2
        case .paragraph:
            style.lineHeightMultiple = 1.25
            style.paragraphSpacing = base * 0.35
        }
        return style
    }

    /// `"18px"`, `"1.2em"`, `"12pt"`, `"1rem"` → points (CSS px ≈ macOS pt).
    static func cssLength(_ value: String?, relativeTo parent: CGFloat) -> CGFloat? {
        guard let value = value?.trimmingCharacters(in: .whitespaces).lowercased(), !value.isEmpty else { return nil }
        let number = value.prefix { $0.isNumber || $0 == "." }
        guard let amount = Double(number), amount > 0 else { return nil }
        let unit = value.dropFirst(number.count)
        let points: Double
        switch unit {
        case "em": points = amount * Double(parent)
        case "rem": points = amount * 16
        case "pt": points = amount * 4 / 3
        default: points = amount
        }
        return CGFloat(min(max(points, 1), 400))
    }
}

/// Font lookup for the text styles above, cached — resolving a CSS font
/// stack through `NSFontManager` is too slow to repeat for every run.
enum FontCache {
    private struct Key: Hashable {
        let family: String?
        let monospace: Bool
        let size: CGFloat
        let weight: CGFloat
        let italic: Bool
    }

    private static var cache: [Key: NSFont] = [:]

    static func font(family: String?, monospace: Bool, size: CGFloat, weight: NSFont.Weight, italic: Bool) -> NSFont {
        let key = Key(family: family, monospace: monospace, size: size, weight: weight.rawValue, italic: italic)
        if let cached = cache[key] { return cached }

        var font: NSFont
        if monospace {
            font = NSFont.monospacedSystemFont(ofSize: size, weight: weight)
        } else if let family, let resolved = resolve(cssFamily: family, size: size, weight: weight) {
            font = resolved
        } else {
            font = NSFont.systemFont(ofSize: size, weight: weight)
        }
        if italic {
            let descriptor = font.fontDescriptor.withSymbolicTraits(font.fontDescriptor.symbolicTraits.union(.italic))
            font = NSFont(descriptor: descriptor, size: size) ?? NSFontManager.shared.convert(font, toHaveTrait: .italicFontMask)
        }
        cache[key] = font
        return font
    }

    /// First installed family from a CSS stack like
    /// `Georgia, 'Times New Roman', Times, serif`.
    private static func resolve(cssFamily: String, size: CGFloat, weight: NSFont.Weight) -> NSFont? {
        let traits: NSFontTraitMask = weight >= .semibold ? .boldFontMask : []
        for rawName in cssFamily.split(separator: ",") {
            var name = rawName.trimmingCharacters(in: CharacterSet(charactersIn: " '\""))
            switch name.lowercased() {
            case "sans-serif", "system-ui", "-apple-system", "ui-sans-serif": return nil
            case "monospace", "ui-monospace": return NSFont.monospacedSystemFont(ofSize: size, weight: weight)
            case "serif", "ui-serif": name = "Times New Roman"
            case "cursive": name = "Apple Chancery"
            default: break
            }
            if let font = NSFontManager.shared.font(withFamily: name, traits: traits, weight: 5, size: size) {
                return font
            }
        }
        return nil
    }
}
