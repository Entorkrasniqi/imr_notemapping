import Foundation
import CoreGraphics

/// One open board: its notes and edges, selection, undo history, and the
/// load/autosave cycle against Supabase — the native counterpart of
/// `Board.tsx`'s state plus `useSupabaseBoardSync` and `useBoardHistory`.
@MainActor
final class BoardStore: ObservableObject {
    enum LoadStatus { case loading, ready, error, notFound }
    enum SaveStatus { case idle, saving, saved, error }

    let board: BoardSummary
    private let client: SupabaseClient

    @Published private(set) var nodes: [NoteNode] = []
    @Published private(set) var edges: [BoardEdge] = []
    @Published var selectedNodeIDs: Set<String> = []
    @Published var selectedEdgeIDs: Set<String> = []
    @Published private(set) var status: LoadStatus = .loading
    @Published private(set) var saveStatus: SaveStatus = .idle
    /// The note open in the editor, if any (`editingNoteId` on the web).
    @Published var editingNoteID: String?

    /// Set by the canvas so toolbar/menu actions can reach its viewport.
    weak var canvas: CanvasView?

    // MARK: Save bookkeeping

    /// Same debounce as the web app: one round trip per pause in activity.
    private static let saveDebounce: UInt64 = 400_000_000
    private static let savedIndicatorDuration: UInt64 = 2_000_000_000

    /// What's in Postgres as of the last successful save, so a deletion can
    /// be told apart from "still here" (see `syncBoardToSupabase`).
    private var persistedNodeIDs: Set<String> = []
    private var persistedEdgeIDs: Set<String> = []
    /// Rows changed since the last successful save.
    private var dirtyNodeIDs: Set<String> = []
    private var dirtyEdgeIDs: Set<String> = []
    private var debounceTask: Task<Void, Never>?
    /// A debounced save is scheduled but hasn't started yet.
    private var isDebouncePending = false
    private var syncTask: Task<Void, Never>?
    private var needsAnotherSync = false
    private var savedIndicatorTask: Task<Void, Never>?

    // MARK: History

    private struct Snapshot {
        let nodes: [NoteNode]
        let edges: [BoardEdge]
    }

    private var past: [Snapshot] = []
    private var future: [Snapshot] = []

    init(board: BoardSummary, client: SupabaseClient) {
        self.board = board
        self.client = client
    }

    var editingNote: NoteNode? {
        guard let editingNoteID else { return nil }
        return node(editingNoteID)
    }

    func node(_ id: String) -> NoteNode? {
        nodes.first { $0.id == id }
    }

    // MARK: - Loading

    func load() async {
        status = .loading
        do {
            try await BoardSyncAPI.verifyBoardAccess(client, boardID: board.id)
            let contents = try await BoardSyncAPI.fetchBoardContents(client, boardID: board.id)
            nodes = contents.nodes
            edges = contents.edges
            persistedNodeIDs = Set(contents.nodes.map(\.id))
            persistedEdgeIDs = Set(contents.edges.map(\.id))
            dirtyNodeIDs = []
            dirtyEdgeIDs = []
            selectedNodeIDs = []
            selectedEdgeIDs = []
            past = []
            future = []
            status = .ready
            saveStatus = .idle
        } catch is BoardNotFoundError {
            status = .notFound
        } catch {
            NSLog("Failed to load board from Supabase: \(error)")
            status = .error
        }
    }

    // MARK: - Board-level edits (recorded in undo history)

    /// Call right *before* a board-level change — captures what to go back
    /// to. Text typed inside a note is deliberately not part of this
    /// history (the editor has its own), exactly as on the web.
    func recordBeforeChange() {
        past.append(Snapshot(nodes: nodes, edges: edges))
        future = []
    }

    var canUndo: Bool { !past.isEmpty }
    var canRedo: Bool { !future.isEmpty }

    func undo() {
        guard let previous = past.popLast() else { return }
        future.append(Snapshot(nodes: nodes, edges: edges))
        restore(previous)
    }

    func redo() {
        guard let next = future.popLast() else { return }
        past.append(Snapshot(nodes: nodes, edges: edges))
        restore(next)
    }

    /// Restores positions, sizes, and which notes/edges exist — but keeps
    /// the *current* text of any note that exists on both sides. The web
    /// version restores whole snapshots, so undoing a note move there also
    /// silently reverts any typing done since; text edits are meant to be
    /// outside this history, so here they stay outside it.
    private func restore(_ snapshot: Snapshot) {
        let currentByID = Dictionary(uniqueKeysWithValues: nodes.map { ($0.id, $0) })
        nodes = snapshot.nodes.map { restored in
            guard let current = currentByID[restored.id] else { return restored }
            var node = restored
            node.content = current.content
            node.contentRevision = current.contentRevision
            return node
        }
        edges = snapshot.edges
        let nodeIDs = Set(nodes.map(\.id))
        selectedNodeIDs.formIntersection(nodeIDs)
        selectedEdgeIDs.formIntersection(Set(edges.map(\.id)))
        if let editingNoteID, !nodeIDs.contains(editingNoteID) { self.editingNoteID = nil }
        dirtyNodeIDs.formUnion(nodeIDs)
        dirtyEdgeIDs.formUnion(edges.map(\.id))
        scheduleSave()
    }

    /// Creates a note centered on `center` (canvas coordinates), selects
    /// only it, and opens it for editing — `addNoteAtScreenPoint`.
    @discardableResult
    func addNote(centeredAt center: CGPoint) -> String {
        recordBeforeChange()
        let note = NoteNode(
            id: newRowID(),
            position: CGPoint(x: center.x - NoteMetrics.newNoteWidth / 2, y: center.y - NoteMetrics.newNoteHeight / 2),
            width: NoteMetrics.newNoteWidth,
            height: NoteMetrics.newNoteHeight,
            content: nil
        )
        nodes.append(note)
        selectedNodeIDs = [note.id]
        selectedEdgeIDs = []
        markDirty(node: note.id)
        editingNoteID = note.id
        return note.id
    }

    /// Positions during a drag. History was recorded once at drag start.
    func setPositions(_ positions: [String: CGPoint]) {
        for index in nodes.indices {
            if let position = positions[nodes[index].id], nodes[index].position != position {
                nodes[index].position = position
                markDirty(node: nodes[index].id, schedule: false)
            }
        }
        scheduleSave()
    }

    /// A resize step. History was recorded once at resize start.
    func setFrame(_ id: String, _ frame: CGRect) {
        guard let index = nodes.firstIndex(where: { $0.id == id }) else { return }
        nodes[index].position = frame.origin
        nodes[index].width = frame.width
        nodes[index].height = frame.height
        markDirty(node: id)
    }

    /// Deleting a note also deletes its edges, as React Flow's
    /// `deleteElements` does (the database would cascade them anyway).
    func deleteElements(nodeIDs: Set<String>, edgeIDs: Set<String>) {
        let removedEdges = edges.filter { edgeIDs.contains($0.id) || nodeIDs.contains($0.source) || nodeIDs.contains($0.target) }
        guard !nodeIDs.isEmpty || !removedEdges.isEmpty else { return }
        recordBeforeChange()
        let removedEdgeIDs = Set(removedEdges.map(\.id))
        nodes.removeAll { nodeIDs.contains($0.id) }
        edges.removeAll { removedEdgeIDs.contains($0.id) }
        selectedNodeIDs.subtract(nodeIDs)
        selectedEdgeIDs.subtract(removedEdgeIDs)
        if let editingNoteID, nodeIDs.contains(editingNoteID) { self.editingNoteID = nil }
        scheduleSave()
    }

    func deleteSelection() {
        deleteElements(nodeIDs: selectedNodeIDs, edgeIDs: selectedEdgeIDs)
    }

    /// Adds an edge unless an identical one already exists — the same
    /// check React Flow's `addEdge` makes.
    func connect(source: String, sourceHandle: String, target: String, targetHandle: String) {
        let exists = edges.contains {
            $0.source == source && $0.target == target && $0.sourceHandle == sourceHandle && $0.targetHandle == targetHandle
        }
        guard !exists else { return }
        recordBeforeChange()
        let edge = BoardEdge(id: newRowID(), source: source, target: target, sourceHandle: sourceHandle, targetHandle: targetHandle)
        edges.append(edge)
        dirtyEdgeIDs.insert(edge.id)
        scheduleSave()
    }

    // MARK: - Content edits (not in board history)

    func updateContent(_ id: String, _ content: JSONValue?) {
        guard let index = nodes.firstIndex(where: { $0.id == id }) else { return }
        nodes[index].content = content
        nodes[index].contentRevision += 1
        markDirty(node: id)
    }

    /// Dropping a JPEG onto a closed note tile.
    func appendImage(to id: String, src: String) {
        guard let node = node(id) else { return }
        updateContent(id, NoteContent.appendingImage(to: node.content, src: src))
    }

    // MARK: - Selection

    func select(nodeIDs: Set<String>, edgeIDs: Set<String> = []) {
        if selectedNodeIDs != nodeIDs { selectedNodeIDs = nodeIDs }
        if selectedEdgeIDs != edgeIDs { selectedEdgeIDs = edgeIDs }
    }

    func selectAll() {
        select(nodeIDs: Set(nodes.map(\.id)))
    }

    // MARK: - Saving

    var hasUnsavedChanges: Bool {
        !dirtyNodeIDs.isEmpty || !dirtyEdgeIDs.isEmpty
            || !persistedNodeIDs.isSubset(of: Set(nodes.map(\.id)))
            || !persistedEdgeIDs.isSubset(of: Set(edges.map(\.id)))
            || syncTask != nil
    }

    private func markDirty(node id: String, schedule: Bool = true) {
        dirtyNodeIDs.insert(id)
        if schedule { scheduleSave() }
    }

    private func scheduleSave() {
        guard status == .ready else { return }
        saveStatus = .saving
        savedIndicatorTask?.cancel()
        debounceTask?.cancel()
        isDebouncePending = true
        debounceTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: Self.saveDebounce)
            guard !Task.isCancelled, let self else { return }
            self.isDebouncePending = false
            self.startSync()
        }
    }

    /// Saves are serialized: an edit made while a save is in flight is
    /// picked up by one more save once it finishes, rather than a second
    /// request racing the first with stale bookkeeping.
    private func startSync() {
        guard syncTask == nil else {
            needsAnotherSync = true
            return
        }
        syncTask = Task { [weak self] in
            await self?.performSync()
        }
    }

    private func performSync() async {
        let currentNodeIDs = Set(nodes.map(\.id))
        let currentEdgeIDs = Set(edges.map(\.id))
        let sentNodeIDs = dirtyNodeIDs.intersection(currentNodeIDs)
        let sentEdgeIDs = dirtyEdgeIDs.intersection(currentEdgeIDs)
        let changes = BoardSyncAPI.Changes(
            nodeIDsToDelete: Array(persistedNodeIDs.subtracting(currentNodeIDs)),
            edgeIDsToDelete: Array(persistedEdgeIDs.subtracting(currentEdgeIDs)),
            nodeRows: nodes.filter { sentNodeIDs.contains($0.id) }.map { BoardMapping.row(from: $0, boardID: board.id) },
            edgeRows: edges.filter { sentEdgeIDs.contains($0.id) }.map { BoardMapping.row(from: $0, boardID: board.id) }
        )
        // Anything edited from here on is dirty again for the next save.
        dirtyNodeIDs.subtract(sentNodeIDs)
        dirtyEdgeIDs.subtract(sentEdgeIDs)

        var succeeded = false
        do {
            if !changes.isEmpty { try await BoardSyncAPI.sync(client, changes) }
            persistedNodeIDs = currentNodeIDs
            persistedEdgeIDs = currentEdgeIDs
            succeeded = true
        } catch {
            NSLog("Failed to save board to Supabase: \(error)")
            dirtyNodeIDs.formUnion(sentNodeIDs)
            dirtyEdgeIDs.formUnion(sentEdgeIDs)
        }

        syncTask = nil
        if needsAnotherSync {
            needsAnotherSync = false
            startSync()
            return
        }
        // Another edit landed mid-save and its own save is still coming —
        // keep showing "Saving…" rather than flashing "Saved" in between.
        if isDebouncePending { return }
        saveStatus = succeeded ? .saved : .error
        if succeeded { scheduleSavedIndicatorReset() }
    }

    /// "Saved" is a confirmation, not a state — it fades back to nothing.
    private func scheduleSavedIndicatorReset() {
        savedIndicatorTask?.cancel()
        savedIndicatorTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: Self.savedIndicatorDuration)
            guard !Task.isCancelled, let self, self.saveStatus == .saved else { return }
            self.saveStatus = .idle
        }
    }

    /// Writes anything pending right away — used when leaving the board,
    /// logging out, or quitting, where the web app would simply drop an
    /// edit made in the last 400ms.
    func flushPendingSave() async {
        guard status == .ready else { return }
        debounceTask?.cancel()
        debounceTask = nil
        isDebouncePending = false
        if let syncTask { await syncTask.value }
        guard hasUnsavedChanges else { return }
        startSync()
        if let syncTask { await syncTask.value }
    }
}
