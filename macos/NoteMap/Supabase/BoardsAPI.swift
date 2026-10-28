import Foundation

struct BoardSummary: Identifiable, Hashable {
    let id: String
    var name: String
    var updatedAt: Date
    var noteCount: Int
}

/// Thrown when the free-plan limit trigger rejects a board creation.
struct BoardLimitError: LocalizedError {
    var errorDescription: String? { "Free plan is limited to \(BoardsAPI.freePlanBoardLimit) boards" }
}

/// Dashboard queries — a port of the web app's `lib/supabase/boards.ts`.
/// As there, nothing filters by `user_id` explicitly: RLS already scopes
/// every query to the caller's own rows.
enum BoardsAPI {
    /// UI-only mirror of `enforce_free_plan_board_limit` — the trigger is
    /// the real enforcement (see the comment on `FREE_PLAN_BOARD_LIMIT`).
    static let freePlanBoardLimit = 3

    static func userPlan(_ client: SupabaseClient) async throws -> String {
        guard let session = await client.sessions.current() else { throw SupabaseError.notAuthenticated }
        let data = try await client.rest("GET", "profiles", query: [
            URLQueryItem(name: "select", value: "plan"),
            URLQueryItem(name: "id", value: "eq.\(session.userID)"),
        ])
        struct Row: Decodable { let plan: String }
        guard let row = try JSONDecoder().decode([Row].self, from: data).first else {
            throw SupabaseError.postgrest(status: 406, code: nil, message: "No profile found for this account.")
        }
        return row.plan
    }

    /// Most recently updated first, with the note count computed by
    /// Postgres via PostgREST's embedded count (`nodes(count)`).
    static func listBoards(_ client: SupabaseClient) async throws -> [BoardSummary] {
        let data = try await client.rest("GET", "boards", query: [
            URLQueryItem(name: "select", value: "id,name,updated_at,nodes(count)"),
            URLQueryItem(name: "order", value: "updated_at.desc"),
        ])
        struct Row: Decodable {
            struct Count: Decodable { let count: Int }
            let id: String
            let name: String
            let updated_at: String
            let nodes: [Count]
        }
        return try JSONDecoder().decode([Row].self, from: data).map { row in
            BoardSummary(
                id: row.id,
                name: row.name,
                updatedAt: PostgresDate.parse(row.updated_at) ?? Date(),
                noteCount: row.nodes.first?.count ?? 0
            )
        }
    }

    /// `user_id` is filled in by Postgres from the JWT (`default auth.uid()`).
    static func createBoard(_ client: SupabaseClient, name: String) async throws -> BoardSummary {
        let data: Data
        do {
            data = try await client.rest(
                "POST", "boards",
                query: [URLQueryItem(name: "select", value: "id,name,updated_at")],
                body: try JSONEncoder().encode(["name": name]),
                prefer: "return=representation"
            )
        } catch SupabaseError.postgrest(_, "P0001", _) {
            throw BoardLimitError()
        }
        struct Row: Decodable {
            let id: String
            let name: String
            let updated_at: String
        }
        guard let row = try JSONDecoder().decode([Row].self, from: data).first else {
            throw SupabaseError.invalidResponse
        }
        return BoardSummary(id: row.id, name: row.name, updatedAt: PostgresDate.parse(row.updated_at) ?? Date(), noteCount: 0)
    }

    static func renameBoard(_ client: SupabaseClient, id: String, name: String) async throws {
        _ = try await client.rest(
            "PATCH", "boards",
            query: [URLQueryItem(name: "id", value: "eq.\(id)")],
            body: try JSONEncoder().encode(["name": name]),
            prefer: "return=minimal"
        )
    }

    /// `on delete cascade` on nodes/edges (and board_files) handles the rest
    /// of the database; the uploaded files live in Storage and need removing
    /// by hand, first — Storage lets a user delete a file only while its
    /// `board_files` row still exists. Same order as `deleteBoard` on the web.
    static func deleteBoard(_ client: SupabaseClient, id: String) async throws {
        await removeStoredFiles(client, boardID: id)
        _ = try await client.rest("DELETE", "boards", query: [URLQueryItem(name: "id", value: "eq.\(id)")])
    }

    /// Bucket the web app uploads board files to (`BOARD_FILES_BUCKET`).
    static let boardFilesBucket = "board-files"

    /// Best effort, like the web: a board must stay deletable where file
    /// storage isn't set up (no `board_files` table yet) or Storage is down.
    /// The worst case is some unreachable bytes, not a board that can't go.
    /// Links have no `storage_path`, so only real uploads are removed.
    private static func removeStoredFiles(_ client: SupabaseClient, boardID: String) async {
        struct Row: Decodable { let storage_path: String? }
        do {
            let data = try await client.rest("GET", "board_files", query: [
                URLQueryItem(name: "select", value: "storage_path"),
                URLQueryItem(name: "board_id", value: "eq.\(boardID)"),
            ])
            let paths = try JSONDecoder().decode([Row].self, from: data).compactMap(\.storage_path).filter { !$0.isEmpty }
            try await client.removeStorageObjects(bucket: boardFilesBucket, paths: paths)
        } catch {
            // Intentionally ignored; see above.
        }
    }
}
