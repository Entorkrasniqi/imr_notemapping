import XCTest
@testable import NoteMap

/// Answers the app's HTTP requests from a closure and records them, so a
/// test can check what `BoardsAPI` sent and in what order.
final class StubURLProtocol: URLProtocol {
    struct Recorded {
        let method: String
        let url: URL
        let headers: [String: String]
        let body: Data?

        var summary: String { "\(method) \(url.path)" }
        var query: [String: String] {
            let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
            return Dictionary(uniqueKeysWithValues: items.map { ($0.name, $0.value ?? "") })
        }
    }

    private static let lock = NSLock()
    private static var recorded: [Recorded] = []
    static var respond: (Recorded) -> (status: Int, body: String) = { _ in (500, "") }

    static var requests: [Recorded] {
        lock.lock(); defer { lock.unlock() }
        return recorded
    }

    static func reset() {
        lock.lock(); defer { lock.unlock() }
        recorded = []
        respond = { _ in (500, "") }
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func stopLoading() {}

    override func startLoading() {
        // URLSession hands a request body to the protocol as a stream.
        var body = request.httpBody
        if body == nil, let stream = request.httpBodyStream {
            stream.open()
            var data = Data()
            var buffer = [UInt8](repeating: 0, count: 4096)
            while stream.hasBytesAvailable {
                let count = stream.read(&buffer, maxLength: buffer.count)
                if count <= 0 { break }
                data.append(buffer, count: count)
            }
            stream.close()
            body = data
        }
        let call = Recorded(method: request.httpMethod ?? "GET", url: request.url!,
                            headers: request.allHTTPHeaderFields ?? [:], body: body)
        Self.lock.lock()
        Self.recorded.append(call)
        let respond = Self.respond
        Self.lock.unlock()

        let (status, text) = respond(call)
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: "HTTP/1.1",
                                       headerFields: ["Content-Type": "application/json"])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(text.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }
}

/// Deleting a board must also remove its uploaded files from Storage —
/// the database cascade only removes the rows, and Storage then refuses to
/// let anyone delete the orphaned files (its policies need the row). The
/// web app does this in `removeStoredFilesForBoard`; the Mac app has to too.
final class BoardDeletionTests: XCTestCase {
    private var client: SupabaseClient!

    override func setUp() async throws {
        StubURLProtocol.reset()
        let config = AppConfig(supabaseURL: URL(string: "https://example.supabase.test")!, supabaseAnonKey: "anon-key", webAppURL: nil)
        // A throwaway Keychain item, so tests never touch the real session.
        client = SupabaseClient(
            config: config,
            keychain: KeychainItem(service: "com.scriptumos.tests.\(UUID().uuidString)", account: "session"),
            protocolClasses: [StubURLProtocol.self]
        )
        await client.sessions.set(AuthSession(accessToken: "access-token", refreshToken: "refresh-token",
                                              expiresAt: Date().addingTimeInterval(3600), userID: "u1", email: nil))
    }

    override func tearDown() async throws {
        await client.sessions.set(nil)
        StubURLProtocol.reset()
    }

    private func calls() -> [String] { StubURLProtocol.requests.map(\.summary) }

    func testRemovesStoredFilesBeforeDeletingTheBoard() async throws {
        StubURLProtocol.respond = { call in
            switch call.summary {
            case "GET /rest/v1/board_files":
                // A web link has no stored file; it must be skipped.
                return (200, #"[{"storage_path":"u1/b1/f1.pdf"},{"storage_path":null},{"storage_path":"u1/b1/f2.png"}]"#)
            case "DELETE /storage/v1/object/board-files": return (200, "[]")
            default: return (204, "")
            }
        }

        try await BoardsAPI.deleteBoard(client, id: "b1")

        // Files first: once the board row is gone, so is the right to delete them.
        XCTAssertEqual(calls(), ["GET /rest/v1/board_files", "DELETE /storage/v1/object/board-files", "DELETE /rest/v1/boards"])
        // The checks below index the calls; the assertion above already failed if they're missing.
        guard StubURLProtocol.requests.count == 3 else { return }

        let list = StubURLProtocol.requests[0]
        XCTAssertEqual(list.query["select"], "storage_path")
        XCTAssertEqual(list.query["board_id"], "eq.b1")

        let remove = StubURLProtocol.requests[1]
        let body = try JSONSerialization.jsonObject(with: try XCTUnwrap(remove.body)) as? [String: [String]]
        XCTAssertEqual(body, ["prefixes": ["u1/b1/f1.pdf", "u1/b1/f2.png"]])
        XCTAssertEqual(remove.headers["Authorization"], "Bearer access-token")
        XCTAssertEqual(remove.headers["apikey"], "anon-key")
        XCTAssertEqual(remove.headers["Content-Type"], "application/json")

        XCTAssertEqual(StubURLProtocol.requests[2].query["id"], "eq.b1")
    }

    func testBoardWithoutFilesMakesNoStorageCall() async throws {
        StubURLProtocol.respond = { call in call.method == "GET" ? (200, "[]") : (204, "") }
        try await BoardsAPI.deleteBoard(client, id: "b1")
        XCTAssertEqual(calls(), ["GET /rest/v1/board_files", "DELETE /rest/v1/boards"])
    }

    func testBoardWithOnlyLinksMakesNoStorageCall() async throws {
        StubURLProtocol.respond = { call in call.method == "GET" ? (200, #"[{"storage_path":null}]"#) : (204, "") }
        try await BoardsAPI.deleteBoard(client, id: "b1")
        XCTAssertEqual(calls(), ["GET /rest/v1/board_files", "DELETE /rest/v1/boards"])
    }

    /// A database without the board_files migration answers 404 for the table.
    func testBoardIsStillDeletedWhereFileStorageIsNotSetUp() async throws {
        StubURLProtocol.respond = { call in
            call.method == "GET"
                ? (404, #"{"code":"42P01","message":"relation \"public.board_files\" does not exist"}"#)
                : (204, "")
        }
        try await BoardsAPI.deleteBoard(client, id: "b1")
        XCTAssertEqual(calls(), ["GET /rest/v1/board_files", "DELETE /rest/v1/boards"])
    }

    func testBoardIsStillDeletedWhenStorageFails() async throws {
        StubURLProtocol.respond = { call in
            switch call.summary {
            case "GET /rest/v1/board_files": return (200, #"[{"storage_path":"u1/b1/f1.pdf"}]"#)
            case "DELETE /storage/v1/object/board-files": return (500, #"{"message":"storage is down"}"#)
            default: return (204, "")
            }
        }
        try await BoardsAPI.deleteBoard(client, id: "b1")
        XCTAssertEqual(calls().last, "DELETE /rest/v1/boards")
    }

    /// Only the cleanup is best effort; failing to delete the board is
    /// still an error the dashboard shows.
    func testFailureToDeleteTheBoardStillSurfaces() async throws {
        StubURLProtocol.respond = { call in
            switch call.summary {
            case "GET /rest/v1/board_files": return (200, "[]")
            default: return (500, #"{"message":"boom"}"#)
            }
        }
        do {
            try await BoardsAPI.deleteBoard(client, id: "b1")
            XCTFail("expected deleteBoard to throw")
        } catch SupabaseError.postgrest(let status, _, let message) {
            XCTAssertEqual(status, 500)
            XCTAssertEqual(message, "boom")
        }
    }
}
