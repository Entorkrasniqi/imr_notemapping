import XCTest
@testable import NoteMap

final class ModelTests: XCTestCase {
    func testJSONKeepsIntegersIntegral() throws {
        let value = try JSONValue.decode(Data(#"{"level":1,"ratio":1.5,"flag":true,"none":null}"#.utf8))
        XCTAssertEqual(value["level"], .int(1))
        XCTAssertEqual(value["ratio"], .double(1.5))
        XCTAssertEqual(value["flag"], .bool(true))
        XCTAssertEqual(value["none"], .null)
        XCTAssertEqual(try JSONValue.decode(value.encodedData()), value)
    }

    /// `content` can't be SQL NULL — `{}` in the database is `nil` in the
    /// app and back (board-mapping.ts).
    func testEmptyContentMapping() {
        let row = NodeRow(id: "n", board_id: "b", type: "note", position_x: 1, position_y: 2,
                          width: 240, height: 56, content: .object([:]), expanded_height: nil)
        let node = BoardMapping.noteNode(from: row)
        XCTAssertNil(node.content)
        XCTAssertEqual(BoardMapping.row(from: node, boardID: "b").content, .object([:]))
    }

    /// PostgREST rejects a bulk insert whose objects don't share keys.
    func testRowsEncodeExplicitNulls() throws {
        let node = NodeRow(id: "n", board_id: "b", type: "note", position_x: 0, position_y: 0,
                           width: 240, height: 56, content: .object([:]), expanded_height: nil)
        let edge = EdgeRow(id: "e", board_id: "b", source_node_id: "n", target_node_id: "m",
                           source_handle: nil, target_handle: "left-0.5")
        let nodeJSON = try JSONSerialization.jsonObject(with: JSONEncoder().encode(node)) as? [String: Any]
        let edgeJSON = try JSONSerialization.jsonObject(with: JSONEncoder().encode(edge)) as? [String: Any]
        XCTAssertTrue(nodeJSON?["expanded_height"] is NSNull)
        XCTAssertTrue(edgeJSON?["source_handle"] is NSNull)
    }

    func testTitleAndBodyHelpersMatchWeb() throws {
        let content = try JSONValue.decode(Data(#"""
        {"type":"doc","content":[
          {"type":"heading","attrs":{"level":1},"content":[{"type":"text","marks":[{"type":"bold"}],"text":"Hello "},{"type":"text","text":"world"}]},
          {"type":"paragraph","content":[{"type":"text","text":"body"}]}
        ]}
        """#.utf8))
        XCTAssertEqual(NoteContent.titleText(content), "Hello world")
        XCTAssertEqual(NoteContent.bodyDocument(content).children.count, 1)
        XCTAssertEqual(NoteContent.bodyDocument(nil), .node("doc", content: [.node("paragraph")]))
        XCTAssertTrue(NoteContent.isEmpty(.node("doc", content: [.node("paragraph"), .node("paragraph")])))

        let rebuilt = NoteContent.document(title: "T", body: NoteContent.bodyDocument(content))
        XCTAssertEqual(rebuilt.children.first, .node("paragraph", content: [.object(["type": .string("text"), "text": .string("T")])]))
        XCTAssertEqual(NoteContent.document(title: "", body: .node("doc", content: [])).children, [.node("paragraph")])
    }

    func testAppendImageMatchesWeb() {
        let image = JSONValue.node("image", attrs: ["src": .string("data:x")])
        XCTAssertEqual(NoteContent.appendingImage(to: nil, src: "data:x"), .node("doc", content: [image]))
        let existing = JSONValue.node("doc", content: [.node("paragraph", content: [.object(["type": .string("text"), "text": .string("a")])])])
        XCTAssertEqual(NoteContent.appendingImage(to: existing, src: "data:x").children.last, image)
    }

    func testPostgresTimestamps() {
        XCTAssertNotNil(PostgresDate.parse("2026-09-10T12:34:56.123456+00:00"))
        XCTAssertNotNil(PostgresDate.parse("2026-09-10T12:34:56+00:00"))
        XCTAssertNotNil(PostgresDate.parse("2026-09-10T12:34:56.1Z"))
        let date = PostgresDate.parse("2026-09-10T12:00:00.500000+00:00")!
        XCTAssertEqual(date.timeIntervalSince1970.truncatingRemainder(dividingBy: 1), 0.5, accuracy: 0.001)
    }
}
