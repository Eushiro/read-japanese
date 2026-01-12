import SwiftUI

/// Represents the five JLPT (Japanese Language Proficiency Test) levels
/// N5 is the easiest, N1 is the most advanced
enum JLPTLevel: String, Codable, CaseIterable, Identifiable {
    case n5 = "N5"
    case n4 = "N4"
    case n3 = "N3"
    case n2 = "N2"
    case n1 = "N1"

    var id: String { rawValue }

    var displayName: String { rawValue }

    /// Difficulty from 1 (easiest) to 5 (hardest)
    var difficulty: Int {
        switch self {
        case .n5: return 1
        case .n4: return 2
        case .n3: return 3
        case .n2: return 4
        case .n1: return 5
        }
    }

    /// Sort order (same as difficulty, used for ordering stories)
    var sortOrder: Int { difficulty }

    /// Color associated with each level for UI display
    var color: Color {
        switch self {
        case .n5: return .green
        case .n4: return .blue
        case .n3: return .yellow
        case .n2: return .orange
        case .n1: return .red
        }
    }

    /// Description of the level
    var description: String {
        switch self {
        case .n5: return "Beginner"
        case .n4: return "Elementary"
        case .n3: return "Intermediate"
        case .n2: return "Upper Intermediate"
        case .n1: return "Advanced"
        }
    }

    /// Approximate vocabulary count for each level
    var vocabularyCount: Int {
        switch self {
        case .n5: return 800
        case .n4: return 1500
        case .n3: return 3700
        case .n2: return 6000
        case .n1: return 10000
        }
    }

    /// Target word count range for stories at each level
    var storyWordCountRange: ClosedRange<Int> {
        switch self {
        case .n5: return 150...200
        case .n4: return 250...300
        case .n3: return 400...450
        case .n2: return 600...650
        case .n1: return 800...850
        }
    }

    /// The next JLPT level up (harder level), nil if already at N1
    var nextLevelUp: JLPTLevel? {
        switch self {
        case .n5: return .n4
        case .n4: return .n3
        case .n3: return .n2
        case .n2: return .n1
        case .n1: return nil
        }
    }
}
