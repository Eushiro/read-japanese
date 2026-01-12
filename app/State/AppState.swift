import SwiftUI
import Combine

/// Global app state container (similar to React Context)
/// Access this via @EnvironmentObject in views
@MainActor
class AppState: ObservableObject {
    // MARK: - Published State

    @Published var stories: [Story] = []
    @Published var isLoadingStories = false
    @Published var storiesError: NetworkError?
    @Published var isUsingCachedData = false  // True if showing stale data due to network error

    // Reading progress tracking
    @Published var readingProgress: [String: ReadingProgress] = [:]

    // Vocabulary items
    @Published var vocabularyItems: [VocabularyItem] = []

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

    /// Load all stories from the backend API
    /// - Parameter forceRefresh: If true, bypasses cache and fetches fresh data
    func loadStories(forceRefresh: Bool = false) async {
        isLoadingStories = true
        storiesError = nil
        isUsingCachedData = false

        let result = await StoryService.shared.loadAllStories(forceRefresh: forceRefresh)

        switch result {
        case .success(let loadedStories):
            stories = loadedStories
            storiesError = nil
        case .cached(let cachedStories):
            stories = cachedStories
            isUsingCachedData = true
            // Don't set error - we have data to show
        case .failure(let error):
            storiesError = error
            // Keep existing stories if we have them
        }

        isLoadingStories = false
    }

    /// Refresh stories (force fetch from server)
    func refreshStories() async {
        await loadStories(forceRefresh: true)
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
    /// Returns 2 stories of the same level + 1 story of the next level up (if available)
    func recommendedStories(for story: Story) -> [Story] {
        // Helper to sort candidates by genre match, then word count similarity
        func sortCandidates(_ candidates: [Story]) -> [Story] {
            candidates.sorted { a, b in
                let aGenreMatch = a.metadata.genre == story.metadata.genre
                let bGenreMatch = b.metadata.genre == story.metadata.genre
                if aGenreMatch != bGenreMatch {
                    return aGenreMatch
                }
                let aDiff = abs(a.metadata.wordCount - story.metadata.wordCount)
                let bDiff = abs(b.metadata.wordCount - story.metadata.wordCount)
                return aDiff < bDiff
            }
        }

        // Get candidates at the same level
        let sameLevelCandidates = stories.filter { candidate in
            guard candidate.id != story.id else { return false }
            guard candidate.metadata.jlptLevel == story.metadata.jlptLevel else { return false }
            guard !hasCompleted(storyId: candidate.id) else { return false }
            return true
        }

        // Get the next level up (N5 -> N4 -> N3 -> N2 -> N1)
        let nextLevel = story.metadata.jlptLevel.nextLevelUp

        // Get candidates at the next level up
        let nextLevelCandidates: [Story]
        if let nextLevel = nextLevel {
            nextLevelCandidates = stories.filter { candidate in
                guard candidate.id != story.id else { return false }
                guard candidate.metadata.jlptLevel == nextLevel else { return false }
                guard !hasCompleted(storyId: candidate.id) else { return false }
                return true
            }
        } else {
            nextLevelCandidates = []
        }

        // Take up to 2 from same level, then 1 from next level
        var recommendations: [Story] = []
        recommendations.append(contentsOf: sortCandidates(sameLevelCandidates).prefix(2))

        if let nextLevelStory = sortCandidates(nextLevelCandidates).first {
            recommendations.append(nextLevelStory)
        } else if recommendations.count < 3 {
            // If no next level story, fill with more same level stories
            let remaining = sortCandidates(sameLevelCandidates).dropFirst(2).prefix(3 - recommendations.count)
            recommendations.append(contentsOf: remaining)
        }

        return recommendations
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

    /// Remove a vocabulary item by word (checks both surface and base form)
    func removeVocabularyItemByWord(_ word: String, baseForm: String? = nil) {
        vocabularyItems.removeAll { item in
            item.word == word || (baseForm != nil && item.word == baseForm)
        }
        saveVocabularyToStorage()
    }

    /// Check if a word is in vocabulary (checks both surface and base form)
    func isInVocabulary(word: String, baseForm: String? = nil) -> Bool {
        vocabularyItems.contains { item in
            item.word == word || (baseForm != nil && item.word == baseForm)
        }
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
