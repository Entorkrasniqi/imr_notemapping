import Foundation

/// The board id doesn't resolve to a row the caller owns — never existed,
/// deleted elsewhere, or someone else's. RLS makes those indistinguishable,
/// on purpose (see `BoardNotFoundError` in lib/supabase/board-sync.ts).
struct BoardNotFoundError: Error {}

/// Canvas load/save — a port of the web app's `lib/supabase/board-sync.ts`.
enum BoardSyncAPI {
    static func verifyBoardAccess(_ client: SupabaseClient, boardID: String) async throws {
        let data = try await client.rest("GET", "boards", query: [
            URLQueryItem(name: "select", value: "id"),
            URLQueryItem(name: "id", value: "eq.\(boardID)"),
        ])
        struct Row: Decodable { let id: String }
        if try JSONDecoder().decode([Row].self, from: data).isEmpty {
            throw BoardNotFoundError()
        }
    }

    static func fetchBoardContents(_ client: SupabaseClient, boardID: String) async throws -> (nodes: [NoteNode], edges: [BoardEdge]) {
        let filter = [
            URLQueryItem(name: "select", value: "*"),
            URLQueryItem(name: "board_id", value: "eq.\(boardID)"),
        ]
        async let nodeData = client.rest("GET", "nodes", query: filter)
        async let edgeData = client.rest("GET", "edges", query: filter)
        let nodeRows = try JSONDecoder().decode([NodeRow].self, from: try await nodeData)
        let edgeRows = try JSONDecoder().decode([EdgeRow].self, from: try await edgeData)
        return (nodeRows.map(BoardMapping.noteNode(from:)), edgeRows.map(BoardMapping.boardEdge(from:)))
    }

    struct Changes {
        var nodeIDsToDelete: [String] = []
        var edgeIDsToDelete: [String] = []
        var nodeRows: [NodeRow] = []
        var edgeRows: [EdgeRow] = []

        var isEmpty: Bool {
            nodeIDsToDelete.isEmpty && edgeIDsToDelete.isEmpty && nodeRows.isEmpty && edgeRows.isEmpty
        }
    }

    /// Same ordering as `syncBoardToSupabase`: edge deletes, node deletes,
    /// node upserts, edge upserts — so a new edge's notes always exist by
    /// the time the edge is written. Unlike the web version, only rows that
    /// actually changed are upserted (the caller tracks which ones), rather
    /// than the whole board on every save — noticeably less upload for
    /// boards whose notes carry embedded images.
    static func sync(_ client: SupabaseClient, _ changes: Changes) async throws {
        if !changes.edgeIDsToDelete.isEmpty {
            _ = try await client.rest("DELETE", "edges", query: [inFilter(changes.edgeIDsToDelete)])
        }
        if !changes.nodeIDsToDelete.isEmpty {
            _ = try await client.rest("DELETE", "nodes", query: [inFilter(changes.nodeIDsToDelete)])
        }
        if !changes.nodeRows.isEmpty {
            _ = try await client.rest("POST", "nodes", body: try JSONEncoder().encode(changes.nodeRows),
                                      prefer: "resolution=merge-duplicates,return=minimal")
        }
        if !changes.edgeRows.isEmpty {
            _ = try await client.rest("POST", "edges", body: try JSONEncoder().encode(changes.edgeRows),
                                      prefer: "resolution=merge-duplicates,return=minimal")
        }
    }

    private static func inFilter(_ ids: [String]) -> URLQueryItem {
        URLQueryItem(name: "id", value: "in.(\(ids.joined(separator: ",")))")
    }
}
