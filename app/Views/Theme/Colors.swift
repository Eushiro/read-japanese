import SwiftUI

/// Custom colors that adapt better to dark mode for improved readability
extension Color {
    /// Secondary text color that's more readable in dark mode
    /// Use for descriptions, metadata, and less prominent text
    static func adaptiveSecondary(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? Color(white: 0.7) : Color(white: 0.4)
    }

    /// Tertiary text color for even less prominent text
    /// Use for timestamps, hints, and supplementary info
    static func adaptiveTertiary(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? Color(white: 0.55) : Color(white: 0.5)
    }

    /// Furigana color - needs to be readable but not distracting
    static func furigana(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? Color(white: 0.65) : Color(white: 0.4)
    }
}

/// View modifier for consistent secondary text styling
struct AdaptiveSecondaryText: ViewModifier {
    @Environment(\.colorScheme) private var colorScheme

    func body(content: Content) -> some View {
        content.foregroundStyle(Color.adaptiveSecondary(for: colorScheme))
    }
}

/// View modifier for consistent tertiary text styling
struct AdaptiveTertiaryText: ViewModifier {
    @Environment(\.colorScheme) private var colorScheme

    func body(content: Content) -> some View {
        content.foregroundStyle(Color.adaptiveTertiary(for: colorScheme))
    }
}

extension View {
    /// Apply adaptive secondary text color
    func adaptiveSecondary() -> some View {
        modifier(AdaptiveSecondaryText())
    }

    /// Apply adaptive tertiary text color
    func adaptiveTertiary() -> some View {
        modifier(AdaptiveTertiaryText())
    }
}
