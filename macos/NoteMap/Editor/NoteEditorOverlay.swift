import SwiftUI

/// The note-editing surface: a large centered card over the canvas with a
/// title field, Cancel/Save, the body, and the formatting toolbar — the
/// native `NoteEditorModal`. As on the web there's no dimming, clicking
/// outside closes it keeping changes, and so do Escape and ⌘↵; only Cancel
/// discards.
struct NoteEditorOverlay: View {
    @ObservedObject var store: BoardStore
    @StateObject private var controller: EditorController
    @EnvironmentObject private var themeStore: ThemeStore
    @FocusState private var titleFocused: Bool

    init(store: BoardStore, note: NoteNode, theme: Theme) {
        self.store = store
        _controller = StateObject(wrappedValue: EditorController(note: note, store: store, theme: theme))
    }

    var body: some View {
        let palette = themeStore.theme.palette
        GeometryReader { geometry in
            ZStack {
                // Catches clicks so nothing reaches the canvas underneath.
                Color.black.opacity(0.001)
                    .contentShape(Rectangle())
                    .onTapGesture { controller.close() }

                VStack(spacing: 0) {
                    header(palette)
                    palette.editorDivider.swiftUI.frame(height: 1)
                    RichTextEditorView(controller: controller)
                        .overlay(
                            RoundedRectangle(cornerRadius: 6)
                                .strokeBorder(style: StrokeStyle(lineWidth: 2, dash: [6, 4]))
                                .foregroundColor(palette.dropOutline.swiftUI)
                                .padding(4)
                                .opacity(controller.isDragOver ? 1 : 0)
                                .allowsHitTesting(false)
                        )
                    palette.editorDivider.swiftUI.frame(height: 1)
                    FormattingToolbar(controller: controller, palette: palette)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                }
                .frame(maxWidth: 768)
                .frame(height: max(geometry.size.height * 0.85, 320))
                .background(palette.editorBackground.swiftUI)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(themeStore.theme == .light ? Color.black.opacity(0.1) : Color.white.opacity(0.12), lineWidth: 1)
                )
                .shadow(color: .black.opacity(0.25), radius: 30, y: 16)
                .padding(24)
            }
        }
        .onAppear {
            Task { @MainActor in titleFocused = true }
        }
        .onChange(of: themeStore.theme) { controller.setTheme($0) }
        .onDisappear { controller.didClose() }
    }

    private func header(_ palette: ThemePalette) -> some View {
        HStack(spacing: 12) {
            TextField("Untitled", text: Binding(get: { controller.title }, set: { controller.setTitle($0) }))
                .textFieldStyle(.plain)
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(palette.editorTitle.swiftUI)
                .focused($titleFocused)
                .onSubmit { controller.focusBody() }
                .accessibilityLabel("Note title")

            Button("Cancel") { controller.cancel() }
                .buttonStyle(.pill(.secondary, palette))

            Button {
                controller.close()
            } label: {
                HStack(spacing: 6) {
                    Text("Save")
                    Text("⌘↵")
                        .font(.system(size: 11))
                        .padding(.horizontal, 5)
                        .padding(.vertical, 1)
                        .background(RoundedRectangle(cornerRadius: 4).fill(Color.primary.opacity(0.1)))
                }
            }
            .buttonStyle(.pill(.primary, palette))
            .keyboardShortcut(.return, modifiers: .command)

            // Escape from the title field. (In the body, the text view
            // handles Escape itself.)
            Button("Close") { controller.close() }
                .keyboardShortcut(.cancelAction)
                .frame(width: 0, height: 0)
                .opacity(0)
                .accessibilityHidden(true)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
    }
}
