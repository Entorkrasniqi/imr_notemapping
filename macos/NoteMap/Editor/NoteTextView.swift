import AppKit
import SwiftUI
import UniformTypeIdentifiers

extension NSPasteboard.PasteboardType {
    /// A Tiptap document fragment — lets copy/paste and drag within and
    /// between notes keep headings, lists, colors, and images intact.
    static let noteMapFragment = NSPasteboard.PasteboardType("com.notemap.tiptap-fragment")
}

/// The note body's text view. Formatting logic lives in `EditorController`;
/// this subclass only routes the events AppKit delivers to a text view
/// (key equivalents, clipboard, drops) to it.
final class NoteTextView: NSTextView {
    weak var controller: EditorController?
    var placeholder = "Type something…"
    var placeholderColor = NSColor.placeholderTextColor

    // Tiptap's default shortcuts: ⌘B/⌘I/⌘U, ⌥⌘1–3 for headings, ⇧⌘7/⇧⌘8
    // for numbered/bullet lists.
    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        guard window?.firstResponder === self, let controller else { return super.performKeyEquivalent(with: event) }
        let flags = event.modifierFlags.intersection([.command, .option, .shift, .control])
        let key = event.charactersIgnoringModifiers?.lowercased() ?? ""
        switch flags {
        case [.command]:
            switch key {
            case "b": controller.toggleBold(); return true
            case "i": controller.toggleItalic(); return true
            case "u": controller.toggleUnderline(); return true
            default: break
            }
        case [.command, .option]:
            if let level = Int(key), (1...3).contains(level) {
                controller.toggleHeading(level)
                return true
            }
        case [.command, .shift]:
            switch event.keyCode {
            case 26: controller.toggleList(.orderedList); return true // 7
            case 28: controller.toggleList(.bulletList); return true // 8
            default: break
            }
        default:
            break
        }
        return super.performKeyEquivalent(with: event)
    }

    // MARK: Clipboard and drops

    override var writablePasteboardTypes: [NSPasteboard.PasteboardType] {
        [.noteMapFragment] + super.writablePasteboardTypes
    }

    override func writeSelection(to pboard: NSPasteboard, type: NSPasteboard.PasteboardType) -> Bool {
        if type == .noteMapFragment {
            guard let data = controller?.fragmentData(for: selectedRange()) else { return false }
            return pboard.setData(data, forType: type)
        }
        return super.writeSelection(to: pboard, type: type)
    }

    override var readablePasteboardTypes: [NSPasteboard.PasteboardType] {
        [.noteMapFragment, .fileURL, .rtf, .html, .string]
    }

    override func readSelection(from pboard: NSPasteboard, type: NSPasteboard.PasteboardType) -> Bool {
        guard let controller else { return super.readSelection(from: pboard, type: type) }
        switch type {
        case .noteMapFragment: return controller.pasteFragment(pboard.data(forType: type))
        case .fileURL: return controller.pasteImageFiles(from: pboard)
        case .rtf, .html: return controller.pasteRichText(from: pboard, type: type)
        case .string: return controller.pastePlainText(pboard.string(forType: .string))
        default: return super.readSelection(from: pboard, type: type)
        }
    }

    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
        controller?.isDragOver = EditorController.containsJPEG(sender.draggingPasteboard)
        return super.draggingEntered(sender)
    }

    override func draggingExited(_ sender: NSDraggingInfo?) {
        controller?.isDragOver = false
        super.draggingExited(sender)
    }

    override func concludeDragOperation(_ sender: NSDraggingInfo?) {
        controller?.isDragOver = false
        super.concludeDragOperation(sender)
    }

    /// Every edit — typing, paste, undo, the controller's own commands —
    /// passes through here, so it's where paragraphs are made consistent
    /// again (see `EditorController.normalizeParagraphs`).
    override func didChangeText() {
        controller?.normalizeParagraphs()
        super.didChangeText()
    }

    // MARK: Placeholder

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        guard string.isEmpty, let font = typingAttributes[.font] as? NSFont else { return }
        let origin = NSPoint(x: textContainerOrigin.x + (textContainer?.lineFragmentPadding ?? 0), y: textContainerOrigin.y)
        (placeholder as NSString).draw(at: origin, withAttributes: [.font: font, .foregroundColor: placeholderColor])
    }
}

/// Draws what isn't text in a note body: list markers (bullets and
/// numbers — computed, not stored, just as the browser draws them for
/// `<ul>`/`<ol>`) and the bar beside blockquotes.
final class NoteLayoutManager: NSLayoutManager {
    var markerColor: NSColor = .labelColor
    /// Block style of an empty last paragraph (see `TiptapConverter.Imported`).
    var trailingBlock: BlockStyle?

    override func drawBackground(forGlyphRange glyphsToShow: NSRange, at origin: NSPoint) {
        super.drawBackground(forGlyphRange: glyphsToShow, at: origin)
        guard let storage = textStorage, let container = textContainers.first else { return }
        let string = storage.string as NSString

        if string.length > 0 {
            let characters = characterRange(forGlyphRange: glyphsToShow, actualGlyphRange: nil)
            var location = string.paragraphRange(for: NSRange(location: min(characters.location, string.length - 1), length: 0)).location
            while location < string.length && location <= NSMaxRange(characters) {
                let paragraph = string.paragraphRange(for: NSRange(location: location, length: 0))
                if let block = storage.attribute(.noteBlock, at: paragraph.location, effectiveRange: nil) as? BlockStyle {
                    let glyphs = glyphRange(forCharacterRange: paragraph, actualCharacterRange: nil)
                    decorate(block: block, paragraphStart: paragraph.location, glyphs: glyphs, origin: origin,
                             storage: storage, container: container)
                }
                location = NSMaxRange(paragraph)
            }
        }

        // The empty last paragraph has no glyphs, only the extra line fragment.
        if (string.length == 0 || string.character(at: string.length - 1) == 0x0A),
           let block = trailingBlock, !extraLineFragmentRect.isEmpty {
            drawMarker(for: block, paragraphStart: string.length, lineRect: extraLineFragmentRect,
                       baseline: nil, origin: origin, storage: storage, container: container)
        }
    }

    private func decorate(block: BlockStyle, paragraphStart: Int, glyphs: NSRange, origin: NSPoint,
                          storage: NSTextStorage, container: NSTextContainer) {
        guard glyphs.length > 0 || paragraphStart < storage.length else { return }
        let firstGlyph = glyphIndexForCharacter(at: paragraphStart)
        let lineRect = lineFragmentRect(forGlyphAt: firstGlyph, effectiveRange: nil)

        var indent: CGFloat = 0
        for item in block.containers {
            if item.kind == .blockquote {
                let bounds = boundingRect(forGlyphRange: glyphs, in: container)
                markerColor.withAlphaComponent(0.25).setFill()
                NSRect(x: origin.x + container.lineFragmentPadding + indent + 2, y: origin.y + bounds.minY,
                       width: 2, height: bounds.height).fill()
            }
            indent += item.isList ? 20 : 16
        }
        drawMarker(for: block, paragraphStart: paragraphStart, lineRect: lineRect,
                   baseline: location(forGlyphAt: firstGlyph).y, origin: origin, storage: storage, container: container)
    }

    private func drawMarker(for block: BlockStyle, paragraphStart: Int, lineRect: NSRect, baseline: CGFloat?,
                            origin: NSPoint, storage: NSTextStorage, container: NSTextContainer) {
        guard block.isListItemStart, let list = block.innermostList else { return }
        let marker = list.kind == .orderedList ? "\(ordinal(of: paragraphStart, block: block, list: list, storage: storage))." : "•"
        let fontIndex = min(paragraphStart, max(storage.length - 1, 0))
        let font = (storage.length > 0 ? storage.attribute(.font, at: fontIndex, effectiveRange: nil) as? NSFont : nil)
            ?? NSFont.systemFont(ofSize: 16)
        let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: markerColor]
        let size = (marker as NSString).size(withAttributes: attributes)
        let x = origin.x + lineRect.minX + container.lineFragmentPadding + block.indentation - 6 - size.width
        let baselineY = baseline ?? (lineRect.height - (lineRect.height - font.ascender + font.descender) / 2)
        let y = origin.y + lineRect.minY + baselineY - font.ascender
        (marker as NSString).draw(at: NSPoint(x: x, y: y), withAttributes: attributes)
    }

    /// `start` plus the number of earlier items in the same list.
    private func ordinal(of paragraphStart: Int, block: BlockStyle, list: BlockContainer, storage: NSTextStorage) -> Int {
        let depth = block.containers.count
        let string = storage.string as NSString
        var count = 0
        var location = paragraphStart
        while location > 0 {
            let previous = string.paragraphRange(for: NSRange(location: location - 1, length: 0))
            guard let other = storage.attribute(.noteBlock, at: previous.location, effectiveRange: nil) as? BlockStyle,
                  other.containers.count >= depth, other.containers[depth - 1].id == list.id
            else { break }
            if other.containers.count == depth && other.startsItem { count += 1 }
            location = previous.location
        }
        return (list.attrs["start"]?.intValue ?? 1) + count
    }
}

/// SwiftUI wrapper building a TextKit 1 stack explicitly — the custom
/// layout manager above needs TextKit 1, which an `NSTextView` created
/// without its own container no longer uses by default.
struct RichTextEditorView: NSViewRepresentable {
    let controller: EditorController

    func makeNSView(context: Context) -> NSScrollView {
        let storage = NSTextStorage()
        let layoutManager = NoteLayoutManager()
        storage.addLayoutManager(layoutManager)
        let container = NSTextContainer(size: NSSize(width: 0, height: CGFloat.greatestFiniteMagnitude))
        container.widthTracksTextView = true
        layoutManager.addTextContainer(container)

        let textView = NoteTextView(frame: .zero, textContainer: container)
        textView.isRichText = true
        textView.allowsUndo = true
        textView.importsGraphics = false
        textView.usesFontPanel = false
        textView.usesRuler = false
        textView.drawsBackground = false
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.isContinuousSpellCheckingEnabled = true
        textView.textContainerInset = NSSize(width: 19, height: 20)
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.autoresizingMask = [.width]
        textView.minSize = .zero
        textView.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)

        let scrollView = NSScrollView()
        scrollView.documentView = textView
        scrollView.hasVerticalScroller = true
        scrollView.autohidesScrollers = true
        scrollView.drawsBackground = false
        scrollView.borderType = .noBorder

        controller.attach(textView, layoutManager: layoutManager)
        return scrollView
    }

    func updateNSView(_ nsView: NSScrollView, context: Context) {}
}
