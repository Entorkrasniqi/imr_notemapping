import Foundation
import Security

/// A signed-in Supabase Auth session. The web app keeps this in cookies
/// (via `@supabase/ssr`); natively it lives in the login Keychain.
struct AuthSession: Codable {
    var accessToken: String
    var refreshToken: String
    var expiresAt: Date
    var userID: String
    var email: String?

    /// Refresh a minute early so a request never races the expiry.
    var needsRefresh: Bool { expiresAt.timeIntervalSinceNow < 60 }
}

/// Serializes session reads, writes, and — importantly — refreshes. Two
/// requests that notice an expired token at the same time must share one
/// refresh: Supabase rotates refresh tokens, so a second, parallel refresh
/// with the same (now used) token would be rejected and sign the user out.
actor SessionStore {
    private var session: AuthSession?
    private var refreshTask: Task<AuthSession, Error>?
    private let keychain: KeychainItem

    init(keychain: KeychainItem) {
        self.keychain = keychain
    }

    func current() -> AuthSession? { session }

    func loadPersisted() -> AuthSession? {
        guard let data = keychain.read() else { return nil }
        session = try? JSONDecoder().decode(AuthSession.self, from: data)
        return session
    }

    func set(_ newSession: AuthSession?) {
        session = newSession
        if let newSession, let data = try? JSONEncoder().encode(newSession) {
            keychain.write(data)
        } else {
            keychain.delete()
        }
    }

    /// A session whose access token is valid right now, refreshing it
    /// first if needed.
    func validSession(forceRefresh: Bool = false,
                      refresh: @escaping @Sendable (String) async throws -> AuthSession) async throws -> AuthSession {
        guard let session else { throw SupabaseError.notAuthenticated }
        if !forceRefresh && !session.needsRefresh { return session }

        if let refreshTask { return try await refreshTask.value }
        let task = Task { try await refresh(session.refreshToken) }
        refreshTask = task
        defer { refreshTask = nil }
        do {
            let refreshed = try await task.value
            set(refreshed)
            return refreshed
        } catch SupabaseError.auth {
            // The refresh token itself was rejected (revoked, already used,
            // or expired) — there's no recovering this session.
            set(nil)
            throw SupabaseError.notAuthenticated
        }
    }
}

/// One generic-password Keychain item.
struct KeychainItem {
    let service: String
    let account: String

    private var query: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    func read() -> Data? {
        var query = self.query
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else { return nil }
        return result as? Data
    }

    func write(_ data: Data) {
        let attributes = [kSecValueData as String: data]
        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var item = query
            item[kSecValueData as String] = data
            item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
            SecItemAdd(item as CFDictionary, nil)
        }
    }

    func delete() {
        SecItemDelete(query as CFDictionary)
    }
}
