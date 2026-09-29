import Foundation

enum SupabaseError: LocalizedError {
    case notAuthenticated
    /// Rejected by Supabase Auth — wrong password, taken email, and so on.
    /// The message is Supabase's own and is shown to the user as-is, the
    /// same way the web login/signup pages show `error.message`.
    case auth(String)
    /// Rejected by PostgREST; `code` is the Postgres/PostgREST error code
    /// (`P0001` for the free-plan board limit trigger, for example).
    case postgrest(status: Int, code: String?, message: String)
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .notAuthenticated: return "You're signed out. Please log in again."
        case .auth(let message): return message
        case .postgrest(_, _, let message): return message
        case .invalidResponse: return "Unexpected response from the server."
        }
    }
}

/// A deliberately small Supabase client: just the Auth (GoTrue) and
/// PostgREST endpoints this app actually uses — the same calls the web
/// app makes through `@supabase/supabase-js`, spelled out as plain HTTP.
///
/// Why not the official `supabase-swift` package: it would work, but the
/// surface used here is a handful of requests, and staying dependency-free
/// means the project opens and builds in Xcode with nothing to resolve or
/// keep in step with the JS client's versions.
///
/// Everything authorization-related still happens in Postgres: every REST
/// call carries the user's JWT, and Row Level Security scopes it exactly
/// as it does for the browser (see docs/database.md §5).
final class SupabaseClient: @unchecked Sendable {
    let config: AppConfig
    let sessions: SessionStore
    private let http: URLSession

    /// Called when the session can't be recovered (refresh token rejected),
    /// so the app can drop back to the login screen — the native stand-in
    /// for `proxy.ts` redirecting a signed-out request to `/login`.
    var onSessionExpired: (@MainActor () -> Void)?

    init(config: AppConfig) {
        self.config = config
        let bundleID = Bundle.main.bundleIdentifier ?? "com.scriptumos.ScriptumOS"
        sessions = SessionStore(keychain: KeychainItem(service: "\(bundleID).auth", account: "supabase-session"))
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 30
        configuration.waitsForConnectivity = false
        http = URLSession(configuration: configuration)
    }

    // MARK: - Auth

    /// The persisted session from a previous launch, refreshed if needed.
    /// A network failure keeps the stored session rather than signing the
    /// user out — the dashboard's "Couldn't reach the database" state is
    /// the right place to surface being offline, not the login screen.
    func restoreSession() async -> AuthSession? {
        guard await sessions.loadPersisted() != nil else { return nil }
        do {
            return try await sessions.validSession(refresh: { try await self.refreshSession(refreshToken: $0) })
        } catch SupabaseError.notAuthenticated {
            return nil
        } catch {
            return await sessions.current()
        }
    }

    func signIn(email: String, password: String) async throws -> AuthSession {
        let data = try await authRequest(
            path: "token",
            query: [URLQueryItem(name: "grant_type", value: "password")],
            body: ["email": email, "password": password]
        )
        guard let session = try Self.decodeSession(data) else { throw SupabaseError.invalidResponse }
        await sessions.set(session)
        return session
    }

    /// Returns `nil` when the account was created but needs email
    /// confirmation first — the same fallback the web signup page has.
    func signUp(email: String, password: String) async throws -> AuthSession? {
        let data = try await authRequest(path: "signup", body: ["email": email, "password": password])
        guard let session = try Self.decodeSession(data) else { return nil }
        await sessions.set(session)
        return session
    }

    func signOut() async {
        if let session = await sessions.current() {
            var request = URLRequest(url: authURL("logout", query: [URLQueryItem(name: "scope", value: "global")]))
            request.httpMethod = "POST"
            request.setValue(config.supabaseAnonKey, forHTTPHeaderField: "apikey")
            request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
            // Best effort: the local session is cleared regardless, just as
            // supabase-js clears its storage even if the request fails.
            _ = try? await http.data(for: request)
        }
        await sessions.set(nil)
    }

    private func refreshSession(refreshToken: String) async throws -> AuthSession {
        let data = try await authRequest(
            path: "token",
            query: [URLQueryItem(name: "grant_type", value: "refresh_token")],
            body: ["refresh_token": refreshToken]
        )
        guard let session = try Self.decodeSession(data) else { throw SupabaseError.invalidResponse }
        return session
    }

    private func authURL(_ path: String, query: [URLQueryItem] = []) -> URL {
        var components = URLComponents(
            url: config.supabaseURL.appendingPathComponent("auth/v1/\(path)"),
            resolvingAgainstBaseURL: false
        )!
        if !query.isEmpty { components.queryItems = query }
        return components.url!
    }

    private func authRequest(path: String, query: [URLQueryItem] = [], body: [String: String]) async throws -> Data {
        var request = URLRequest(url: authURL(path, query: query))
        request.httpMethod = "POST"
        request.setValue(config.supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await http.data(for: request)
        guard let status = (response as? HTTPURLResponse)?.statusCode else { throw SupabaseError.invalidResponse }
        guard (200..<300).contains(status) else {
            throw SupabaseError.auth(Self.errorMessage(from: data) ?? "Authentication failed (HTTP \(status)).")
        }
        return data
    }

    private struct TokenResponse: Decodable {
        struct User: Decodable {
            let id: String
            let email: String?
        }
        let access_token: String?
        let refresh_token: String?
        let expires_in: Double?
        let expires_at: Double?
        let user: User?
    }

    private static func decodeSession(_ data: Data) throws -> AuthSession? {
        let response = try JSONDecoder().decode(TokenResponse.self, from: data)
        guard
            let accessToken = response.access_token,
            let refreshToken = response.refresh_token,
            let user = response.user
        else { return nil }
        let expiresAt = response.expires_at.map { Date(timeIntervalSince1970: $0) }
            ?? Date().addingTimeInterval(response.expires_in ?? 3600)
        return AuthSession(
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresAt: expiresAt,
            userID: user.id,
            email: user.email
        )
    }

    /// Supabase Auth and PostgREST each have a few error body shapes.
    private static func errorMessage(from data: Data) -> String? {
        guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        for key in ["msg", "error_description", "message", "error"] {
            if let message = object[key] as? String, !message.isEmpty { return message }
        }
        return nil
    }

    // MARK: - PostgREST

    /// One PostgREST request as the signed-in user. A 401 (the access token
    /// expired between the local check and the server's) is retried once
    /// after a forced refresh.
    func rest(
        _ method: String,
        _ table: String,
        query: [URLQueryItem] = [],
        body: Data? = nil,
        prefer: String? = nil
    ) async throws -> Data {
        try await restAttempt(method, table, query: query, body: body, prefer: prefer, forceRefresh: false)
    }

    private func restAttempt(
        _ method: String,
        _ table: String,
        query: [URLQueryItem],
        body: Data?,
        prefer: String?,
        forceRefresh: Bool
    ) async throws -> Data {
        let session: AuthSession
        do {
            session = try await sessions.validSession(forceRefresh: forceRefresh, refresh: { try await self.refreshSession(refreshToken: $0) })
        } catch SupabaseError.notAuthenticated {
            if let onSessionExpired { await MainActor.run { onSessionExpired() } }
            throw SupabaseError.notAuthenticated
        }

        var components = URLComponents(
            url: config.supabaseURL.appendingPathComponent("rest/v1/\(table)"),
            resolvingAgainstBaseURL: false
        )!
        if !query.isEmpty { components.queryItems = query }

        var request = URLRequest(url: components.url!)
        request.httpMethod = method
        request.setValue(config.supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        if let prefer { request.setValue(prefer, forHTTPHeaderField: "Prefer") }

        let (data, response) = try await http.data(for: request)
        guard let status = (response as? HTTPURLResponse)?.statusCode else { throw SupabaseError.invalidResponse }

        if status == 401 && !forceRefresh {
            return try await restAttempt(method, table, query: query, body: body, prefer: prefer, forceRefresh: true)
        }
        guard (200..<300).contains(status) else {
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            throw SupabaseError.postgrest(
                status: status,
                code: object?["code"] as? String,
                message: Self.errorMessage(from: data) ?? "Request failed (HTTP \(status))."
            )
        }
        return data
    }
}

/// Postgres `timestamptz` values arrive with microseconds
/// (`2026-09-10T12:34:56.123456+00:00`), which `ISO8601DateFormatter`
/// doesn't reliably accept — trim the fraction to milliseconds first.
enum PostgresDate {
    static func parse(_ string: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: normalizedFraction(string)) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: string)
    }

    private static func normalizedFraction(_ string: String) -> String {
        guard let dot = string.firstIndex(of: "."), string[..<dot].contains("T") else { return string }
        let afterDot = string[string.index(after: dot)...]
        let digits = afterDot.prefix { $0.isNumber }
        let rest = afterDot.dropFirst(digits.count)
        let millis = String(digits.prefix(3)).padding(toLength: 3, withPad: "0", startingAt: 0)
        return String(string[...dot]) + millis + rest
    }
}
