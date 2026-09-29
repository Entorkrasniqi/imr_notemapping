import XCTest
@testable import NoteMap

/// Drives the editor the way the toolbar and keyboard do, and checks the
/// note content that would be saved.
@MainActor
final class EditorControllerTests: XCTestCase {
    private var store: BoardStore!
    private var noteID: String!
    private var controller: EditorController!
    private var textView: NoteTextView!

    private func open(_ json: String) throws {
        let client = SupabaseClient(config: AppConfig(
            supabaseURL: URL(string: "http://localhost:54321")!, supabaseAnonKey: "test", webAppURL: nil))
        // The store never reaches `.ready`, so nothing is ever sent.
        store = BoardStore(board: BoardSummary(id: "board", name: "Test", updatedAt: Date(), noteCount: 0), client: client)
        noteID = store.addNote(centeredAt: .zero)
        store.updateContent(noteID, try JSONValue.decode(Data(json.utf8)))

        controller = EditorController(note: store.node(noteID)!, store: store, theme: .light)
        let storage = NSTextStorage()
        let layoutManager = NoteLayoutManager()
        storage.addLayoutManager(layoutManager)
        let container = NSTextContainer(size: NSSize(width: 600, height: 10_000))
        layoutManager.addTextContainer(container)
        textView = NoteTextView(frame: NSRect(x: 0, y: 0, width: 600, height: 400), textContainer: container)
        textView.isRichText = true
        controller.attach(textView, layoutManager: layoutManager)
    }

    private var savedBody: [JSONValue] {
        Array(store.node(noteID)!.content!.children.dropFirst())
    }

    private func select(_ text: String) {
        let range = (textView.string as NSString).range(of: text)
        XCTAssertNotEqual(range.location, NSNotFound)
        textView.setSelectedRange(range)
    }

    private let twoParagraphs = #"""
    {"type":"doc","content":[
      {"type":"paragraph","content":[{"type":"text","text":"Title"}]},
      {"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"alpha"}]},
      {"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"beta"}]}
    ]}
    """#

    func testTitleSplitAndTitleOnlyEdit() throws {
        try open(twoParagraphs)
        XCTAssertEqual(controller.title, "Title")
        XCTAssertEqual(textView.string, "alpha\nbeta")
        let before = savedBody
        controller.setTitle("Renamed")
        XCTAssertEqual(NoteContent.titleText(store.node(noteID)!.content), "Renamed")
        XCTAssertEqual(savedBody, before, "editing only the title must not touch the body")
    }

    func testBoldProducesBoldMark() throws {
        try open(twoParagraphs)
        select("alpha")
        controller.toggleBold()
        XCTAssertEqual(savedBody.first?.children.first?["marks"], .array([.node("bold")]))
        XCTAssertTrue(controller.toolbar.bold)
        controller.toggleBold()
        XCTAssertNil(savedBody.first?.children.first?["marks"])
    }

    func testToggleListThenIndent() throws {
        try open(twoParagraphs)
        textView.setSelectedRange(NSRange(location: 0, length: textView.string.count))
        controller.toggleList(.bulletList)
        XCTAssertEqual(savedBody.map(\.nodeType), ["bulletList"])
        XCTAssertEqual(savedBody.first?.children.count, 2)

        // Tab on the second item nests it under the first.
        select("beta")
        textView.setSelectedRange(NSRange(location: textView.selectedRange().location, length: 0))
        XCTAssertTrue(controller.textView(textView, doCommandBy: #selector(NSResponder.insertTab(_:))))
        let items = savedBody.first?.children ?? []
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items.first?.children.map(\.nodeType), ["paragraph", "bulletList"])

        // Toggling the list off again (from the nested item) lifts one level.
        controller.toggleList(.bulletList)
        XCTAssertEqual(savedBody.first?.children.count, 2)
    }

    func testSwitchingListKindChangesWholeList() throws {
        try open(twoParagraphs)
        textView.setSelectedRange(NSRange(location: 0, length: textView.string.count))
        controller.toggleList(.bulletList)
        textView.setSelectedRange(NSRange(location: 0, length: 0))
        controller.toggleList(.orderedList)
        XCTAssertEqual(savedBody.first?.nodeType, "orderedList")
        XCTAssertEqual(savedBody.first?.attrs["start"], .int(1))
        XCTAssertEqual(savedBody.first?.children.count, 2)
    }

    func testHeadingIsNotAppliedToListItems() throws {
        try open(twoParagraphs)
        select("alpha")
        controller.toggleHeading(2)
        XCTAssertEqual(savedBody.first?.nodeType, "heading")
        XCTAssertEqual(savedBody.first?.attrs["level"], .int(2))

        select("beta")
        controller.toggleList(.bulletList)
        controller.toggleHeading(1)
        XCTAssertEqual(savedBody.last?.nodeType, "bulletList", "a list item must keep starting with a paragraph")
    }

    func testTypingAtStartOfListItemStaysInList() throws {
        try open(twoParagraphs)
        select("beta")
        controller.toggleList(.bulletList)
        textView.setSelectedRange(NSRange(location: (textView.string as NSString).range(of: "beta").location, length: 0))
        textView.insertText("x", replacementRange: textView.selectedRange())
        XCTAssertEqual(savedBody.last?.nodeType, "bulletList")
        XCTAssertEqual(savedBody.last?.children.first?.children.first?.children.first?["text"], .string("xbeta"))
    }

    func testAlignmentAndColors() throws {
        try open(twoParagraphs)
        select("alpha")
        controller.setAlign("center")
        controller.setColor("#2563eb")
        controller.toggleHighlight("#bbf7d0")
        controller.setFontSize(text: "99")
        let paragraph = savedBody.first
        XCTAssertEqual(paragraph?.attrs["textAlign"], .string("center"))
        let marks = paragraph?.children.first?["marks"]?.arrayValue ?? []
        XCTAssertEqual(marks.first(where: { $0.nodeType == "textStyle" })?.attrs["color"], .string("#2563eb"))
        XCTAssertEqual(marks.first(where: { $0.nodeType == "textStyle" })?.attrs["fontSize"], .string("50px"), "sizes clamp to 50 like the web field")
        XCTAssertEqual(marks.first(where: { $0.nodeType == "highlight" })?.attrs["color"], .string("#bbf7d0"))
    }

    /// A highlight ending a paragraph must stop at the text, not paint the
    /// rest of the line — both when a note is opened and after Return.
    func testHighlightDoesNotSpillPastLineEnd() throws {
        try open(#"""
        {"type":"doc","content":[
          {"type":"paragraph","content":[{"type":"text","text":"Title"}]},
          {"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","marks":[{"type":"highlight","attrs":{"color":"#fef08a"}}],"text":"marked"}]},
          {"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"next"}]}
        ]}
        """#)
        let storage = textView.textStorage!
        let newline = (textView.string as NSString).range(of: "\n").location
        XCTAssertNotNil(storage.attribute(.backgroundColor, at: newline - 1, effectiveRange: nil), "the text itself stays highlighted")
        XCTAssertNil(storage.attribute(.backgroundColor, at: newline, effectiveRange: nil))

        textView.setSelectedRange(NSRange(location: newline, length: 0))
        textView.insertText("\n", replacementRange: textView.selectedRange())
        XCTAssertNil(storage.attribute(.backgroundColor, at: newline, effectiveRange: nil))
        XCTAssertNil(storage.attribute(.backgroundColor, at: newline + 1, effectiveRange: nil))
    }

    func testCancelRestoresOriginal() throws {
        try open(twoParagraphs)
        let original = store.node(noteID)!.content
        select("alpha")
        controller.toggleBold()
        XCTAssertNotEqual(store.node(noteID)!.content, original)
        controller.cancel()
        XCTAssertEqual(store.node(noteID)!.content, original)
        XCTAssertNil(store.editingNoteID)
    }

    /// An image dropped onto an empty tile becomes the note's only block
    /// (the web app's `appendImageBlock`). The native editor keeps it in
    /// the body rather than treating it as an (empty) title and losing it.
    func testImageFirstNoteKeepsImage() throws {
        try open(#"{"type":"doc","content":[{"type":"image","attrs":{"src":"data:image/jpeg;base64,AAAA"}}]}"#)
        XCTAssertEqual(controller.title, "")
        controller.setTitle("Photo")
        let blocks = store.node(noteID)!.content!.children
        XCTAssertEqual(blocks.map(\.nodeType), ["paragraph", "image"])
    }
}
