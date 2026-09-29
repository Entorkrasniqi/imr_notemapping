import AppKit
import SwiftUI

/// The web app's three themes (`lib/theme/theme-context.tsx`). As there,
/// the choice is the user's explicit pick, persisted locally, and defaults
/// to light rather than following the OS setting.
enum Theme: String, CaseIterable, Identifiable {
    case light, dark, blueprint

    var id: String { rawValue }

    var label: String {
        switch self {
        case .light: return "Light"
        case .dark: return "Dark"
        case .blueprint: return "Blueprint"
        }
    }

    var systemImage: String {
        switch self {
        case .light: return "sun.max"
        case .dark: return "moon"
        case .blueprint: return "square.grid.3x3"
        }
    }

    /// System controls (text fields, menus, scroll bars) follow this, so
    /// they read correctly on the dark and blueprint backgrounds.
    var appearance: NSAppearance? {
        NSAppearance(named: self == .light ? .aqua : .darkAqua)
    }

    var palette: ThemePalette {
        switch self {
        case .light: return .light
        case .dark: return .dark
        case .blueprint: return .blueprint
        }
    }
}

/// Every themed color in the app. Values are the Tailwind colors the web
/// app's `dark:`/`blueprint:` classes use, so the two clients match.
struct ThemePalette {
    // Canvas
    let canvasBackground: NSColor
    let canvasDots: NSColor
    let minimapBackground: NSColor
    let minimapNode: NSColor
    let minimapMask: NSColor
    let noteText: NSColor
    let notePlaceholder: NSColor
    let noteMoreHint: NSColor
    let noteOutline: NSColor
    let noteDeleteGlyph: NSColor
    let dropOutline: NSColor
    let controlBackground: NSColor
    let controlGlyph: NSColor

    // Note editor
    let editorBackground: NSColor
    let editorDivider: NSColor
    let editorText: NSColor
    let editorTitle: NSColor
    let editorTitlePlaceholder: NSColor
    let editorBodyPlaceholder: NSColor
    let toolbarIcon: NSColor
    let toolbarIconActive: NSColor
    let toolbarActiveBackground: NSColor
    let toolbarDivider: NSColor

    // App chrome (login, dashboard)
    let pageBackgroundTop: NSColor
    let pageBackgroundBottom: NSColor
    let showsBlueprintGrid: Bool
    let textPrimary: NSColor
    let textSecondary: NSColor
    let textTertiary: NSColor
    let cardBackground: NSColor
    let cardBorder: NSColor
    let primaryButtonBackground: NSColor
    let primaryButtonText: NSColor
    let primaryButtonBorder: NSColor
    let secondaryButtonBackground: NSColor
    let secondaryButtonText: NSColor
    let secondaryButtonBorder: NSColor
    let inputBackground: NSColor
    let inputBorder: NSColor
    let errorText: NSColor
    let bannerBackground: NSColor
    let bannerBorder: NSColor
    let bannerText: NSColor
    let usageTrack: NSColor
    let usageFill: NSColor

    /// Edge colors don't change per theme on the web either
    /// (`DeletableEdge.tsx` / the arrow marker in `Board.tsx`).
    static let edge = NSColor(hex: 0xa1a1aa)
    static let edgeSelected = NSColor(hex: 0x3b82f6)

    private static let white = NSColor.white
    private static func white(_ alpha: CGFloat) -> NSColor { NSColor(white: 1, alpha: alpha) }

    static let light = ThemePalette(
        canvasBackground: NSColor(hex: 0xfafafa),
        canvasDots: NSColor(hex: 0xd4d4d8),
        minimapBackground: .white,
        minimapNode: NSColor(hex: 0xd4d4d8),
        minimapMask: NSColor(srgbRed: 244 / 255, green: 244 / 255, blue: 245 / 255, alpha: 0.6),
        noteText: NSColor(hex: 0x27272a),
        notePlaceholder: NSColor(hex: 0xa1a1aa),
        noteMoreHint: NSColor(hex: 0xd4d4d8),
        noteOutline: NSColor(hex: 0xa1a1aa),
        noteDeleteGlyph: NSColor(hex: 0xa1a1aa),
        dropOutline: NSColor(hex: 0x60a5fa),
        controlBackground: NSColor(hex: 0xfefefe),
        controlGlyph: NSColor(hex: 0x3f3f46),
        editorBackground: .white,
        editorDivider: NSColor(hex: 0xf4f4f5),
        editorText: NSColor(hex: 0x27272a),
        editorTitle: NSColor(hex: 0x18181b),
        editorTitlePlaceholder: NSColor(hex: 0xd4d4d8),
        editorBodyPlaceholder: NSColor(hex: 0xa1a1aa),
        toolbarIcon: NSColor(hex: 0x71717a),
        toolbarIconActive: NSColor(hex: 0x18181b),
        toolbarActiveBackground: NSColor(hex: 0xe4e4e7),
        toolbarDivider: NSColor(hex: 0xe4e4e7),
        pageBackgroundTop: NSColor(hex: 0xfafafa),
        pageBackgroundBottom: NSColor(hex: 0xf4f4f5),
        showsBlueprintGrid: false,
        textPrimary: NSColor(hex: 0x18181b),
        textSecondary: NSColor(hex: 0x71717a),
        textTertiary: NSColor(hex: 0xa1a1aa),
        cardBackground: .white,
        cardBorder: NSColor(hex: 0xe4e4e7, alpha: 0.8),
        primaryButtonBackground: NSColor(hex: 0x18181b),
        primaryButtonText: .white,
        primaryButtonBorder: .clear,
        secondaryButtonBackground: .white,
        secondaryButtonText: NSColor(hex: 0x52525b),
        secondaryButtonBorder: NSColor(hex: 0xe4e4e7),
        inputBackground: .white,
        inputBorder: NSColor(hex: 0xe4e4e7),
        errorText: NSColor(hex: 0xdc2626),
        bannerBackground: NSColor(hex: 0xfffbeb),
        bannerBorder: NSColor(hex: 0xfde68a),
        bannerText: NSColor(hex: 0x92400e),
        usageTrack: NSColor(hex: 0xe4e4e7, alpha: 0.7),
        usageFill: NSColor(hex: 0x27272a)
    )

    static let dark = ThemePalette(
        canvasBackground: NSColor(hex: 0x09090b),
        canvasDots: NSColor(hex: 0x3f3f46),
        minimapBackground: white(0.04),
        minimapNode: NSColor(hex: 0x52525b),
        minimapMask: NSColor(srgbRed: 9 / 255, green: 9 / 255, blue: 11 / 255, alpha: 0.6),
        noteText: white(0.85),
        notePlaceholder: white(0.3),
        noteMoreHint: white(0.2),
        noteOutline: white(0.5),
        noteDeleteGlyph: white(0.4),
        dropOutline: NSColor(hex: 0x60a5fa),
        controlBackground: white(0.08),
        controlGlyph: NSColor(hex: 0xe4e4e7),
        editorBackground: NSColor(hex: 0x18181b),
        editorDivider: white(0.1),
        editorText: white(0.85),
        editorTitle: .white,
        editorTitlePlaceholder: white(0.25),
        editorBodyPlaceholder: white(0.35),
        toolbarIcon: white(0.5),
        toolbarIconActive: .white,
        toolbarActiveBackground: white(0.2),
        toolbarDivider: white(0.15),
        pageBackgroundTop: NSColor(hex: 0x18181b),
        pageBackgroundBottom: NSColor(hex: 0x09090b),
        showsBlueprintGrid: false,
        textPrimary: .white,
        textSecondary: white(0.5),
        textTertiary: white(0.4),
        cardBackground: NSColor(hex: 0x18181b),
        cardBorder: white(0.1),
        primaryButtonBackground: .white,
        primaryButtonText: NSColor(hex: 0x18181b),
        primaryButtonBorder: .clear,
        secondaryButtonBackground: white(0.05),
        secondaryButtonText: white(0.6),
        secondaryButtonBorder: white(0.1),
        inputBackground: white(0.05),
        inputBorder: white(0.15),
        errorText: NSColor(hex: 0xf87171),
        bannerBackground: NSColor(hex: 0xf59e0b, alpha: 0.1),
        bannerBorder: NSColor(hex: 0xf59e0b, alpha: 0.2),
        bannerText: NSColor(hex: 0xfcd34d),
        usageTrack: white(0.1),
        usageFill: .white
    )

    /// A deep cyanotype blue — see the blueprint comment in globals.css.
    static let blueprintBlue = NSColor(hex: 0x0f3057)

    static let blueprint = ThemePalette(
        canvasBackground: blueprintBlue,
        canvasDots: white(0.25),
        minimapBackground: white(0.06),
        minimapNode: white(0.4),
        minimapMask: NSColor(srgbRed: 15 / 255, green: 48 / 255, blue: 87 / 255, alpha: 0.6),
        noteText: .white,
        notePlaceholder: white(0.4),
        noteMoreHint: white(0.3),
        noteOutline: white(0.7),
        noteDeleteGlyph: white(0.5),
        dropOutline: .white,
        controlBackground: white(0.08),
        controlGlyph: NSColor(hex: 0xe4e4e7),
        editorBackground: blueprintBlue,
        editorDivider: white(0.15),
        editorText: .white,
        editorTitle: .white,
        editorTitlePlaceholder: white(0.3),
        editorBodyPlaceholder: white(0.35),
        toolbarIcon: white(0.6),
        toolbarIconActive: .white,
        toolbarActiveBackground: white(0.25),
        toolbarDivider: white(0.25),
        pageBackgroundTop: blueprintBlue,
        pageBackgroundBottom: blueprintBlue,
        showsBlueprintGrid: true,
        textPrimary: .white,
        textSecondary: white(0.7),
        textTertiary: white(0.6),
        cardBackground: white(0.06),
        cardBorder: white(0.2),
        primaryButtonBackground: .clear,
        primaryButtonText: .white,
        primaryButtonBorder: white(0.4),
        secondaryButtonBackground: white(0.05),
        secondaryButtonText: white(0.7),
        secondaryButtonBorder: white(0.2),
        inputBackground: white(0.1),
        inputBorder: white(0.3),
        errorText: NSColor(hex: 0xfecaca),
        bannerBackground: white(0.1),
        bannerBorder: white(0.3),
        bannerText: .white,
        usageTrack: white(0.15),
        usageFill: .white
    )
}

@MainActor
final class ThemeStore: ObservableObject {
    /// Same key the web app uses for localStorage.
    private static let storageKey = "notemap-theme"

    @Published var theme: Theme {
        didSet {
            UserDefaults.standard.set(theme.rawValue, forKey: Self.storageKey)
            applyAppearance()
        }
    }

    init() {
        theme = UserDefaults.standard.string(forKey: Self.storageKey).flatMap(Theme.init(rawValue:)) ?? .light
        applyAppearance()
    }

    private func applyAppearance() {
        NSApplication.shared.appearance = theme.appearance
    }
}

extension NSColor {
    convenience init(hex: UInt32, alpha: CGFloat = 1) {
        self.init(
            srgbRed: CGFloat((hex >> 16) & 0xff) / 255,
            green: CGFloat((hex >> 8) & 0xff) / 255,
            blue: CGFloat(hex & 0xff) / 255,
            alpha: alpha
        )
    }

    var swiftUI: Color { Color(nsColor: self) }
}

/// Parses the CSS color strings Tiptap stores in `textStyle.color` and
/// `highlight.color` — the toolbar only ever writes `#rrggbb`, but notes
/// can also carry colors pasted in from elsewhere.
enum CSSColor {
    static func parse(_ raw: String?) -> NSColor? {
        guard let raw else { return nil }
        let value = raw.trimmingCharacters(in: .whitespaces).lowercased()
        if value.hasPrefix("#") { return parseHex(String(value.dropFirst())) }
        if value.hasPrefix("rgb") { return parseRGB(value) }
        return named[value]
    }

    private static func parseHex(_ hex: String) -> NSColor? {
        var digits = hex
        if digits.count == 3 || digits.count == 4 {
            digits = digits.map { "\($0)\($0)" }.joined()
        }
        guard digits.count == 6 || digits.count == 8, let number = UInt64(digits, radix: 16) else { return nil }
        if digits.count == 8 {
            return NSColor(hex: UInt32(number >> 8), alpha: CGFloat(number & 0xff) / 255)
        }
        return NSColor(hex: UInt32(number))
    }

    private static func parseRGB(_ value: String) -> NSColor? {
        guard let open = value.firstIndex(of: "("), let close = value.lastIndex(of: ")") else { return nil }
        let parts = value[value.index(after: open)..<close]
            .split(whereSeparator: { $0 == "," || $0 == " " || $0 == "/" })
            .compactMap { Double($0.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "%", with: "")) }
        guard parts.count >= 3 else { return nil }
        let alpha = parts.count >= 4 ? (parts[3] > 1 ? parts[3] / 100 : parts[3]) : 1
        return NSColor(srgbRed: parts[0] / 255, green: parts[1] / 255, blue: parts[2] / 255, alpha: alpha)
    }

    private static let named: [String: NSColor] = [
        "black": .black, "white": .white, "red": NSColor(hex: 0xff0000), "green": NSColor(hex: 0x008000),
        "blue": NSColor(hex: 0x0000ff), "yellow": NSColor(hex: 0xffff00), "orange": NSColor(hex: 0xffa500),
        "purple": NSColor(hex: 0x800080), "gray": NSColor(hex: 0x808080), "grey": NSColor(hex: 0x808080),
    ]
}
