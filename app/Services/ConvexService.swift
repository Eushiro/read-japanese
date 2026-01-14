import Foundation
import Combine

#if canImport(ConvexMobile)
import ConvexMobile
#endif

// MARK: - Convex Data Models

struct ConvexUserSettings: Codable {
    let showFurigana: Bool
    let theme: String?
    let fontSize: String?
    let autoplayAudio: Bool?
}

struct ConvexVocabularyItem: Codable, Identifiable {
    let _id: String
    let userId: String
    let word: String
    let reading: String
    let meaning: String
    let jlptLevel: String?
    let partOfSpeech: String?
    let sourceStoryId: String?
    let sourceStoryTitle: String?
    let createdAt: Double

    var id: String { _id }
}

struct ConvexReadingProgress: Codable {
    let _id: String
    let userId: String
    let storyId: String
    let currentChapterIndex: Int
    let currentSegmentIndex: Int
    let percentComplete: Double
    let isCompleted: Bool
    let lastReadAt: Double
}

// MARK: - Convex Service

/// Service for syncing user data (settings, vocabulary, progress) with Convex backend.
/// Provides real-time sync between iOS app and web app.
class ConvexService: ObservableObject {
    static let shared = ConvexService()

    // Convex deployment URL - same as web app
    private let deploymentUrl = "https://sensible-puma-385.convex.cloud"

    // TODO: Replace with actual user ID from authentication
    // Using shared-dev-user for testing sync between iOS and web apps
    private let userId = "shared-dev-user"

    #if canImport(ConvexMobile)
    private var client: ConvexClient?
    #endif

    @Published var settings: ConvexUserSettings?
    @Published var vocabulary: [ConvexVocabularyItem] = []
    @Published var readingProgress: [String: ConvexReadingProgress] = [:] // storyId -> progress

    @Published var isConnected = false
    @Published var lastError: Error?

    private var cancellables = Set<AnyCancellable>()

    private init() {
        #if canImport(ConvexMobile)
        setupClient()
        #else
        print("ConvexMobile not available - running without sync")
        #endif
    }

    #if canImport(ConvexMobile)
    private func setupClient() {
        client = ConvexClient(deploymentUrl: deploymentUrl)
        isConnected = true

        // Start subscriptions
        subscribeToSettings()
        subscribeToVocabulary()
        subscribeToProgress()
    }

    // MARK: - Settings

    private func subscribeToSettings() {
        guard let client = client else { return }

        Task {
            for await settings: ConvexUserSettings in client.subscribe(
                to: "settings:get",
                with: ["userId": userId],
                yielding: ConvexUserSettings.self
            ).replaceError(with: ConvexUserSettings(
                showFurigana: true,
                theme: "system",
                fontSize: "medium",
                autoplayAudio: false
            )).values {
                await MainActor.run {
                    self.settings = settings
                }
            }
        }
    }

    func updateSettings(
        showFurigana: Bool? = nil,
        theme: String? = nil,
        fontSize: String? = nil,
        autoplayAudio: Bool? = nil
    ) async throws {
        guard let client = client else { return }

        var args: [String: (any ConvexEncodable)?] = ["userId": userId]
        if let showFurigana = showFurigana { args["showFurigana"] = showFurigana }
        if let theme = theme { args["theme"] = theme }
        if let fontSize = fontSize { args["fontSize"] = fontSize }
        if let autoplayAudio = autoplayAudio { args["autoplayAudio"] = autoplayAudio }

        try await client.mutation("settings:update", with: args)
    }

    // MARK: - Vocabulary

    private func subscribeToVocabulary() {
        guard let client = client else { return }

        Task {
            for await items: [ConvexVocabularyItem] in client.subscribe(
                to: "vocabulary:list",
                with: ["userId": userId],
                yielding: [ConvexVocabularyItem].self
            ).replaceError(with: []).values {
                await MainActor.run {
                    self.vocabulary = items
                }
            }
        }
    }

    func addVocabulary(
        word: String,
        reading: String,
        meaning: String,
        jlptLevel: String? = nil,
        sourceStoryId: String? = nil
    ) async throws {
        guard let client = client else { return }

        var args: [String: (any ConvexEncodable)?] = [
            "userId": userId,
            "word": word,
            "reading": reading,
            "meaning": meaning
        ]
        if let jlptLevel = jlptLevel { args["jlptLevel"] = jlptLevel }
        if let sourceStoryId = sourceStoryId { args["sourceStoryId"] = sourceStoryId }

        try await client.mutation("vocabulary:add", with: args)
    }

    func removeVocabulary(id: String) async throws {
        guard let client = client else { return }
        try await client.mutation("vocabulary:remove", with: ["id": id])
    }

    // MARK: - Reading Progress

    private func subscribeToProgress() {
        guard let client = client else { return }

        Task {
            for await items: [ConvexReadingProgress] in client.subscribe(
                to: "progress:listAll",
                with: ["userId": userId],
                yielding: [ConvexReadingProgress].self
            ).replaceError(with: []).values {
                await MainActor.run {
                    self.readingProgress = Dictionary(
                        uniqueKeysWithValues: items.map { ($0.storyId, $0) }
                    )
                }
            }
        }
    }

    func updateProgress(
        storyId: String,
        currentChapterIndex: Int,
        currentSegmentIndex: Int,
        percentComplete: Double,
        isCompleted: Bool = false
    ) async throws {
        guard let client = client else { return }

        try await client.mutation("progress:update", with: [
            "userId": userId,
            "storyId": storyId,
            "currentChapterIndex": currentChapterIndex,
            "currentSegmentIndex": currentSegmentIndex,
            "percentComplete": percentComplete,
            "isCompleted": isCompleted
        ])
    }

    #else
    // Stub implementations when ConvexMobile is not available

    func updateSettings(
        showFurigana: Bool? = nil,
        theme: String? = nil,
        fontSize: String? = nil,
        autoplayAudio: Bool? = nil
    ) async throws {
        print("ConvexMobile not available - settings not synced")
    }

    func addVocabulary(
        word: String,
        reading: String,
        meaning: String,
        jlptLevel: String? = nil,
        sourceStoryId: String? = nil
    ) async throws {
        print("ConvexMobile not available - vocabulary not synced")
    }

    func removeVocabulary(id: String) async throws {
        print("ConvexMobile not available - vocabulary not synced")
    }

    func updateProgress(
        storyId: String,
        currentChapterIndex: Int,
        currentSegmentIndex: Int,
        percentComplete: Double,
        isCompleted: Bool = false
    ) async throws {
        print("ConvexMobile not available - progress not synced")
    }
    #endif
}
