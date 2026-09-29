import SwiftUI

@main
struct NoteMapApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var appModel = AppModel()
    @StateObject private var themeStore = ThemeStore()

    var body: some Scene {
        Window("ScriptumOS", id: "main") {
            RootView()
                .environmentObject(appModel)
                .environmentObject(themeStore)
                .frame(minWidth: 820, minHeight: 560)
                .onAppear { appDelegate.appModel = appModel }
        }
        .defaultSize(width: 1240, height: 820)
        .commands { NoteMapCommands(appModel: appModel, themeStore: themeStore) }
    }
}

struct RootView: View {
    @EnvironmentObject private var appModel: AppModel
    @EnvironmentObject private var themeStore: ThemeStore

    var body: some View {
        Group {
            switch appModel.route {
            case .launching:
                ZStack {
                    PageBackground(palette: themeStore.theme.palette)
                    ProgressView().controlSize(.small)
                }
            case .notConfigured:
                NotConfiguredView()
            case .login:
                AuthView(mode: .login)
            case .signup:
                AuthView(mode: .signup)
            case .dashboard:
                if let client = appModel.client {
                    DashboardView(client: client)
                }
            case .board:
                if let store = appModel.activeBoard {
                    BoardView(store: store).id(store.board.id)
                }
            }
        }
        .task { await appModel.start() }
    }
}

struct NoteMapCommands: Commands {
    @ObservedObject var appModel: AppModel
    @ObservedObject var themeStore: ThemeStore

    var body: some Commands {
        CommandGroup(replacing: .newItem) {
            Button("New Note") { appModel.activeBoard?.canvas?.addNoteAtCenter() }
                .keyboardShortcut("n")
                .disabled(appModel.route != .board)
            Button("Back to Boards") { appModel.backToDashboard() }
                .keyboardShortcut("[")
                .disabled(appModel.route != .board)
            Divider()
            Button("Log Out") { appModel.signOut() }
                .disabled(appModel.route != .board && appModel.route != .dashboard)
        }
        CommandGroup(after: .toolbar) {
            Button("Zoom In") { appModel.activeBoard?.canvas?.zoomIn() }
                .keyboardShortcut("=")
                .disabled(appModel.route != .board)
            Button("Zoom Out") { appModel.activeBoard?.canvas?.zoomOut() }
                .keyboardShortcut("-")
                .disabled(appModel.route != .board)
            Button("Fit View") { appModel.activeBoard?.canvas?.fitView() }
                .keyboardShortcut("0")
                .disabled(appModel.route != .board)
            Divider()
            Picker("Theme", selection: $themeStore.theme) {
                ForEach(Theme.allCases) { theme in
                    Text(theme.label).tag(theme)
                }
            }
            Divider()
        }
    }
}

/// Shown when `Config/Supabase.xcconfig` is missing or unfilled.
struct NotConfiguredView: View {
    @EnvironmentObject private var themeStore: ThemeStore

    var body: some View {
        let palette = themeStore.theme.palette
        ZStack {
            PageBackground(palette: palette)
            VStack(alignment: .leading, spacing: 12) {
                LogoMark(size: 40)
                Text("ScriptumOS isn't configured yet")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundColor(palette.textPrimary.swiftUI)
                Text("Copy `macos/Config/Supabase.example.xcconfig` to `Supabase.xcconfig` in the same folder, fill in the same Supabase URL and anon key the web app uses (`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`), then build and run again.")
                    .font(.system(size: 13))
                    .foregroundColor(palette.textSecondary.swiftUI)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(width: 420)
        }
        .navigationTitle("ScriptumOS")
    }
}
