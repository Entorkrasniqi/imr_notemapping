import AppKit

/// App-wide state: which screen is showing, the Supabase client, and the
/// open board. Screens are switched here rather than by URL — the native
/// equivalent of the web app's routes plus `proxy.ts`'s redirects.
@MainActor
final class AppModel: ObservableObject {
    enum Route: Equatable {
        case launching, notConfigured, login, signup, dashboard, board
    }

    @Published private(set) var route: Route = .launching
    @Published private(set) var activeBoard: BoardStore?

    let config: AppConfig?
    let client: SupabaseClient?
    private var pendingFlush: Task<Void, Never>?

    init() {
        config = AppConfig.load()
        client = config.map(SupabaseClient.init(config:))
        client?.onSessionExpired = { [weak self] in
            self?.activeBoard = nil
            self?.route = .login
        }
    }

    private var isRunningTests: Bool {
        ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil
    }

    func start() async {
        guard route == .launching, !isRunningTests else { return }
        guard let client else {
            route = .notConfigured
            return
        }
        route = await client.restoreSession() != nil ? .dashboard : .login
    }

    func signIn(email: String, password: String) async throws {
        guard let client else { return }
        _ = try await client.signIn(email: email, password: password)
        route = .dashboard
    }

    /// `false` when the account needs email confirmation before logging in.
    func signUp(email: String, password: String) async throws -> Bool {
        guard let client else { return false }
        guard try await client.signUp(email: email, password: password) != nil else { return false }
        route = .dashboard
        return true
    }

    func showSignup() { route = .signup }
    func showLogin() { route = .login }

    func signOut() {
        let board = activeBoard
        Task {
            // Save first: once signed out, RLS rejects every write.
            await board?.flushPendingSave()
            await client?.signOut()
            activeBoard = nil
            route = .login
        }
    }

    func open(_ board: BoardSummary) {
        guard let client else { return }
        activeBoard = BoardStore(board: board, client: client)
        route = .board
    }

    func backToDashboard() {
        let board = activeBoard
        route = .dashboard
        activeBoard = nil
        pendingFlush = Task { await board?.flushPendingSave() }
    }

    /// The dashboard waits for this so note counts include the last edits.
    func waitForPendingSaves() async {
        await pendingFlush?.value
    }

    /// Opens the web app in the browser, where billing runs (see
    /// `Supabase.example.xcconfig` for why).
    func openWebApp() {
        guard let url = config?.webAppURL else { return }
        NSWorkspace.shared.open(url)
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    weak var appModel: AppModel?

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    /// Quitting mid-edit shouldn't drop the last 400ms of changes; wait
    /// (briefly) for the pending save.
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        guard let store = appModel?.activeBoard, store.hasUnsavedChanges else { return .terminateNow }
        Task { @MainActor in
            let flush = Task { await store.flushPendingSave() }
            let timeout = Task {
                try? await Task.sleep(nanoseconds: 5_000_000_000)
                flush.cancel()
            }
            await flush.value
            timeout.cancel()
            sender.reply(toApplicationShouldTerminate: true)
        }
        return .terminateLater
    }
}
