import Foundation
import CoreGraphics

/// A row in the `nodes` table, as Postgres stores it — the Swift twin of
/// `NodeRow` in the web app's `lib/supabase/board-mapping.ts`.
struct NodeRow: Codable {
    let id: String
    let board_id: String
    let type: String
    let position_x: Double
    let position_y: Double
    let width: Double
    let height: Double
    let content: JSONValue
    let expanded_height: Double?

    // PostgREST requires every object in a bulk insert to carry the same
    // keys, so a missing optional is written as an explicit `null` instead
    // of being omitted (which the synthesized encoder would do).
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(board_id, forKey: .board_id)
        try container.encode(type, forKey: .type)
        try container.encode(position_x, forKey: .position_x)
        try container.encode(position_y, forKey: .position_y)
        try container.encode(width, forKey: .width)
        try container.encode(height, forKey: .height)
        try container.encode(content, forKey: .content)
        try container.encode(expanded_height, forKey: .expanded_height)
    }
}

/// A row in the `edges` table (`EdgeRow` in board-mapping.ts).
struct EdgeRow: Codable {
    let id: String
    let board_id: String
    let source_node_id: String
    let target_node_id: String
    let source_handle: String?
    let target_handle: String?

    /// Explicit `null`s, for the same reason as `NodeRow.encode(to:)`.
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(board_id, forKey: .board_id)
        try container.encode(source_node_id, forKey: .source_node_id)
        try container.encode(target_node_id, forKey: .target_node_id)
        try container.encode(source_handle, forKey: .source_handle)
        try container.encode(target_handle, forKey: .target_handle)
    }
}

/// Row ↔ canvas translation, kept deliberately identical to the web app's
/// `board-mapping.ts` so both clients read and write the same shapes.
enum BoardMapping {
    /// `board-mapping.ts` falls back to these when a node has no size yet.
    private static let defaultWidth = 240.0
    private static let defaultHeight = 160.0

    /// `content jsonb not null default '{}'` can't hold SQL `NULL`, so an
    /// empty note is `{}` in the database and `nil` in the app.
    private static func isEmptyRowContent(_ content: JSONValue) -> Bool {
        switch content {
        case .null: return true
        case .object(let object): return object.isEmpty
        default: return false
        }
    }

    static func noteNode(from row: NodeRow) -> NoteNode {
        NoteNode(
            id: row.id,
            position: CGPoint(x: row.position_x, y: row.position_y),
            width: CGFloat(row.width),
            height: CGFloat(row.height),
            content: isEmptyRowContent(row.content) ? nil : row.content,
            expandedHeight: row.expanded_height
        )
    }

    static func row(from node: NoteNode, boardID: String) -> NodeRow {
        NodeRow(
            id: node.id,
            board_id: boardID,
            type: "note",
            position_x: Double(node.position.x),
            position_y: Double(node.position.y),
            width: node.width > 0 ? Double(node.width) : defaultWidth,
            height: node.height > 0 ? Double(node.height) : defaultHeight,
            content: node.content ?? .object([:]),
            expanded_height: node.expandedHeight
        )
    }

    static func boardEdge(from row: EdgeRow) -> BoardEdge {
        BoardEdge(
            id: row.id,
            source: row.source_node_id,
            target: row.target_node_id,
            sourceHandle: row.source_handle,
            targetHandle: row.target_handle
        )
    }

    static func row(from edge: BoardEdge, boardID: String) -> EdgeRow {
        EdgeRow(
            id: edge.id,
            board_id: boardID,
            source_node_id: edge.source,
            target_node_id: edge.target,
            source_handle: edge.sourceHandle,
            target_handle: edge.targetHandle
        )
    }
}
