import SwiftUI

/// Font options for Japanese reading
enum JapaneseFont: String, CaseIterable, Identifiable {
    case system = "System"
    case hiraginoSans = "Hiragino Sans"
    case hiraginoMincho = "Hiragino Mincho"
    case rounded = "Rounded"

    var id: String { rawValue }

    var displayName: String { rawValue }

    var font: Font {
        switch self {
        case .system:
            return .system(size: 20)
        case .hiraginoSans:
            return .custom("Hiragino Sans", size: 20)
        case .hiraginoMincho:
            return .custom("Hiragino Mincho ProN", size: 20)
        case .rounded:
            return .system(size: 20, design: .rounded)
        }
    }

    func font(size: CGFloat) -> Font {
        switch self {
        case .system:
            return .system(size: size)
        case .hiraginoSans:
            return .custom("Hiragino Sans", size: size)
        case .hiraginoMincho:
            return .custom("Hiragino Mincho ProN", size: size)
        case .rounded:
            return .system(size: size, design: .rounded)
        }
    }

    var description: String {
        switch self {
        case .system:
            return "Default iOS font"
        case .hiraginoSans:
            return "Clean sans-serif"
        case .hiraginoMincho:
            return "Traditional serif"
        case .rounded:
            return "Soft rounded style"
        }
    }
}
