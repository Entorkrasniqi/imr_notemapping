import SwiftUI

/// The three-way Light / Dark / Blueprint switch from the web app's
/// `ThemeToggle.tsx`, shown in the dashboard and board toolbars.
struct ThemeToggle: View {
    @EnvironmentObject private var themeStore: ThemeStore

    var body: some View {
        let palette = themeStore.theme.palette
        HStack(spacing: 2) {
            ForEach(Theme.allCases) { theme in
                let isActive = themeStore.theme == theme
                Button {
                    themeStore.theme = theme
                } label: {
                    Image(systemName: theme.systemImage)
                        .font(.system(size: 11, weight: .medium))
                        .frame(width: 24, height: 24)
                        .foregroundColor(isActive ? activeForeground(theme) : palette.textTertiary.swiftUI)
                        .background(Circle().fill(isActive ? activeBackground(theme) : Color.clear))
                        .contentShape(Circle())
                }
                .buttonStyle(.plain)
                .help(theme.label)
                .accessibilityLabel(theme.label)
                .accessibilityAddTraits(isActive ? .isSelected : [])
            }
        }
        .padding(2)
        .background(Capsule().fill(palette.secondaryButtonBackground.swiftUI))
        .overlay(Capsule().stroke(palette.secondaryButtonBorder.swiftUI, lineWidth: 1))
    }

    private func activeBackground(_ theme: Theme) -> Color {
        themeStore.theme == .light ? Color(nsColor: NSColor(hex: 0x18181b)) : .white
    }

    private func activeForeground(_ theme: Theme) -> Color {
        switch themeStore.theme {
        case .light: return .white
        case .dark: return Color(nsColor: NSColor(hex: 0x18181b))
        case .blueprint: return ThemePalette.blueprintBlue.swiftUI
        }
    }
}

/// NoteMap's two-node logo mark (`LogoMark` in Dashboard.tsx).
struct LogoMark: View {
    var size: CGFloat = 32

    var body: some View {
        RoundedRectangle(cornerRadius: size * 0.31, style: .continuous)
            .fill(LinearGradient(colors: [Color(nsColor: NSColor(hex: 0x27272a)), Color(nsColor: NSColor(hex: 0x09090b))],
                                 startPoint: .topLeading, endPoint: .bottomTrailing))
            .frame(width: size, height: size)
            .overlay(
                Canvas { context, canvasSize in
                    let unit = canvasSize.width / 16
                    var line = Path()
                    line.move(to: CGPoint(x: 6 * unit, y: 6 * unit))
                    line.addLine(to: CGPoint(x: 10 * unit, y: 10 * unit))
                    context.stroke(line, with: .color(.white.opacity(0.6)), lineWidth: 1.2 * unit)
                    for center in [CGPoint(x: 4.5, y: 4.5), CGPoint(x: 11.5, y: 11.5)] {
                        let rect = CGRect(x: (center.x - 2) * unit, y: (center.y - 2) * unit, width: 4 * unit, height: 4 * unit)
                        context.fill(Path(ellipseIn: rect), with: .color(.white.opacity(0.95)))
                    }
                }
                .frame(width: size / 2, height: size / 2)
            )
            .shadow(color: .black.opacity(0.2), radius: 1, y: 1)
    }
}

/// The page background behind login and the dashboard: a soft radial
/// gradient, or blueprint's drafting grid (`.blueprint-grid` on the web).
struct PageBackground: View {
    let palette: ThemePalette

    var body: some View {
        ZStack {
            RadialGradient(colors: [palette.pageBackgroundTop.swiftUI, palette.pageBackgroundBottom.swiftUI],
                           center: .top, startRadius: 0, endRadius: 900)
            if palette.showsBlueprintGrid {
                Canvas { context, size in
                    var grid = Path()
                    var x: CGFloat = 0
                    while x <= size.width {
                        grid.move(to: CGPoint(x: x, y: 0))
                        grid.addLine(to: CGPoint(x: x, y: size.height))
                        x += 24
                    }
                    var y: CGFloat = 0
                    while y <= size.height {
                        grid.move(to: CGPoint(x: 0, y: y))
                        grid.addLine(to: CGPoint(x: size.width, y: y))
                        y += 24
                    }
                    context.stroke(grid, with: .color(.white.opacity(0.07)), lineWidth: 1)
                }
            }
        }
        .ignoresSafeArea()
    }
}

/// The app's rounded "pill" buttons.
struct PillButtonStyle: ButtonStyle {
    enum Kind { case primary, secondary, upgrade }

    let kind: Kind
    let palette: ThemePalette
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 13, weight: kind == .upgrade ? .semibold : .medium))
            .padding(.horizontal, 14)
            .padding(.vertical, 6)
            .foregroundColor(foreground)
            .background(Capsule().fill(background))
            .overlay(Capsule().stroke(border, lineWidth: 1))
            .opacity(isEnabled ? (configuration.isPressed ? 0.8 : 1) : 0.4)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .contentShape(Capsule())
    }

    private var foreground: Color {
        switch kind {
        case .primary: return palette.primaryButtonText.swiftUI
        case .secondary: return palette.secondaryButtonText.swiftUI
        case .upgrade: return .white
        }
    }

    private var background: AnyShapeStyle {
        switch kind {
        case .primary: return AnyShapeStyle(palette.primaryButtonBackground.swiftUI)
        case .secondary: return AnyShapeStyle(palette.secondaryButtonBackground.swiftUI)
        case .upgrade:
            return AnyShapeStyle(LinearGradient(colors: [Color(nsColor: NSColor(hex: 0xf59e0b)), Color(nsColor: NSColor(hex: 0xfbbf24))],
                                                startPoint: .leading, endPoint: .trailing))
        }
    }

    private var border: Color {
        switch kind {
        case .primary: return palette.primaryButtonBorder.swiftUI
        case .secondary: return palette.secondaryButtonBorder.swiftUI
        case .upgrade: return .clear
        }
    }
}

extension ButtonStyle where Self == PillButtonStyle {
    static func pill(_ kind: PillButtonStyle.Kind, _ palette: ThemePalette) -> PillButtonStyle {
        PillButtonStyle(kind: kind, palette: palette)
    }
}
