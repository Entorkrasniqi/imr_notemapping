import AppKit
import UniformTypeIdentifiers

/// Drives one open note: loads its body into the text view, implements
/// every toolbar command (the same set as the web `Toolbar.tsx`), keeps
/// the toolbar's active states in sync with the selection, and writes the
/// note back to the board on every change — the native counterpart of
/// `NoteEditorModal` + `RichTextEditor` + `Toolbar`.
@MainActor
final class EditorController: NSObject, ObservableObject {
    struct ToolbarState: Equatable {
        var bold = false
        var italic = false
        var underline = false
        var headingLevel: Int?
        var bulletList = false
        var orderedList = false
        var align = "left"
        var fontFamily = ""
        var fontSize = ""
        var color: String?
        var highlightColor: String?
        var canUndo = false
        var canRedo = false
    }

    // The toolbar's options, identical to the web toolbar's.
    static let fontFamilies: [(label: String, value: String)] = [
        ("Default", ""),
        ("Sans-serif", "Arial, Helvetica, sans-serif"),
        ("Serif", "Georgia, 'Times New Roman', Times, serif"),
        ("Monospace", "'Courier New', Courier, monospace"),
        ("Comic", "'Comic Sans MS', 'Comic Sans', cursive"),
    ]
    static let textColors: [(label: String, value: String?)] = [
        ("Default", nil), ("Red", "#dc2626"), ("Blue", "#2563eb"), ("Green", "#16a34a"), ("Purple", "#9333ea"),
    ]
    static let highlightColors: [(label: String, value: String)] = [
        ("Yellow", "#fef08a"), ("Green", "#bbf7d0"), ("Blue", "#bfdbfe"), ("Pink", "#fbcfe8"),
    ]
    static let fontSizeRange = 1...50

    @Published private(set) var toolbar = ToolbarState()
    @Published private(set) var title: String
    @Published var isDragOver = false

    let noteID: String
    private weak var store: BoardStore?
    /// The note as it was when opened — what Cancel restores.
    private let snapshot: JSONValue?
    private let initialBody: JSONValue
    private var hasChanges = false
    private var bodyEdited = false
    private var isLoading = false
    private var theme: Theme
    private var context: TextStyleContext
    private var pendingShortcutLocation: Int?
    private(set) weak var textView: NoteTextView?
    private weak var layoutManager: NoteLayoutManager?

    /// Block style of the empty last paragraph, which has no character to
    /// hold it. Tracks the last paragraph's block while it has text, so
    /// deleting that text back to nothing keeps the paragraph's type.
    private var trailingBlock: BlockStyle? {
        didSet { layoutManager?.trailingBlock = trailingBlock }
    }

    init(note: NoteNode, store: BoardStore, theme: Theme) {
        noteID = note.id
        self.store = store
        snapshot = note.content
        title = NoteContent.titleText(note.content)
        initialBody = NoteContent.bodyDocument(note.content)
        self.theme = theme
        context = .editor(theme)
    }

    // MARK: - Lifecycle

    func attach(_ textView: NoteTextView, layoutManager: NoteLayoutManager) {
        self.textView = textView
        self.layoutManager = layoutManager
        textView.controller = self
        textView.delegate = self
        applyThemeToTextView()

        let imported = TiptapConverter.importDocument(initialBody, context: context)
        isLoading = true
        textView.textStorage?.setAttributedString(imported.text)
        isLoading = false
        trailingBlock = imported.trailingBlock
        updateTrailingBlockFromText()
        textView.setSelectedRange(NSRange(location: 0, length: 0))
        syncTypingAttributes()
        refreshToolbar()
    }

    func setTheme(_ newTheme: Theme) {
        guard newTheme != theme else { return }
        theme = newTheme
        context = .editor(newTheme)
        applyThemeToTextView()
        guard let storage = textView?.textStorage else { return }
        storage.beginEditing()
        TextStyler.restyle(storage, range: NSRange(location: 0, length: storage.length), context: context)
        storage.endEditing()
        syncTypingAttributes(force: true)
        textView?.needsDisplay = true
    }

    private func applyThemeToTextView() {
        textView?.insertionPointColor = theme.palette.editorText
        textView?.placeholderColor = theme.palette.editorBodyPlaceholder
        layoutManager?.markerColor = theme.palette.editorText
    }

    func setTitle(_ newTitle: String) {
        guard newTitle != title else { return }
        title = newTitle
        pushContent()
    }

    /// Return in the title moves on to the body, as on the web.
    func focusBody() {
        guard let textView else { return }
        textView.window?.makeFirstResponder(textView)
        textView.setSelectedRange(NSRange(location: 0, length: 0))
    }

    /// Back to the body after typing a size in the toolbar's size field.
    func focusBodyKeepingSelection() {
        guard let textView else { return }
        textView.window?.makeFirstResponder(textView)
    }

    /// Save / ⌘↵ / Escape / clicking outside — close, keeping every change.
    /// Only Cancel discards, deliberately (see NoteEditorModal.tsx).
    func close() {
        store?.editingNoteID = nil
    }

    func cancel() {
        if hasChanges { store?.updateContent(noteID, snapshot) }
        close()
    }

    func didClose() {
        // Text undo steps belong to this editing session only.
        textView?.undoManager?.removeAllActions()
    }

    private func pushContent() {
        guard let store else { return }
        hasChanges = true
        store.updateContent(noteID, NoteContent.document(title: title, body: currentBody()))
    }

    /// The body as a Tiptap document. Until the body is actually edited
    /// this is the original JSON itself, so changing only the title can't
    /// alter anything else in the note.
    func currentBody() -> JSONValue {
        guard bodyEdited, let storage = textView?.textStorage else { return initialBody }
        return TiptapConverter.exportDocument(storage, trailingBlock: trailingBlock)
    }

    // MARK: - Paragraph bookkeeping

    private struct Paragraph {
        /// Text of the paragraph, without its terminating newline.
        let content: NSRange
        /// Including the newline — empty only for a trailing empty paragraph.
        let full: NSRange
        let block: BlockStyle
    }

    private func paragraphs() -> [Paragraph] {
        guard let storage = textView?.textStorage else { return [] }
        let string = storage.string as NSString
        var result: [Paragraph] = []
        var location = 0
        while true {
            let newline = string.range(of: "\n", options: [], range: NSRange(location: location, length: string.length - location))
            let hasTerminator = newline.location != NSNotFound
            let end = hasTerminator ? newline.location : string.length
            let full = NSRange(location: location, length: end - location + (hasTerminator ? 1 : 0))
            let block = full.length > 0
                ? storage.attribute(.noteBlock, at: location, effectiveRange: nil) as? BlockStyle ?? .paragraph
                : trailingBlock ?? .paragraph
            result.append(Paragraph(content: NSRange(location: location, length: end - location), full: full, block: block))
            guard hasTerminator else { break }
            location = end + 1
        }
        return result
    }

    private func paragraphIndex(containing location: Int, in paragraphs: [Paragraph]) -> Int? {
        paragraphs.firstIndex { location <= NSMaxRange($0.content) }
    }

    /// Paragraphs touched by the selection; a selection ending right after
    /// a newline doesn't reach into the next paragraph.
    private func selectedParagraphIndices(_ paragraphs: [Paragraph]) -> [Int] {
        guard let textView else { return [] }
        let selection = textView.selectedRange()
        let end = selection.length > 0 ? NSMaxRange(selection) - 1 : selection.location
        guard let first = paragraphIndex(containing: selection.location, in: paragraphs),
              let last = paragraphIndex(containing: max(end, selection.location), in: paragraphs)
        else { return [] }
        return Array(first...last)
    }

    /// Every character of a paragraph must carry the same block — the
    /// first character's, the same rule `NSTextStorage` applies to
    /// paragraph styles. Edits that join paragraphs, or paste text into
    /// the middle of one, break that; this puts it right after each edit.
    func normalizeParagraphs() {
        guard let storage = textView?.textStorage, storage.length > 0 else { return }
        let string = storage.string as NSString
        var fixes: [(NSRange, BlockStyle)] = []
        var location = 0
        while location < string.length {
            let paragraph = string.paragraphRange(for: NSRange(location: location, length: 0))
            var effective = NSRange()
            let block = storage.attribute(.noteBlock, at: paragraph.location, longestEffectiveRange: &effective, in: paragraph) as? BlockStyle
            if block == nil || NSMaxRange(effective) < NSMaxRange(paragraph) {
                fixes.append((paragraph, block ?? .paragraph))
            }
            location = NSMaxRange(paragraph)
        }
        storage.beginEditing()
        for (range, block) in fixes {
            storage.addAttribute(.noteBlock, value: block, range: range)
            TextStyler.restyle(storage, range: range, context: context)
        }
        // Return pressed right after highlighted text inserts a newline
        // carrying the highlight; see `clearLineBreakBackgrounds`.
        TextStyler.clearLineBreakBackgrounds(storage, in: NSRange(location: 0, length: storage.length))
        storage.endEditing()
    }

    private func updateTrailingBlockFromText() {
        guard let storage = textView?.textStorage, storage.length > 0 else { return }
        let string = storage.string as NSString
        let lastNewline = string.range(of: "\n", options: .backwards)
        let start = lastNewline.location == NSNotFound ? 0 : NSMaxRange(lastNewline)
        if start < string.length, let block = storage.attribute(.noteBlock, at: start, effectiveRange: nil) as? BlockStyle {
            trailingBlock = block
        }
    }

    /// Typing attributes follow the caret's *paragraph*, not just the
    /// character before it — otherwise the first letter typed at the start
    /// of a list item would inherit the previous paragraph's block.
    private func syncTypingAttributes(force: Bool = false) {
        guard let textView, let storage = textView.textStorage, textView.selectedRange().length == 0 else { return }
        let location = textView.selectedRange().location
        let paragraphs = self.paragraphs()
        guard let index = paragraphIndex(containing: location, in: paragraphs) else { return }
        let paragraph = paragraphs[index]

        var marks = textView.typingAttributes[.noteMarks] as? InlineMarks ?? .plain
        if location == paragraph.content.location, paragraph.content.length > 0,
           let first = storage.attribute(.noteMarks, at: location, effectiveRange: nil) as? InlineMarks {
            marks = first
        }
        let currentBlock = textView.typingAttributes[.noteBlock] as? BlockStyle
        let currentMarks = textView.typingAttributes[.noteMarks] as? InlineMarks
        if force || currentBlock != paragraph.block || currentMarks != marks {
            textView.typingAttributes = TextStyler.attributes(marks: marks, block: paragraph.block, context: context)
        }
    }

    // MARK: - Toolbar state

    private func selectionMarks() -> [InlineMarks] {
        guard let textView, let storage = textView.textStorage else { return [] }
        let typing = textView.typingAttributes[.noteMarks] as? InlineMarks ?? .plain
        let ranges = textView.selectedRanges.map(\.rangeValue).filter { $0.length > 0 }
        guard !ranges.isEmpty else { return [typing] }
        let string = storage.string as NSString
        var marks: [InlineMarks] = []
        for range in ranges {
            storage.enumerateAttributes(in: range) { attributes, subrange, _ in
                guard attributes[.noteAtom] == nil else { return }
                let text = string.substring(with: subrange)
                guard text.contains(where: { $0 != "\n" }) else { return }
                marks.append(attributes[.noteMarks] as? InlineMarks ?? .plain)
            }
        }
        return marks.isEmpty ? [typing] : marks
    }

    func refreshToolbar() {
        guard let textView else { return }
        let marks = selectionMarks()
        let first = marks.first ?? .plain
        let paragraphs = self.paragraphs()
        let selected = selectedParagraphIndices(paragraphs).map { paragraphs[$0].block }
        let firstBlock = selected.first ?? .paragraph

        var state = ToolbarState()
        state.bold = marks.allSatisfy(\.bold)
        state.italic = marks.allSatisfy(\.italic)
        state.underline = marks.allSatisfy(\.underline)
        if let level = firstBlock.headingLevel, selected.allSatisfy({ $0.headingLevel == level }) {
            state.headingLevel = level
        }
        state.bulletList = firstBlock.containers.contains { $0.kind == .bulletList }
        state.orderedList = firstBlock.containers.contains { $0.kind == .orderedList }
        if let align = firstBlock.textAlign, ["left", "center", "right", "justify"].contains(align) {
            state.align = align
        }
        state.fontFamily = first.fontFamily ?? ""
        if let size = first.fontSize, let points = TextStyler.cssLength(size, relativeTo: 16) {
            state.fontSize = String(Int(points.rounded()))
        }
        state.color = first.color
        state.highlightColor = first.highlightColor
        state.canUndo = textView.undoManager?.canUndo ?? false
        state.canRedo = textView.undoManager?.canRedo ?? false
        if state != toolbar { toolbar = state }
    }

    // MARK: - Commands: marks

    func toggleBold() {
        let all = selectionMarks().allSatisfy(\.bold)
        applyMarks { $0.with(bold: !all) }
    }

    func toggleItalic() {
        let all = selectionMarks().allSatisfy(\.italic)
        applyMarks { $0.with(italic: !all) }
    }

    func toggleUnderline() {
        let all = selectionMarks().allSatisfy(\.underline)
        applyMarks { $0.with(underline: !all) }
    }

    func setFontFamily(_ value: String) {
        applyMarks { $0.withTextStyle("fontFamily", value.isEmpty ? nil : value) }
    }

    /// Mirrors the web size field: empty clears, anything else is clamped
    /// to 1–50 and stored as `"<n>px"`.
    func setFontSize(text: String) {
        let digits = text.filter(\.isNumber)
        guard !digits.isEmpty else {
            applyMarks { $0.withTextStyle("fontSize", nil) }
            return
        }
        guard let value = Int(digits.prefix(4)) else { return }
        let clamped = min(max(value, Self.fontSizeRange.lowerBound), Self.fontSizeRange.upperBound)
        applyMarks { $0.withTextStyle("fontSize", "\(clamped)px") }
    }

    func setColor(_ value: String?) {
        applyMarks { $0.withTextStyle("color", value) }
    }

    /// Tiptap's `toggleHighlight({ color })`: same color again removes it.
    func toggleHighlight(_ color: String) {
        let all = selectionMarks().allSatisfy { $0.highlightColor == color }
        applyMarks { $0.withHighlight(color, enabled: !all) }
    }

    func clearHighlight() {
        applyMarks { $0.withHighlight(nil, enabled: false) }
    }

    func undo() {
        textView?.undoManager?.undo()
        refreshToolbar()
    }

    func redo() {
        textView?.undoManager?.redo()
        refreshToolbar()
    }

    private func applyMarks(_ transform: (InlineMarks) -> InlineMarks) {
        guard let textView, let storage = textView.textStorage else { return }
        let ranges = textView.selectedRanges.map(\.rangeValue).filter { $0.length > 0 }
        guard let firstRange = ranges.first else {
            // No selection: the change applies to what's typed next.
            let marks = transform(textView.typingAttributes[.noteMarks] as? InlineMarks ?? .plain)
            let block = textView.typingAttributes[.noteBlock] as? BlockStyle ?? .paragraph
            textView.typingAttributes = TextStyler.attributes(marks: marks, block: block, context: context)
            refreshToolbar()
            return
        }
        let union = ranges.dropFirst().reduce(firstRange) { NSUnionRange($0, $1) }
        guard textView.shouldChangeText(in: union, replacementString: nil) else { return }
        storage.beginEditing()
        for range in ranges {
            storage.enumerateAttribute(.noteMarks, in: range) { value, subrange, _ in
                storage.addAttribute(.noteMarks, value: transform(value as? InlineMarks ?? .plain), range: subrange)
            }
            TextStyler.restyle(storage, range: range, context: context)
        }
        storage.endEditing()
        textView.didChangeText()
        refreshToolbar()
    }

    // MARK: - Commands: blocks

    func toggleHeading(_ level: Int) {
        let paragraphs = self.paragraphs()
        // A list item has to start with a paragraph in Tiptap's schema, so
        // the web editor's toggleHeading does nothing there either.
        let targets = selectedParagraphIndices(paragraphs).filter { !paragraphs[$0].block.isListItemStart }
        guard !targets.isEmpty else { return }
        let allAtLevel = targets.allSatisfy { paragraphs[$0].block.headingLevel == level }
        var blocks = paragraphs.map(\.block)
        for index in targets {
            blocks[index] = blocks[index].asTextblock(allAtLevel ? .paragraph : .heading(level))
        }
        apply(blocks, over: paragraphs)
    }

    func setAlign(_ align: String) {
        let paragraphs = self.paragraphs()
        var blocks = paragraphs.map(\.block)
        for index in selectedParagraphIndices(paragraphs) where !blocks[index].isCode {
            var attrs = blocks[index].attrs
            attrs["textAlign"] = .string(align)
            blocks[index] = blocks[index].with(attrs: attrs)
        }
        apply(blocks, over: paragraphs)
    }

    /// Tiptap's `toggleBulletList`/`toggleOrderedList`: lift out of a list
    /// of the same kind, switch the kind of a list of the other kind, or
    /// wrap plain paragraphs in a new list (joining an adjacent one).
    func toggleList(_ kind: BlockContainer.Kind, start: Int? = nil) {
        let paragraphs = self.paragraphs()
        let selected = selectedParagraphIndices(paragraphs)
        guard let firstIndex = selected.first else { return }
        let first = paragraphs[firstIndex].block
        var blocks = paragraphs.map(\.block)

        if let list = first.innermostList {
            if list.kind == kind {
                for index in selected where blocks[index].innermostList != nil {
                    Self.lift(&blocks, at: index)
                }
            } else {
                let replacement = BlockContainer(kind: kind, id: list.id, attrs: BlockContainer.defaultAttrs(for: kind))
                for index in blocks.indices {
                    guard let depth = blocks[index].containers.firstIndex(where: { $0.id == list.id }) else { continue }
                    var containers = blocks[index].containers
                    containers[depth] = replacement
                    blocks[index] = blocks[index].with(containers: containers)
                }
            }
            apply(blocks, over: paragraphs)
            return
        }

        let depth = first.containers.count
        let outerIDs = first.containers.map(\.id)
        func sharesOuterContainers(_ block: BlockStyle) -> Bool {
            block.containers.count > depth && block.containers.prefix(depth).map(\.id) == outerIDs
        }

        var container = BlockContainer.list(kind)
        if let start, start != 1 { container.attrs["start"] = .int(start) }
        if firstIndex > 0, sharesOuterContainers(blocks[firstIndex - 1]), blocks[firstIndex - 1].containers[depth].kind == kind {
            container = blocks[firstIndex - 1].containers[depth]
        }
        for index in selected {
            let block = blocks[index]
            let base = block.isCode || block.headingLevel != nil ? block.asTextblock(.paragraph) : block
            blocks[index] = base.with(containers: block.containers + [container], startsItem: true)
        }
        // Join a list of the same kind that follows right after.
        if let last = selected.last, last + 1 < blocks.count, sharesOuterContainers(blocks[last + 1]),
           blocks[last + 1].containers[depth].kind == kind {
            let oldID = blocks[last + 1].containers[depth].id
            var index = last + 1
            while index < blocks.count, blocks[index].containers.count > depth, blocks[index].containers[depth].id == oldID {
                var containers = blocks[index].containers
                containers[depth] = container
                blocks[index] = blocks[index].with(containers: containers)
                index += 1
            }
        }
        apply(blocks, over: paragraphs)
    }

    private func wrapInBlockquote() {
        let paragraphs = self.paragraphs()
        var blocks = paragraphs.map(\.block)
        let quote = BlockContainer(kind: .blockquote, id: UUID(), attrs: [:])
        for index in selectedParagraphIndices(paragraphs) {
            blocks[index] = blocks[index].with(containers: blocks[index].containers + [quote], startsItem: false)
        }
        apply(blocks, over: paragraphs)
    }

    /// Takes paragraph `index` — and the rest of its list item — out of its
    /// innermost list or blockquote. Out of a nested list it becomes an
    /// item of the parent list; out of a top-level one, plain paragraphs.
    private static func lift(_ blocks: inout [BlockStyle], at index: Int) {
        let block = blocks[index]
        guard let container = block.containers.last else { return }
        let depth = block.containers.count
        var end = index + 1
        if container.isList {
            while end < blocks.count {
                let other = blocks[end]
                guard other.containers.count >= depth, other.containers[depth - 1].id == container.id,
                      !(other.containers.count == depth && other.startsItem) else { break }
                end += 1
            }
        }
        for position in index..<end {
            var containers = blocks[position].containers
            containers.remove(at: depth - 1)
            let startsItem = position == index ? (containers.last?.isList ?? false) : blocks[position].startsItem
            blocks[position] = blocks[position].with(containers: containers, startsItem: startsItem)
        }
    }

    /// Tab in a list: nests the item under the previous one (Tiptap's
    /// `sinkListItem`). The first item of a list can't be nested.
    private static func sink(_ blocks: inout [BlockStyle], at index: Int) -> Bool {
        let block = blocks[index]
        guard block.isListItemStart, let list = block.innermostList, index > 0 else { return false }
        let depth = block.containers.count

        var hasPreviousItem = false
        var previousIndex = index - 1
        while previousIndex >= 0 {
            let other = blocks[previousIndex]
            guard other.containers.count >= depth, other.containers[depth - 1].id == list.id else { break }
            if other.containers.count == depth && other.startsItem {
                hasPreviousItem = true
                break
            }
            previousIndex -= 1
        }
        guard hasPreviousItem else { return false }

        let previous = blocks[index - 1]
        let nested: BlockContainer
        if previous.containers.count > depth, previous.containers[depth - 1].id == list.id,
           previous.containers[depth].kind == list.kind {
            nested = previous.containers[depth]
        } else {
            nested = BlockContainer(kind: list.kind, id: UUID(), attrs: BlockContainer.defaultAttrs(for: list.kind))
        }

        var end = index + 1
        while end < blocks.count {
            let other = blocks[end]
            guard other.containers.count >= depth, other.containers[depth - 1].id == list.id,
                  !(other.containers.count == depth && other.startsItem) else { break }
            end += 1
        }
        for position in index..<end {
            var containers = blocks[position].containers
            containers.insert(nested, at: depth)
            blocks[position] = blocks[position].with(containers: containers)
        }
        return true
    }

    /// Writes changed block styles back, as one undoable step.
    private func apply(_ blocks: [BlockStyle], over paragraphs: [Paragraph]) {
        guard let textView, let storage = textView.textStorage else { return }
        let changed = paragraphs.indices.filter { blocks[$0] != paragraphs[$0].block }
        guard !changed.isEmpty else { return }

        let ranges = changed.map { paragraphs[$0].full }.filter { $0.length > 0 }
        if let first = ranges.first, let last = ranges.last {
            guard textView.shouldChangeText(in: NSUnionRange(first, last), replacementString: nil) else { return }
            storage.beginEditing()
            for index in changed where paragraphs[index].full.length > 0 {
                storage.addAttribute(.noteBlock, value: blocks[index], range: paragraphs[index].full)
                TextStyler.restyle(storage, range: paragraphs[index].full, context: context)
            }
            storage.endEditing()
        }
        if let trailing = changed.first(where: { paragraphs[$0].full.length == 0 }) {
            trailingBlock = blocks[trailing]
        }
        syncTypingAttributes(force: true)
        if ranges.isEmpty {
            bodyEdited = true
            pushContent()
        } else {
            textView.didChangeText()
        }
        textView.needsDisplay = true
        refreshToolbar()
    }

    // MARK: - Keys

    private func handleNewline() -> Bool {
        guard let textView, textView.selectedRange().length == 0 else { return false }
        let location = textView.selectedRange().location
        let paragraphs = self.paragraphs()
        guard let index = paragraphIndex(containing: location, in: paragraphs) else { return false }
        let paragraph = paragraphs[index]

        // Return on an empty list item or quoted line leaves the list/quote.
        if paragraph.content.length == 0, !paragraph.block.containers.isEmpty {
            var blocks = paragraphs.map(\.block)
            Self.lift(&blocks, at: index)
            apply(blocks, over: paragraphs)
            return true
        }
        // Return at the end of a heading continues with a normal paragraph.
        if paragraph.block.headingLevel != nil, location == NSMaxRange(paragraph.content) {
            textView.breakUndoCoalescing()
            textView.insertNewline(nil)
            let updated = self.paragraphs()
            if index + 1 < updated.count {
                var blocks = updated.map(\.block)
                blocks[index + 1] = blocks[index + 1].asTextblock(.paragraph)
                apply(blocks, over: updated)
            }
            textView.breakUndoCoalescing()
            return true
        }
        return false
    }

    /// Backspace at the start of a list item or quoted line takes it out
    /// of the list/quote before it would merge with the line above.
    private func handleBackspace() -> Bool {
        guard let textView, textView.selectedRange().length == 0 else { return false }
        let location = textView.selectedRange().location
        let paragraphs = self.paragraphs()
        guard let index = paragraphIndex(containing: location, in: paragraphs) else { return false }
        let block = paragraphs[index].block
        guard location == paragraphs[index].content.location,
              block.isListItemStart || block.containers.last?.kind == .blockquote else { return false }
        var blocks = paragraphs.map(\.block)
        Self.lift(&blocks, at: index)
        apply(blocks, over: paragraphs)
        return true
    }

    private func handleTab(outdent: Bool) -> Bool {
        let paragraphs = self.paragraphs()
        let selected = selectedParagraphIndices(paragraphs)
        guard selected.contains(where: { paragraphs[$0].block.innermostList != nil }) else { return false }
        var blocks = paragraphs.map(\.block)
        for index in selected where blocks[index].innermostList != nil {
            if outdent {
                Self.lift(&blocks, at: index)
            } else {
                _ = Self.sink(&blocks, at: index)
            }
        }
        apply(blocks, over: paragraphs)
        return true
    }

    /// Tiptap's Markdown input rules: `- `, `* `, `1. `, `# `…`### `, `> `
    /// typed at the start of a plain paragraph.
    private func applyMarkdownShortcut(endingAt location: Int) {
        guard let textView, let storage = textView.textStorage, location <= storage.length else { return }
        let paragraphs = self.paragraphs()
        guard let index = paragraphIndex(containing: location, in: paragraphs) else { return }
        let paragraph = paragraphs[index]
        guard paragraph.block.kind == .paragraph, paragraph.block.innermostList == nil,
              location > paragraph.content.location, location <= NSMaxRange(paragraph.content)
        else { return }
        let prefixRange = NSRange(location: paragraph.content.location, length: location - paragraph.content.location)
        let prefix = (storage.string as NSString).substring(with: prefixRange)

        let action: () -> Void
        switch prefix {
        case "- ", "* ", "+ ": action = { self.toggleList(.bulletList) }
        case "# ": action = { self.toggleHeading(1) }
        case "## ": action = { self.toggleHeading(2) }
        case "### ": action = { self.toggleHeading(3) }
        case "> ": action = { self.wrapInBlockquote() }
        default:
            guard prefix.hasSuffix(". "), let number = Int(prefix.dropLast(2)), number >= 0 else { return }
            action = { self.toggleList(.orderedList, start: number) }
        }

        guard textView.shouldChangeText(in: prefixRange, replacementString: "") else { return }
        storage.replaceCharacters(in: prefixRange, with: "")
        textView.didChangeText()
        textView.setSelectedRange(NSRange(location: paragraph.content.location, length: 0))
        action()
    }

    // MARK: - Clipboard and images

    func fragmentData(for range: NSRange) -> Data? {
        guard let storage = textView?.textStorage, range.length > 0, NSMaxRange(range) <= storage.length else { return nil }
        let fragment = TiptapConverter.exportDocument(storage.attributedSubstring(from: range), trailingBlock: nil)
        return try? fragment.encodedData()
    }

    func pasteFragment(_ data: Data?) -> Bool {
        guard let data, let document = try? JSONValue.decode(data) else { return false }
        return insert(TiptapConverter.importDocument(document, context: context).text)
    }

    func pastePlainText(_ string: String?) -> Bool {
        guard let textView, let string else { return false }
        let marks = textView.typingAttributes[.noteMarks] as? InlineMarks ?? .plain
        let text = Self.normalizeNewlines(string)
        let pasted = NSAttributedString(string: text, attributes: TextStyler.attributes(marks: marks, block: .paragraph, context: context))
        return insert(adoptingCurrentBlock(pasted))
    }

    /// Rich text from other apps (or a browser — including the web app):
    /// keeps bold/italic/underline/strikethrough, alignment, and colors
    /// that match the toolbar's palette; drops fonts and sizes that would
    /// otherwise land in the note as one-off styles.
    func pasteRichText(from pasteboard: NSPasteboard, type: NSPasteboard.PasteboardType) -> Bool {
        guard let data = pasteboard.data(forType: type) else { return false }
        let foreign: NSAttributedString?
        if type == .html {
            foreign = NSAttributedString(html: data, documentAttributes: nil)
        } else {
            foreign = NSAttributedString(rtf: data, documentAttributes: nil)
        }
        guard let foreign else { return pastePlainText(pasteboard.string(forType: .string)) }

        let result = NSMutableAttributedString()
        foreign.enumerateAttributes(in: NSRange(location: 0, length: foreign.length)) { attributes, range, _ in
            guard attributes[.attachment] == nil else { return }
            let text = Self.normalizeNewlines((foreign.string as NSString).substring(with: range))
                .replacingOccurrences(of: "\u{FFFC}", with: "")
            guard !text.isEmpty else { return }
            let traits = (attributes[.font] as? NSFont)?.fontDescriptor.symbolicTraits ?? []
            var marks = InlineMarks(
                bold: traits.contains(.bold), italic: traits.contains(.italic),
                underline: ((attributes[.underlineStyle] as? Int) ?? 0) != 0,
                strike: ((attributes[.strikethroughStyle] as? Int) ?? 0) != 0
            )
            if let color = attributes[.foregroundColor] as? NSColor,
               let hex = Self.matchingPaletteColor(color, among: Self.textColors.compactMap(\.value)) {
                marks = marks.withTextStyle("color", hex)
            }
            if let background = attributes[.backgroundColor] as? NSColor,
               let hex = Self.matchingPaletteColor(background, among: Self.highlightColors.map(\.value)) {
                marks = marks.withHighlight(hex, enabled: true)
            }
            var block = BlockStyle.paragraph
            switch (attributes[.paragraphStyle] as? NSParagraphStyle)?.alignment {
            case .center?: block = block.with(attrs: ["textAlign": .string("center")])
            case .right?: block = block.with(attrs: ["textAlign": .string("right")])
            case .justified?: block = block.with(attrs: ["textAlign": .string("justify")])
            default: break
            }
            result.append(NSAttributedString(string: text, attributes: TextStyler.attributes(marks: marks, block: block, context: context)))
        }
        if result.string.hasSuffix("\n") { result.deleteCharacters(in: NSRange(location: result.length - 1, length: 1)) }
        return insert(adoptingCurrentBlock(result))
    }

    /// Pasted plain/foreign text takes on the block it's pasted into — so
    /// pasting three lines into a list item makes three list items — with
    /// alignment kept from the source where it had one.
    private func adoptingCurrentBlock(_ pasted: NSAttributedString) -> NSAttributedString {
        guard let textView else { return pasted }
        let paragraphs = self.paragraphs()
        guard let index = paragraphIndex(containing: textView.rangeForUserTextChange.location, in: paragraphs) else { return pasted }
        let current = paragraphs[index].block
        let later = current.headingLevel != nil ? current.asTextblock(.paragraph) : current

        let result = NSMutableAttributedString(attributedString: pasted)
        let string = result.string as NSString
        var location = 0
        var paragraphNumber = 0
        while location < string.length {
            let range = string.paragraphRange(for: NSRange(location: location, length: 0))
            let source = result.attribute(.noteBlock, at: range.location, effectiveRange: nil) as? BlockStyle
            var block = paragraphNumber == 0 ? current : later
            if let align = source?.attrs["textAlign"], !align.isNull, !block.isCode {
                var attrs = block.attrs
                attrs["textAlign"] = align
                block = block.with(attrs: attrs)
            }
            result.addAttribute(.noteBlock, value: block, range: range)
            TextStyler.restyle(result, range: range, context: context)
            location = NSMaxRange(range)
            paragraphNumber += 1
        }
        return result
    }

    func pasteImageFiles(from pasteboard: NSPasteboard) -> Bool {
        let urls = pasteboard.readObjects(forClasses: [NSURL.self], options: [.urlReadingFileURLsOnly: true]) as? [URL]
        guard let url = urls?.first, Self.isJPEG(url) else { return false }
        do {
            return insertImage(src: try NoteContent.dataURL(forJPEGAt: url))
        } catch {
            textView?.presentError(error)
            return false
        }
    }

    /// Inserts an image as its own block at the caret, splitting the
    /// paragraph if the caret is inside one — what Tiptap's `setImage`
    /// does with a block-level image.
    func insertImage(src: String) -> Bool {
        guard let textView else { return false }
        let range = textView.rangeForUserTextChange
        let paragraphs = self.paragraphs()
        guard range.location != NSNotFound, let index = paragraphIndex(containing: range.location, in: paragraphs) else { return false }
        let paragraph = paragraphs[index]
        let image = JSONValue.node("image", attrs: [
            "src": .string(src), "alt": .null, "title": .null, "width": .null, "height": .null,
        ])

        let piece = NSMutableAttributedString()
        if range.location > paragraph.content.location {
            piece.append(NSAttributedString(string: "\n", attributes: TextStyler.attributes(marks: .plain, block: paragraph.block, context: context)))
        }
        piece.append(TiptapConverter.atomString(AtomBox(kind: .image, json: image), block: .paragraph, context: context))
        if NSMaxRange(range) < NSMaxRange(paragraph.content) {
            piece.append(NSAttributedString(string: "\n", attributes: TextStyler.attributes(marks: .plain, block: .paragraph, context: context)))
        }
        return insert(piece)
    }

    private func insert(_ text: NSAttributedString) -> Bool {
        guard let textView, let storage = textView.textStorage else { return false }
        let range = textView.rangeForUserTextChange
        guard range.location != NSNotFound, textView.shouldChangeText(in: range, replacementString: text.string) else { return false }
        storage.replaceCharacters(in: range, with: text)
        textView.didChangeText()
        textView.setSelectedRange(NSRange(location: range.location + text.length, length: 0))
        return true
    }

    static func isJPEG(_ url: URL) -> Bool {
        UTType(filenameExtension: url.pathExtension)?.conforms(to: .jpeg) ?? false
    }

    static func containsJPEG(_ pasteboard: NSPasteboard) -> Bool {
        let urls = pasteboard.readObjects(forClasses: [NSURL.self], options: [.urlReadingFileURLsOnly: true]) as? [URL]
        return urls?.first.map(isJPEG) ?? false
    }

    private static func normalizeNewlines(_ text: String) -> String {
        text.replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
            .replacingOccurrences(of: "\u{2029}", with: "\n")
    }

    private static func matchingPaletteColor(_ color: NSColor, among hexes: [String]) -> String? {
        guard let rgb = color.usingColorSpace(.sRGB) else { return nil }
        return hexes.first { hex in
            guard let candidate = CSSColor.parse(hex)?.usingColorSpace(.sRGB) else { return false }
            return abs(candidate.redComponent - rgb.redComponent) < 0.02
                && abs(candidate.greenComponent - rgb.greenComponent) < 0.02
                && abs(candidate.blueComponent - rgb.blueComponent) < 0.02
        }
    }
}

extension EditorController: NSTextViewDelegate {
    func textDidChange(_ notification: Notification) {
        guard !isLoading else { return }
        bodyEdited = true
        updateTrailingBlockFromText()
        pushContent()
        // Numbering of later list items may have changed.
        textView?.needsDisplay = true
        refreshToolbar()
        if let location = pendingShortcutLocation {
            pendingShortcutLocation = nil
            Task { @MainActor [weak self] in self?.applyMarkdownShortcut(endingAt: location) }
        }
    }

    func textViewDidChangeSelection(_ notification: Notification) {
        guard !isLoading else { return }
        syncTypingAttributes()
        refreshToolbar()
    }

    func textView(_ textView: NSTextView, shouldChangeTextIn affectedCharRange: NSRange, replacementString: String?) -> Bool {
        pendingShortcutLocation = replacementString == " " && affectedCharRange.length == 0
            ? affectedCharRange.location + 1 : nil
        return true
    }

    func textView(_ textView: NSTextView, doCommandBy commandSelector: Selector) -> Bool {
        switch commandSelector {
        case #selector(NSResponder.insertNewline(_:)): return handleNewline()
        case #selector(NSResponder.deleteBackward(_:)): return handleBackspace()
        case #selector(NSResponder.insertTab(_:)): return handleTab(outdent: false)
        case #selector(NSResponder.insertBacktab(_:)): return handleTab(outdent: true)
        case #selector(NSResponder.cancelOperation(_:)):
            close()
            return true
        default:
            return false
        }
    }
}
