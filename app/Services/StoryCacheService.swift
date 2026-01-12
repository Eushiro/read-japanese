import Foundation

/// Service for persisting stories to disk for offline access
actor StoryCacheService {
    static let shared = StoryCacheService()

    private let fileManager = FileManager.default
    private let cacheDirectory: URL
    private let storiesFile: URL

    private init() {
        let caches = fileManager.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        cacheDirectory = caches.appendingPathComponent("StoryCache", isDirectory: true)
        storiesFile = cacheDirectory.appendingPathComponent("stories.json")

        try? fileManager.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
    }

    /// Save stories to disk
    func saveStories(_ stories: [Story]) {
        do {
            let encoder = JSONEncoder()
            encoder.outputFormatting = .prettyPrinted
            let data = try encoder.encode(stories)
            try data.write(to: storiesFile)
        } catch {
            print("Failed to cache stories: \(error)")
        }
    }

    /// Load stories from disk cache
    func loadCachedStories() -> [Story]? {
        guard fileManager.fileExists(atPath: storiesFile.path) else {
            return nil
        }

        do {
            let data = try Data(contentsOf: storiesFile)
            let decoder = JSONDecoder()
            return try decoder.decode([Story].self, from: data)
        } catch {
            print("Failed to load cached stories: \(error)")
            return nil
        }
    }

    /// Check if stories are cached
    func hasCachedStories() -> Bool {
        fileManager.fileExists(atPath: storiesFile.path)
    }

    /// Clear cached stories
    func clearCache() {
        try? fileManager.removeItem(at: storiesFile)
    }

    /// Get cache age in seconds
    func cacheAge() -> TimeInterval? {
        guard let attributes = try? fileManager.attributesOfItem(atPath: storiesFile.path),
              let modDate = attributes[.modificationDate] as? Date else {
            return nil
        }
        return Date().timeIntervalSince(modDate)
    }
}
