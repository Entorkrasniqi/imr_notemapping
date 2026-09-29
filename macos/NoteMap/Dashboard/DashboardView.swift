import SwiftUI

/// The board list — `components/dashboard/Dashboard.tsx`.
struct DashboardView: View {
    @EnvironmentObject private var appModel: AppModel
    @EnvironmentObject private var themeStore: ThemeStore
    @StateObject private var model: DashboardModel

    @State private var renamingID: String?
    @State private var renameText = ""
    @State private var pendingDelete: BoardSummary?
    @FocusState private var renameFocused: Bool

    init(client: SupabaseClient) {
        _model = StateObject(wrappedValue: DashboardModel(client: client))
    }

    private let columns = [GridItem(.adaptive(minimum: 250, maximum: 420), spacing: 16)]

    var body: some View {
        let palette = themeStore.theme.palette
        ZStack {
            PageBackground(palette: palette)
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    header(palette)
                        .padding(.bottom, 32)
                    banners(palette)
                    content(palette)
                }
                .frame(maxWidth: 1024)
                .padding(.horizontal, 32)
                .padding(.vertical, 40)
                .frame(maxWidth: .infinity)
            }
        }
        .navigationTitle("ScriptumOS")
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                ThemeToggle()
                PlanBadge(isPro: model.isPro, theme: themeStore.theme)
                if appModel.config?.webAppURL != nil {
                    if model.isPro {
                        Button("Manage billing") { appModel.openWebApp() }
                            .buttonStyle(.pill(.secondary, palette))
                            .help("Opens the web app in your browser to manage your subscription")
                    } else {
                        Button("Upgrade to Pro") { upgrade() }
                            .buttonStyle(.pill(.upgrade, palette))
                            .help("Opens the web app in your browser to upgrade")
                    }
                }
                Button("Log out") { appModel.signOut() }
                    .buttonStyle(.pill(.secondary, palette))
            }
        }
        .task {
            await appModel.waitForPendingSaves()
            await model.load()
        }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            Task { await model.refreshPlanAfterReturning() }
        }
        .onChange(of: renameFocused) { focused in
            if !focused { commitRename() }
        }
        .alert(
            "Delete “\(pendingDelete?.name ?? "")”?",
            isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } })
        ) {
            Button("Delete", role: .destructive) {
                if let board = pendingDelete { Task { await model.delete(board) } }
                pendingDelete = nil
            }
            Button("Cancel", role: .cancel) { pendingDelete = nil }
        } message: {
            Text("This can't be undone.")
        }
    }

    private func upgrade() {
        model.beginUpgrade()
        appModel.openWebApp()
    }

    private func header(_ palette: ThemePalette) -> some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 10) {
                    LogoMark(size: 32)
                    Text("Your boards")
                        .font(themeStore.theme == .blueprint
                              ? .system(size: 28, weight: .semibold, design: .monospaced)
                              : .system(size: 28, weight: .semibold))
                        .foregroundColor(palette.textPrimary.swiftUI)
                }
                Text(model.isPro
                     ? "Unlimited boards on the Pro plan."
                     : "\(model.boards.count) of \(BoardsAPI.freePlanBoardLimit) boards used on the free plan.")
                    .font(.system(size: 13))
                    .foregroundColor(palette.textSecondary.swiftUI)
                if !model.isPro {
                    ZStack(alignment: .leading) {
                        Capsule().fill(palette.usageTrack.swiftUI)
                        Capsule()
                            .fill(model.atLimit ? Color(nsColor: NSColor(hex: 0xf59e0b)) : palette.usageFill.swiftUI)
                            .frame(width: 192 * min(CGFloat(model.boards.count) / CGFloat(BoardsAPI.freePlanBoardLimit), 1))
                    }
                    .frame(width: 192, height: 6)
                    .animation(.easeOut(duration: 0.5), value: model.boards.count)
                    .padding(.top, 4)
                }
            }
            Spacer()
            Button {
                Task {
                    if let board = await model.createBoard() {
                        // Creating a board and opening it are one gesture.
                        appModel.open(board)
                    }
                }
            } label: {
                Label(model.isCreating ? "Creating…" : "Create board", systemImage: "plus")
            }
            .buttonStyle(.pill(.primary, palette))
            .disabled(model.isCreating || model.atLimit || model.status != .ready)
            .help(model.atLimit ? "Free plan is limited to \(BoardsAPI.freePlanBoardLimit) boards" : "")
        }
    }

    @ViewBuilder
    private func banners(_ palette: ThemePalette) -> some View {
        if let message = model.limitMessage {
            Banner(palette: palette) { Text(message) }
                .padding(.bottom, 24)
        } else if model.atLimit {
            Banner(palette: palette) {
                Text("You've reached the free plan limit of \(BoardsAPI.freePlanBoardLimit) boards. Delete one, or upgrade to Pro, to create another.")
                Spacer()
                if appModel.config?.webAppURL != nil {
                    Button("Upgrade to Pro") { upgrade() }
                        .buttonStyle(.pill(.upgrade, palette))
                }
            }
            .padding(.bottom, 24)
        }
    }

    @ViewBuilder
    private func content(_ palette: ThemePalette) -> some View {
        switch model.status {
        case .loading:
            LazyVGrid(columns: columns, spacing: 16) {
                ForEach(0..<3, id: \.self) { _ in BoardCardSkeleton(palette: palette) }
            }
        case .error:
            VStack(alignment: .leading, spacing: 12) {
                Text("Couldn't reach the database.")
                    .font(.system(size: 13))
                    .foregroundColor(palette.textSecondary.swiftUI)
                Button("Try again") { Task { await model.load() } }
                    .buttonStyle(.pill(.primary, palette))
            }
            .padding(24)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 16).fill(palette.cardBackground.swiftUI))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(palette.cardBorder.swiftUI, lineWidth: 1))
        case .ready where model.boards.isEmpty:
            VStack(spacing: 10) {
                Image(systemName: "plus")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(palette.textTertiary.swiftUI)
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(palette.secondaryButtonBackground.swiftUI))
                Text("No boards yet")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(palette.textPrimary.swiftUI)
                Text("Create your first board to start mapping out notes and ideas on an infinite canvas.")
                    .font(.system(size: 13))
                    .foregroundColor(palette.textSecondary.swiftUI)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 300)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 64)
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
                    .foregroundColor(palette.cardBorder.swiftUI)
            )
        case .ready:
            LazyVGrid(columns: columns, spacing: 16) {
                ForEach(model.boards) { board in
                    BoardCard(
                        board: board,
                        palette: palette,
                        isRenaming: renamingID == board.id,
                        renameText: $renameText,
                        renameFocused: $renameFocused,
                        onOpen: { appModel.open(board) },
                        onStartRename: { startRename(board) },
                        onCommitRename: commitRename,
                        onCancelRename: { renamingID = nil },
                        onDelete: { pendingDelete = board }
                    )
                }
            }
        }
    }

    private func startRename(_ board: BoardSummary) {
        renameText = board.name
        renamingID = board.id
        Task { @MainActor in renameFocused = true }
    }

    private func commitRename() {
        guard let id = renamingID, let board = model.boards.first(where: { $0.id == id }) else { return }
        renamingID = nil
        let name = renameText
        Task { await model.rename(board, to: name) }
    }
}

private struct BoardCard: View {
    let board: BoardSummary
    let palette: ThemePalette
    let isRenaming: Bool
    @Binding var renameText: String
    var renameFocused: FocusState<Bool>.Binding
    let onOpen: () -> Void
    let onStartRename: () -> Void
    let onCommitRename: () -> Void
    let onCancelRename: () -> Void
    let onDelete: () -> Void

    @State private var hovering = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            BoardCover(boardID: board.id)
                .frame(height: 80)
            VStack(alignment: .leading, spacing: 6) {
                if isRenaming {
                    TextField("Board name", text: $renameText)
                        .textFieldStyle(.roundedBorder)
                        .font(.system(size: 15, weight: .medium))
                        .focused(renameFocused)
                        .onSubmit(onCommitRename)
                        .onExitCommand(perform: onCancelRename)
                } else {
                    Text(board.name)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundColor(palette.textPrimary.swiftUI)
                        .lineLimit(1)
                        .help("Double-click to rename")
                        // Double-click renames; a single click on the name
                        // is swallowed so it doesn't open the board first.
                        .onTapGesture(count: 2, perform: onStartRename)
                        .onTapGesture(count: 1) {}
                }
                HStack(spacing: 12) {
                    Label(Self.relativeTime(board.updatedAt), systemImage: "clock")
                    Label("\(board.noteCount) \(board.noteCount == 1 ? "note" : "notes")", systemImage: "doc.text")
                }
                .labelStyle(CompactLabelStyle())
                .font(.system(size: 12))
                .foregroundColor(palette.textTertiary.swiftUI)
            }
            .padding(16)
        }
        .background(palette.cardBackground.swiftUI)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(hovering ? palette.cardBorder.swiftUI.opacity(1) : palette.cardBorder.swiftUI, lineWidth: 1)
        )
        .shadow(color: .black.opacity(hovering ? 0.12 : 0.03), radius: hovering ? 16 : 1, y: hovering ? 8 : 1)
        .overlay(alignment: .topTrailing) {
            HStack(spacing: 4) {
                cardAction("pencil", "Rename board", action: onStartRename)
                cardAction("trash", "Delete board", action: onDelete)
            }
            .padding(12)
            .opacity(hovering && !isRenaming ? 1 : 0)
        }
        .offset(y: hovering ? -2 : 0)
        .animation(.easeOut(duration: 0.2), value: hovering)
        .contentShape(Rectangle())
        .onTapGesture { if !isRenaming { onOpen() } }
        .onHover { hovering = $0 }
        .contextMenu {
            Button("Open", action: onOpen)
            Button("Rename…", action: onStartRename)
            Divider()
            Button("Delete…", role: .destructive, action: onDelete)
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
        .accessibilityAction(named: "Rename", onStartRename)
        .accessibilityAction(named: "Delete", onDelete)
    }

    private func cardAction(_ icon: String, _ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .medium))
                .frame(width: 28, height: 28)
                .foregroundColor(Color(nsColor: NSColor(hex: 0x52525b)))
                .background(Circle().fill(Color.white.opacity(0.9)))
                .shadow(color: .black.opacity(0.1), radius: 1, y: 1)
        }
        .buttonStyle(.plain)
        .help(title)
        .accessibilityLabel(title)
    }

    /// "3 minutes ago", "yesterday" — `formatRelativeTime` in Dashboard.tsx.
    static func relativeTime(_ date: Date) -> String {
        let seconds = Int(Date().timeIntervalSince(date).rounded())
        let formatter = RelativeDateTimeFormatter()
        formatter.dateTimeStyle = .named
        let units: [(Calendar.Component, Int)] = [
            (.year, 60 * 60 * 24 * 365), (.month, 60 * 60 * 24 * 30), (.day, 60 * 60 * 24), (.hour, 60 * 60), (.minute, 60),
        ]
        for (unit, size) in units where seconds >= size {
            var components = DateComponents()
            components.setValue(-(seconds / size), for: unit)
            return formatter.localizedString(from: components)
        }
        return formatter.localizedString(from: DateComponents(minute: 0))
    }
}

/// A soft gradient cover picked by hashing the board id, the same way the
/// web dashboard picks one of its six (so a board has the same cover in
/// both apps), with a faint dot pattern on top.
private struct BoardCover: View {
    let boardID: String

    private static let palette: [(UInt32, UInt32)] = [
        (0xffe4e6, 0xfff1f2), (0xfef3c7, 0xfffbeb), (0xd1fae5, 0xecfdf5),
        (0xe0f2fe, 0xf0f9ff), (0xede9fe, 0xf5f3ff), (0xccfbf1, 0xf0fdfa),
    ]

    /// `(hash * 31 + charCode) >>> 0` over UTF-16 units, as in `coverClassFor`.
    private var colors: [Color] {
        var hash: UInt32 = 0
        for unit in boardID.utf16 { hash = hash &* 31 &+ UInt32(unit) }
        let (strong, soft) = Self.palette[Int(hash % UInt32(Self.palette.count))]
        return [Color(nsColor: NSColor(hex: strong)), Color(nsColor: NSColor(hex: soft)), .white]
    }

    var body: some View {
        ZStack {
            LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing)
            Canvas { context, size in
                var dots = Path()
                var x: CGFloat = 7
                while x < size.width {
                    var y: CGFloat = 7
                    while y < size.height {
                        dots.addEllipse(in: CGRect(x: x - 1, y: y - 1, width: 2, height: 2))
                        y += 14
                    }
                    x += 14
                }
                context.fill(dots, with: .color(.black.opacity(0.06)))
            }
        }
    }
}

private struct BoardCardSkeleton: View {
    let palette: ThemePalette
    @State private var pulse = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            palette.usageTrack.swiftUI.frame(height: 80)
            VStack(alignment: .leading, spacing: 8) {
                Capsule().fill(palette.usageTrack.swiftUI).frame(width: 140, height: 12)
                Capsule().fill(palette.usageTrack.swiftUI).frame(width: 100, height: 9)
            }
            .padding(16)
        }
        .background(palette.cardBackground.swiftUI)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(palette.cardBorder.swiftUI, lineWidth: 1))
        .opacity(pulse ? 0.5 : 1)
        .animation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true), value: pulse)
        .onAppear { pulse = true }
    }
}

private struct Banner<Content: View>: View {
    let palette: ThemePalette
    @ViewBuilder let content: () -> Content

    var body: some View {
        HStack(spacing: 12) { content() }
            .font(.system(size: 13))
            .foregroundColor(palette.bannerText.swiftUI)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 12).fill(palette.bannerBackground.swiftUI))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(palette.bannerBorder.swiftUI, lineWidth: 1))
    }
}

private struct PlanBadge: View {
    let isPro: Bool
    let theme: Theme

    var body: some View {
        Text(isPro ? "PRO" : "FREE")
            .font(.system(size: 10, weight: .semibold))
            .tracking(0.6)
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
            .foregroundColor(foreground)
            .background(Capsule().fill(background))
            .overlay(Capsule().stroke(border, lineWidth: 1))
    }

    private var foreground: Color {
        if isPro { return Color(nsColor: theme == .light ? NSColor(hex: 0xb45309) : NSColor(hex: 0xfcd34d)) }
        return theme.palette.textSecondary.swiftUI
    }

    private var background: Color {
        if isPro { return Color(nsColor: theme == .light ? NSColor(hex: 0xfef3c7) : NSColor(hex: 0xf59e0b, alpha: 0.18)) }
        return theme.palette.secondaryButtonBackground.swiftUI
    }

    private var border: Color {
        if isPro { return Color(nsColor: theme == .light ? NSColor(hex: 0xfde68a) : NSColor(hex: 0xf59e0b, alpha: 0.3)) }
        return theme.palette.secondaryButtonBorder.swiftUI
    }
}

private struct CompactLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 4) {
            configuration.icon.imageScale(.small)
            configuration.title
        }
    }
}
