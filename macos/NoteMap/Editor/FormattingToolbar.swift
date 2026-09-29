import SwiftUI

/// The formatting controls under the note body — the same controls, in the
/// same order, as the web app's `Toolbar.tsx`.
struct FormattingToolbar: View {
    @ObservedObject var controller: EditorController
    let palette: ThemePalette

    @State private var openMenu: ColorMenuKind?

    private enum ColorMenuKind { case text, highlight }

    var body: some View {
        let state = controller.toolbar
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 2) {
                ToggleButton(label: Text("B").bold(), title: "Bold", active: state.bold, palette: palette) { controller.toggleBold() }
                ToggleButton(label: Text("I").italic(), title: "Italic", active: state.italic, palette: palette) { controller.toggleItalic() }
                ToggleButton(label: Text("U").underline(), title: "Underline", active: state.underline, palette: palette) { controller.toggleUnderline() }
                divider
                ForEach(1...3, id: \.self) { level in
                    ToggleButton(label: Text("H\(level)"), title: "Heading \(level)", active: state.headingLevel == level,
                                 palette: palette) { controller.toggleHeading(level) }
                }
                divider
                fontMenu(state)
                divider
                fontSizeField(state)
                divider
                ToggleButton(label: Image(systemName: "list.bullet"), title: "Bullet list", active: state.bulletList,
                             palette: palette) { controller.toggleList(.bulletList) }
                ToggleButton(label: Image(systemName: "list.number"), title: "Numbered list", active: state.orderedList,
                             palette: palette) { controller.toggleList(.orderedList) }
                divider
                ForEach(alignments, id: \.value) { alignment in
                    ToggleButton(label: Image(systemName: alignment.icon), title: alignment.title,
                                 active: state.align == alignment.value, palette: palette) { controller.setAlign(alignment.value) }
                }
                divider
                colorMenu(state)
                highlightMenu(state)
                divider
                ToggleButton(label: Image(systemName: "arrow.uturn.backward"), title: "Undo", active: nil,
                             palette: palette) { controller.undo() }
                    .disabled(!state.canUndo)
                ToggleButton(label: Image(systemName: "arrow.uturn.forward"), title: "Redo", active: nil,
                             palette: palette) { controller.redo() }
                    .disabled(!state.canRedo)
            }
            .padding(.vertical, 1)
        }
    }

    private let alignments: [(value: String, icon: String, title: String)] = [
        ("left", "text.alignleft", "Align left"),
        ("center", "text.aligncenter", "Align center"),
        ("right", "text.alignright", "Align right"),
        ("justify", "text.justify", "Justify"),
    ]

    private var divider: some View {
        Rectangle()
            .fill(palette.toolbarDivider.swiftUI)
            .frame(width: 1, height: 16)
            .padding(.horizontal, 4)
    }

    private func fontMenu(_ state: EditorController.ToolbarState) -> some View {
        let label = EditorController.fontFamilies.first { $0.value == state.fontFamily }?.label
            ?? (state.fontFamily.isEmpty ? "Default" : "Custom")
        return Menu {
            ForEach(EditorController.fontFamilies, id: \.label) { font in
                Button(font.label) { controller.setFontFamily(font.value) }
            }
        } label: {
            Text(label).font(.system(size: 12))
        }
        .menuStyle(.borderlessButton)
        .fixedSize()
        .help("Font")
    }

    private func fontSizeField(_ state: EditorController.ToolbarState) -> some View {
        HStack(spacing: 3) {
            TextField("16", text: Binding(
                get: { controller.toolbar.fontSize },
                set: { controller.setFontSize(text: $0) }
            ))
            .textFieldStyle(.plain)
            .font(.system(size: 12))
            .multilineTextAlignment(.center)
            .frame(width: 30)
            .onSubmit { controller.focusBodyKeepingSelection() }
            Text("px")
                .font(.system(size: 10))
                .foregroundColor(palette.toolbarIcon.swiftUI.opacity(0.7))
        }
        .help("Text size (\(EditorController.fontSizeRange.lowerBound)–\(EditorController.fontSizeRange.upperBound)px)")
    }

    private func colorMenu(_ state: EditorController.ToolbarState) -> some View {
        ColorMenuButton(letter: "A", title: "Text color", swatch: state.color, palette: palette,
                        isOpen: binding(for: .text)) {
            ForEach(EditorController.textColors, id: \.label) { color in
                SwatchButton(color: color.value ?? "#ffffff", title: color.label, selected: state.color == color.value) {
                    controller.setColor(color.value)
                    openMenu = nil
                }
            }
        }
    }

    private func highlightMenu(_ state: EditorController.ToolbarState) -> some View {
        ColorMenuButton(letter: "H", title: "Highlight", swatch: state.highlightColor, palette: palette,
                        isOpen: binding(for: .highlight)) {
            ForEach(EditorController.highlightColors, id: \.label) { color in
                SwatchButton(color: color.value, title: color.label, selected: state.highlightColor == color.value) {
                    controller.toggleHighlight(color.value)
                    openMenu = nil
                }
            }
            Button {
                controller.clearHighlight()
                openMenu = nil
            } label: {
                Image(systemName: "xmark").font(.system(size: 10, weight: .semibold))
            }
            .buttonStyle(.plain)
            .help("Clear highlight")
        }
    }

    private func binding(for kind: ColorMenuKind) -> Binding<Bool> {
        Binding(get: { openMenu == kind }, set: { openMenu = $0 ? kind : nil })
    }
}

private struct ToggleButton<Label: View>: View {
    let label: Label
    let title: String
    /// `nil` for plain actions (undo/redo), which aren't toggles.
    let active: Bool?
    let palette: ThemePalette
    let action: () -> Void
    @Environment(\.isEnabled) private var isEnabled
    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            label
                .font(.system(size: 12, weight: .medium))
                .frame(minWidth: 26, minHeight: 24)
                .padding(.horizontal, 2)
                .foregroundColor(active == true ? palette.toolbarIconActive.swiftUI : palette.toolbarIcon.swiftUI)
                .background(
                    RoundedRectangle(cornerRadius: 4)
                        .fill(active == true ? palette.toolbarActiveBackground.swiftUI
                              : (hovering && isEnabled ? palette.toolbarActiveBackground.swiftUI.opacity(0.5) : .clear))
                )
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .opacity(isEnabled ? 1 : 0.3)
        .onHover { hovering = $0 }
        .help(title)
        .accessibilityLabel(title)
        .accessibilityAddTraits(active == true ? .isSelected : [])
    }
}

/// A compact trigger with a small color bar under its letter, opening a
/// palette of swatches — the web toolbar's `ColorMenu`.
private struct ColorMenuButton<Content: View>: View {
    let letter: String
    let title: String
    let swatch: String?
    let palette: ThemePalette
    @Binding var isOpen: Bool
    @ViewBuilder let content: () -> Content

    var body: some View {
        Button {
            isOpen.toggle()
        } label: {
            VStack(spacing: 2) {
                Text(letter).font(.system(size: 12, weight: .bold))
                Capsule()
                    .fill(swatch.flatMap(CSSColor.parse).map { Color(nsColor: $0) } ?? palette.toolbarIcon.swiftUI)
                    .frame(width: 14, height: 3)
            }
            .frame(minWidth: 26, minHeight: 24)
            .foregroundColor(palette.toolbarIcon.swiftUI)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .help(title)
        .accessibilityLabel(title)
        .popover(isPresented: $isOpen, arrowEdge: .top) {
            HStack(spacing: 6) { content() }
                .padding(8)
        }
    }
}

private struct SwatchButton: View {
    let color: String
    let title: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Circle()
                .fill(CSSColor.parse(color).map { Color(nsColor: $0) } ?? .white)
                .frame(width: 16, height: 16)
                .overlay(Circle().stroke(selected ? Color.primary : Color.secondary.opacity(0.4), lineWidth: selected ? 1.5 : 1))
                .scaleEffect(selected ? 1.1 : 1)
        }
        .buttonStyle(.plain)
        .help(title)
        .accessibilityLabel(title)
    }
}
