import Foundation

/// The dashboard's data and actions — `Dashboard.tsx`'s state and handlers.
@MainActor
final class DashboardModel: ObservableObject {
    enum Status { case loading, ready, error }

    @Published private(set) var status = Status.loading
    @Published private(set) var boards: [BoardSummary] = []
    @Published private(set) var plan = "free"
    @Published private(set) var isCreating = false
    @Published var limitMessage: String?

    private let client: SupabaseClient
    /// Set when "Upgrade to Pro" sent the user to the browser, so coming
    /// back to the app re-checks the plan until the webhook has landed.
    private var awaitingUpgrade = false

    init(client: SupabaseClient) {
        self.client = client
    }

    /// Mirrors the trigger: only the free plan is limited.
    var isPro: Bool { plan != "free" }
    var atLimit: Bool { !isPro && boards.count >= BoardsAPI.freePlanBoardLimit }

    func load() async {
        status = .loading
        do {
            async let boards = BoardsAPI.listBoards(client)
            async let plan = BoardsAPI.userPlan(client)
            self.boards = try await boards
            self.plan = try await plan
            status = .ready
        } catch {
            NSLog("Failed to load boards: \(error)")
            status = .error
        }
    }

    func beginUpgrade() {
        awaitingUpgrade = true
    }

    /// Stripe's webhook can land a moment after the user returns — poll
    /// briefly, like the dashboard does after `?checkout=success`.
    func refreshPlanAfterReturning() async {
        let attempts = awaitingUpgrade ? 5 : 1
        for attempt in 0..<attempts {
            if let plan = try? await BoardsAPI.userPlan(client) {
                self.plan = plan
                if plan != "free" {
                    awaitingUpgrade = false
                    return
                }
            }
            if attempt < attempts - 1 { try? await Task.sleep(nanoseconds: 1_000_000_000) }
        }
    }

    func createBoard() async -> BoardSummary? {
        limitMessage = nil
        isCreating = true
        defer { isCreating = false }
        do {
            return try await BoardsAPI.createBoard(client, name: "Untitled board")
        } catch is BoardLimitError {
            limitMessage = "You've reached the free plan limit of \(BoardsAPI.freePlanBoardLimit) boards."
        } catch {
            NSLog("Failed to create board: \(error)")
            limitMessage = "Something went wrong creating that board. Try again."
        }
        return nil
    }

    /// Optimistic, reverted if the request fails — as on the web.
    func rename(_ board: BoardSummary, to rawName: String) async {
        let name = rawName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, name != board.name, let index = boards.firstIndex(where: { $0.id == board.id }) else { return }
        let previous = boards
        boards[index].name = name
        do {
            try await BoardsAPI.renameBoard(client, id: board.id, name: name)
        } catch {
            NSLog("Failed to rename board: \(error)")
            boards = previous
        }
    }

    func delete(_ board: BoardSummary) async {
        let previous = boards
        boards.removeAll { $0.id == board.id }
        limitMessage = nil
        do {
            try await BoardsAPI.deleteBoard(client, id: board.id)
        } catch {
            NSLog("Failed to delete board: \(error)")
            boards = previous
        }
    }
}
