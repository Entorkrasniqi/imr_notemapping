import SwiftUI

/// One board: the canvas, its zoom controls, load/empty/error states, and
/// the note editor — the native `Board.tsx`.
struct BoardView: View {
    @ObservedObject var store: BoardStore
    @EnvironmentObject private var appModel: AppModel
    @EnvironmentObject private var themeStore: ThemeStore

    var body: some View {
        let palette = themeStore.theme.palette
        ZStack {
            CanvasRepresentable(store: store, theme: themeStore.theme)

            CanvasControls(palette: palette) { action in
                switch action {
                case .zoomIn: store.canvas?.zoomIn()
                case .zoomOut: store.canvas?.zoomOut()
                case .fit: store.canvas?.fitView(padding: 0.1)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
            .padding(15)

            statusOverlay(palette)

            if let note = store.editingNote {
                NoteEditorOverlay(store: store, note: note, theme: themeStore.theme)
                    .id(note.id)
            }
        }
        .background(palette.canvasBackground.swiftUI)
        .navigationTitle(store.board.name)
        .toolbar {
            ToolbarItem(placement: .navigation) {
                Button {
                    appModel.backToDashboard()
                } label: {
                    Label("Boards", systemImage: "chevron.left")
                }
                .help("Back to your boards")
            }
            ToolbarItem(placement: .status) {
                Text(saveStatusText)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.secondary)
                    .accessibilityLabel(saveStatusText)
            }
            ToolbarItemGroup(placement: .primaryAction) {
                ThemeToggle()
                Button {
                    store.canvas?.fitView()
                } label: {
                    Label("Fit View", systemImage: "arrow.up.left.and.arrow.down.right")
                }
                .help("Fit all notes in view")
                Button {
                    store.canvas?.addNoteAtCenter()
                } label: {
                    Label("Add Note", systemImage: "plus")
                }
                .help("Add a note")
                .disabled(store.status != .ready)
                Button {
                    appModel.signOut()
                } label: {
                    Label("Log Out", systemImage: "rectangle.portrait.and.arrow.right")
                }
                .help("Log out")
            }
        }
        .task { await store.load() }
    }

    private var saveStatusText: String {
        switch store.saveStatus {
        case .idle: return ""
        case .saving: return "Saving…"
        case .saved: return "Saved"
        case .error: return "Couldn't save — will retry on your next change"
        }
    }

    @ViewBuilder
    private func statusOverlay(_ palette: ThemePalette) -> some View {
        switch store.status {
        case .loading:
            Text("Loading your board…")
                .font(.system(size: 13))
                .foregroundColor(palette.textTertiary.swiftUI)
                .allowsHitTesting(false)
        case .error:
            blockingMessage("Couldn't reach the database.", palette: palette) {
                Button("Try again") { Task { await store.load() } }
                    .buttonStyle(.pill(.primary, palette))
            }
        case .notFound:
            blockingMessage("This board doesn't exist, or isn't yours.", palette: palette) {
                Button("Back to your boards") { appModel.backToDashboard() }
                    .buttonStyle(.pill(.primary, palette))
            }
        case .ready:
            if store.nodes.isEmpty && store.editingNoteID == nil {
                Text("Double-click anywhere, or press “+ Add note”, to create your first note.")
                    .font(.system(size: 13))
                    .foregroundColor(palette.textTertiary.swiftUI)
                    .multilineTextAlignment(.center)
                    .padding()
                    .allowsHitTesting(false)
            }
        }
    }

    private func blockingMessage<Actions: View>(_ message: String, palette: ThemePalette,
                                                @ViewBuilder actions: () -> Actions) -> some View {
        ZStack {
            palette.canvasBackground.swiftUI.opacity(0.85)
            VStack(spacing: 12) {
                Text(message)
                    .font(.system(size: 13))
                    .foregroundColor(palette.textSecondary.swiftUI)
                actions()
            }
        }
    }
}

struct CanvasRepresentable: NSViewRepresentable {
    let store: BoardStore
    let theme: Theme

    func makeNSView(context: Context) -> CanvasView {
        let canvas = CanvasView(store: store)
        canvas.theme = theme
        store.canvas = canvas
        return canvas
    }

    func updateNSView(_ canvas: CanvasView, context: Context) {
        canvas.theme = theme
    }
}

/// React Flow's `<Controls showInteractive={false} />`: zoom in, zoom
/// out, fit view, stacked bottom-left.
struct CanvasControls: View {
    enum Action { case zoomIn, zoomOut, fit }

    let palette: ThemePalette
    let perform: (Action) -> Void

    var body: some View {
        VStack(spacing: 0) {
            button("plus", "Zoom in", .zoomIn)
            palette.canvasDots.swiftUI.opacity(0.6).frame(height: 1)
            button("minus", "Zoom out", .zoomOut)
            palette.canvasDots.swiftUI.opacity(0.6).frame(height: 1)
            button("viewfinder", "Fit view", .fit)
        }
        .frame(width: 26)
        .background(palette.controlBackground.swiftUI)
        .clipShape(RoundedRectangle(cornerRadius: 3))
        .shadow(color: .black.opacity(0.08), radius: 2)
    }

    private func button(_ icon: String, _ title: String, _ action: Action) -> some View {
        Button { perform(action) } label: {
            Image(systemName: icon)
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(palette.controlGlyph.swiftUI)
                .frame(width: 26, height: 26)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .help(title)
        .accessibilityLabel(title)
    }
}
