import XCTest
@testable import NoteMap

/// The native editor must hand back exactly what the web app's Tiptap
/// editor would have stored, or notes edited on one client could render
/// differently — or fail to load — on the other. These fixtures are in
/// Tiptap's own `getJSON()` shape for the extensions in
/// `lib/editor/extensions.ts` (checked against the real schema with the
/// script in `macos/README.md`), so an unedited round trip must be exact.
final class TiptapConverterTests: XCTestCase {
    private func roundTrip(_ json: String, file: StaticString = #filePath, line: UInt = #line) throws {
        let document = try JSONValue.decode(Data(json.utf8))
        let imported = TiptapConverter.importDocument(document, context: .editor(.light))
        let exported = TiptapConverter.exportDocument(imported.text, trailingBlock: imported.trailingBlock)
        XCTAssertEqual(exported, document, "round trip changed the document", file: file, line: line)
    }

    func testMarksRoundTrip() throws {
        try roundTrip(#"""
        {"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[
          {"type":"text","text":"plain "},
          {"type":"text","marks":[{"type":"bold"}],"text":"bold "},
          {"type":"text","marks":[{"type":"bold"},{"type":"italic"}],"text":"bold italic "},
          {"type":"text","marks":[{"type":"underline"}],"text":"underline "},
          {"type":"text","marks":[{"type":"strike"}],"text":"strike "},
          {"type":"text","marks":[{"type":"code"}],"text":"code "},
          {"type":"text","marks":[{"type":"textStyle","attrs":{"color":"#dc2626","fontSize":null,"fontFamily":null}}],"text":"red "},
          {"type":"text","marks":[{"type":"textStyle","attrs":{"color":null,"fontSize":"24px","fontFamily":"Georgia, 'Times New Roman', Times, serif"}}],"text":"big serif "},
          {"type":"text","marks":[{"type":"highlight","attrs":{"color":"#fef08a"}}],"text":"highlighted"},
          {"type":"hardBreak"},
          {"type":"text","marks":[{"type":"link","attrs":{"href":"https://example.com","target":"_blank","rel":"noopener noreferrer nofollow","class":null,"title":null}},{"type":"bold"}],"text":"link"}
        ]}]}
        """#)
    }

    func testHeadingsAndAlignmentRoundTrip() throws {
        try roundTrip(#"""
        {"type":"doc","content":[
          {"type":"heading","attrs":{"textAlign":"center","level":1},"content":[{"type":"text","text":"One"}]},
          {"type":"heading","attrs":{"textAlign":null,"level":2},"content":[{"type":"text","text":"Two"}]},
          {"type":"heading","attrs":{"textAlign":"right","level":3},"content":[{"type":"text","text":"Three"}]},
          {"type":"paragraph","attrs":{"textAlign":"justify"},"content":[{"type":"text","text":"Body"}]}
        ]}
        """#)
    }

    func testNestedListsRoundTrip() throws {
        try roundTrip(#"""
        {"type":"doc","content":[
          {"type":"bulletList","content":[
            {"type":"listItem","content":[
              {"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"first"}]},
              {"type":"orderedList","attrs":{"start":3,"type":null},"content":[
                {"type":"listItem","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"three"}]}]},
                {"type":"listItem","content":[
                  {"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"four"}]},
                  {"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"four, second paragraph"}]}
                ]}
              ]},
              {"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"back in first"}]}
            ]},
            {"type":"listItem","content":[{"type":"paragraph","attrs":{"textAlign":null}}]}
          ]},
          {"type":"bulletList","content":[
            {"type":"listItem","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"a separate list"}]}]}
          ]}
        ]}
        """#)
    }

    func testBlockquoteCodeAndAtomsRoundTrip() throws {
        try roundTrip(#"""
        {"type":"doc","content":[
          {"type":"blockquote","content":[
            {"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"quoted"}]},
            {"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"in a quote"}]}]}]}
          ]},
          {"type":"codeBlock","attrs":{"language":"swift"},"content":[{"type":"text","text":"let a = 1\n\nlet b = 2"}]},
          {"type":"codeBlock","attrs":{"language":null}},
          {"type":"image","attrs":{"src":"data:image/jpeg;base64,AAAA","alt":null,"title":null,"width":null,"height":null}},
          {"type":"horizontalRule"},
          {"type":"table","content":[{"type":"tableRow","content":[]}]},
          {"type":"paragraph","attrs":{"textAlign":null},"content":[
            {"type":"text","text":"before "},
            {"type":"mention","attrs":{"id":"42"}},
            {"type":"text","text":" after"}
          ]},
          {"type":"bulletList","content":[{"type":"listItem","content":[
            {"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"item with image"}]},
            {"type":"image","attrs":{"src":"data:image/jpeg;base64,BBBB","alt":null,"title":null,"width":null,"height":null}}
          ]}]}
        ]}
        """#)
    }

    func testEmptyParagraphsRoundTrip() throws {
        try roundTrip(#"{"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":null}}]}"#)
        try roundTrip(#"""
        {"type":"doc","content":[
          {"type":"paragraph","attrs":{"textAlign":null}},
          {"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"middle"}]},
          {"type":"paragraph","attrs":{"textAlign":null}},
          {"type":"heading","attrs":{"textAlign":null,"level":2}}
        ]}
        """#)
    }

    /// Whatever the flattened text looks like, the output must satisfy
    /// Tiptap's schema: a list item starts with a paragraph.
    func testListItemAlwaysStartsWithParagraph() {
        let list = BlockContainer.list(.bulletList)
        let context = TextStyleContext.editor(.light)
        let image = AtomBox(kind: .image, json: .node("image", attrs: ["src": .string("data:x")]))
        let text = NSMutableAttributedString(attributedString: TiptapConverter.atomString(
            image, block: BlockStyle.paragraph.with(containers: [list], startsItem: true), context: context))

        let document = TiptapConverter.exportDocument(text, trailingBlock: nil)
        let item = document.children.first?.children.first
        XCTAssertEqual(document.children.first?.nodeType, "bulletList")
        XCTAssertEqual(item?.children.map(\.nodeType), ["paragraph", "image"])
    }

    func testEmptyDocumentExportsOneParagraph() {
        let document = TiptapConverter.exportDocument(NSAttributedString(), trailingBlock: nil)
        XCTAssertEqual(document, .node("doc", content: [.node("paragraph", attrs: ["textAlign": .null])]))
    }

    func testTilePreviewShowsOnlyFirstBlock() throws {
        let document = try JSONValue.decode(Data(#"""
        {"type":"doc","content":[
          {"type":"paragraph","content":[{"type":"text","text":"Title"},{"type":"hardBreak"},{"type":"text","text":"more"}]},
          {"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Body"}]}
        ]}
        """#.utf8))
        let render = TilePreview.render(document, revision: 0, theme: .light)
        guard case .text(let text) = render.content else { return XCTFail("expected text") }
        XCTAssertEqual(text.string, "Title more")
        XCTAssertTrue(render.hasMore)

        let empty = TilePreview.render(.node("doc", content: [.node("paragraph")]), revision: 0, theme: .light)
        guard case .placeholder = empty.content else { return XCTFail("expected placeholder") }
    }
}
