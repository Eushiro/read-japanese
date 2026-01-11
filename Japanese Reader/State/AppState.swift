import SwiftUI
import Combine

/// Global app state container (similar to React Context)
/// Access this via @EnvironmentObject in views
@MainActor
class AppState: ObservableObject {
    // MARK: - Published State

    @Published var stories: [Story] = []
    @Published var isLoadingStories = false
    @Published var storiesError: Error?

    // Reading progress tracking
    @Published var readingProgress: [String: ReadingProgress] = [:]

    // Vocabulary items
    @Published var vocabularyItems: [VocabularyItem] = []

    // MARK: - Services

    let storyService = StoryService()

    // MARK: - Initialization

    init() {
        loadVocabularyFromStorage()
        loadReadingProgressFromStorage()
    }

    // MARK: - Computed Properties

    /// Stories grouped by JLPT level
    var storiesByLevel: [JLPTLevel: [Story]] {
        Dictionary(grouping: stories) { $0.metadata.jlptLevel }
    }

    /// Count of stories for each level
    var storyCountByLevel: [JLPTLevel: Int] {
        var counts: [JLPTLevel: Int] = [:]
        for level in JLPTLevel.allCases {
            counts[level] = storiesByLevel[level]?.count ?? 0
        }
        return counts
    }

    // MARK: - Story Loading

    /// Load all stories from JSON files
    func loadStories() async {
        isLoadingStories = true
        storiesError = nil

        stories = await storyService.loadAllStories()

        isLoadingStories = false
    }

    /// Get stories for a specific level
    func stories(for level: JLPTLevel) -> [Story] {
        storiesByLevel[level] ?? []
    }

    /// Find a story by ID
    func story(byId id: String) -> Story? {
        stories.first { $0.id == id }
    }

    // MARK: - Reading Progress

    /// Get reading progress for a story
    func progress(for storyId: String) -> ReadingProgress? {
        readingProgress[storyId]
    }

    /// Update reading progress for a story
    func updateProgress(for storyId: String, segmentIndex: Int, percentComplete: Double) {
        if var progress = readingProgress[storyId] {
            progress.currentSegmentIndex = segmentIndex
            progress.percentComplete = percentComplete
            progress.lastReadDate = Date()
            readingProgress[storyId] = progress
        } else {
            readingProgress[storyId] = ReadingProgress(
                storyId: storyId,
                currentSegmentIndex: segmentIndex,
                percentComplete: percentComplete
            )
        }
        saveReadingProgressToStorage()
    }

    /// Mark a story as completed
    func markCompleted(storyId: String) {
        if var progress = readingProgress[storyId] {
            progress.percentComplete = 100.0
            progress.completedDate = Date()
            readingProgress[storyId] = progress
        } else {
            var progress = ReadingProgress(
                storyId: storyId,
                currentSegmentIndex: 0,
                percentComplete: 100.0
            )
            progress.completedDate = Date()
            readingProgress[storyId] = progress
        }
        saveReadingProgressToStorage()
    }

    /// Mark a story as unread (remove all progress)
    func markUnread(storyId: String) {
        readingProgress.removeValue(forKey: storyId)
        saveReadingProgressToStorage()
    }

    /// Check if a story has been started
    func hasStarted(storyId: String) -> Bool {
        readingProgress[storyId] != nil
    }

    /// Check if a story has been completed
    func hasCompleted(storyId: String) -> Bool {
        readingProgress[storyId]?.completedDate != nil
    }

    /// Get recommended stories based on the current story
    /// Returns up to 3 stories with same JLPT level, preferring similar genres
    func recommendedStories(for story: Story) -> [Story] {
        let candidates = stories.filter { candidate in
            // Exclude the current story
            guard candidate.id != story.id else { return false }
            // Same JLPT level
            guard candidate.metadata.jlptLevel == story.metadata.jlptLevel else { return false }
            // Exclude already completed stories
            guard !hasCompleted(storyId: candidate.id) else { return false }
            return true
        }

        // Sort by genre match (same genre first), then by word count similarity
        let sorted = candidates.sorted { a, b in
            let aGenreMatch = a.metadata.genre == story.metadata.genre
            let bGenreMatch = b.metadata.genre == story.metadata.genre
            if aGenreMatch != bGenreMatch {
                return aGenreMatch
            }
            // Prefer stories with similar length
            let aDiff = abs(a.metadata.wordCount - story.metadata.wordCount)
            let bDiff = abs(b.metadata.wordCount - story.metadata.wordCount)
            return aDiff < bDiff
        }

        return Array(sorted.prefix(3))
    }

    // MARK: - Vocabulary Management

    /// Save a vocabulary item
    func saveVocabularyItem(_ item: VocabularyItem) {
        // Check if word already exists
        if !vocabularyItems.contains(where: { $0.word == item.word }) {
            vocabularyItems.append(item)
            saveVocabularyToStorage()
        }
    }

    /// Remove a vocabulary item
    func removeVocabularyItem(_ item: VocabularyItem) {
        vocabularyItems.removeAll { $0.id == item.id }
        saveVocabularyToStorage()
    }

    /// Check if a word is in vocabulary
    func isInVocabulary(word: String) -> Bool {
        vocabularyItems.contains { $0.word == word }
    }

    /// Load vocabulary from UserDefaults
    func loadVocabularyFromStorage() {
        if let data = UserDefaults.standard.data(forKey: "vocabularyItems"),
           let items = try? JSONDecoder().decode([VocabularyItem].self, from: data) {
            vocabularyItems = items
        }
    }

    /// Save vocabulary to UserDefaults
    private func saveVocabularyToStorage() {
        if let data = try? JSONEncoder().encode(vocabularyItems) {
            UserDefaults.standard.set(data, forKey: "vocabularyItems")
        }
    }

    // MARK: - Reading Progress Persistence

    /// Load reading progress from UserDefaults
    func loadReadingProgressFromStorage() {
        if let data = UserDefaults.standard.data(forKey: "readingProgress"),
           let progress = try? JSONDecoder().decode([String: ReadingProgress].self, from: data) {
            readingProgress = progress
        }
    }

    /// Save reading progress to UserDefaults
    private func saveReadingProgressToStorage() {
        if let data = try? JSONEncoder().encode(readingProgress) {
            UserDefaults.standard.set(data, forKey: "readingProgress")
        }
    }
}

/// Tracks reading progress for a story
struct ReadingProgress: Codable {
    let storyId: String
    var currentSegmentIndex: Int
    var percentComplete: Double
    var startedDate: Date
    var lastReadDate: Date
    var completedDate: Date?

    init(storyId: String, currentSegmentIndex: Int, percentComplete: Double) {
        self.storyId = storyId
        self.currentSegmentIndex = currentSegmentIndex
        self.percentComplete = percentComplete
        self.startedDate = Date()
        self.lastReadDate = Date()
        self.completedDate = nil
    }

    var isCompleted: Bool {
        completedDate != nil
    }
}
