import Foundation

/// Network errors that can occur when fetching stories
enum NetworkError: Error, LocalizedError {
    case invalidURL
    case noConnection
    case serverError(statusCode: Int)
    case decodingError(Error)
    case timeout
    case unknown(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid server URL"
        case .noConnection:
            return "No internet connection"
        case .serverError(let code):
            return "Server error (code: \(code))"
        case .decodingError:
            return "Failed to process server response"
        case .timeout:
            return "Request timed out"
        case .unknown(let error):
            return error.localizedDescription
        }
    }

    var isRetryable: Bool {
        switch self {
        case .invalidURL, .decodingError:
            return false
        case .noConnection, .serverError, .timeout, .unknown:
            return true
        }
    }
}

/// Result type for story loading operations
enum StoryLoadResult {
    case success([Story])
    case failure(NetworkError)
    case cached([Story])  // Returned cached data due to network error
}

/// Service for loading and managing stories from the backend API
class StoryService {
    static let shared = StoryService()

    private var cachedStories: [Story] = []
    private var baseURL: String { APIConfig.baseURL }

    /// Maximum number of retry attempts for failed requests
    private let maxRetries = 3

    /// Base delay between retries (uses exponential backoff)
    private let retryDelay: TimeInterval = 1.0

    private init() {}

    // MARK: - Public Methods

    /// Load all stories from the backend API with retry logic
    /// - Parameter forceRefresh: If true, ignores cache and fetches fresh data
    /// - Returns: StoryLoadResult indicating success, failure, or cached data
    func loadAllStories(forceRefresh: Bool = false) async -> StoryLoadResult {
        // Return cached if available and not forcing refresh
        if !forceRefresh && !cachedStories.isEmpty {
            return .success(cachedStories)
        }

        // Try to fetch with retries
        var lastError: NetworkError?
        for attempt in 0..<maxRetries {
            if attempt > 0 {
                // Exponential backoff
                let delay = retryDelay * pow(2.0, Double(attempt - 1))
                try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            }

            switch await fetchAllStories() {
            case .success(let stories):
                cachedStories = stories
                return .success(stories)
            case .failure(let error):
                lastError = error
                if !error.isRetryable {
                    break
                }
                print("StoryService: Attempt \(attempt + 1) failed: \(error.localizedDescription)")
            case .cached:
                break // shouldn't happen in fetchAllStories
            }
        }

        // If we have cached data, return it with the error context
        if !cachedStories.isEmpty {
            return .cached(cachedStories)
        }

        return .failure(lastError ?? .unknown(NSError(domain: "StoryService", code: -1)))
    }

    /// Load a single story by ID with retry logic
    func loadStory(byId id: String) async -> Story? {
        // Check cache first
        if let cached = cachedStories.first(where: { $0.id == id }) {
            return cached
        }

        var lastError: Error?
        for attempt in 0..<maxRetries {
            if attempt > 0 {
                let delay = retryDelay * pow(2.0, Double(attempt - 1))
                try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            }

            do {
                if let story = try await fetchStory(byId: id) {
                    return story
                }
            } catch {
                lastError = error
                print("StoryService: Attempt \(attempt + 1) failed for story \(id): \(error)")
            }
        }

        print("StoryService: Failed to load story \(id) after \(maxRetries) attempts: \(lastError?.localizedDescription ?? "unknown")")
        return nil
    }

    /// Load stories for a specific JLPT level
    func loadStories(for level: JLPTLevel) async -> [Story] {
        let result = await loadAllStories()
        switch result {
        case .success(let stories), .cached(let stories):
            return stories.filter { $0.metadata.jlptLevel == level }
        case .failure:
            return []
        }
    }

    /// Get stories grouped by JLPT level
    func storiesGroupedByLevel() async -> [JLPTLevel: [Story]] {
        let result = await loadAllStories()
        switch result {
        case .success(let stories), .cached(let stories):
            return Dictionary(grouping: stories) { $0.metadata.jlptLevel }
        case .failure:
            return [:]
        }
    }

    /// Clear cached stories (useful for pull-to-refresh)
    func clearCache() {
        cachedStories = []
    }

    // MARK: - Private Methods

    private func fetchAllStories() async -> StoryLoadResult {
        guard let url = URL(string: "\(baseURL)/api/stories") else {
            return .failure(.invalidURL)
        }

        do {
            let (data, response) = try await APIConfig.session.data(from: url)

            guard let httpResponse = response as? HTTPURLResponse else {
                return .failure(.unknown(NSError(domain: "StoryService", code: -1)))
            }

            guard httpResponse.statusCode == 200 else {
                return .failure(.serverError(statusCode: httpResponse.statusCode))
            }

            let decoder = JSONDecoder()
            let storyList = try decoder.decode([StoryListItem].self, from: data)

            // Fetch full story details concurrently
            let stories = await withTaskGroup(of: Story?.self, returning: [Story].self) { group in
                for item in storyList {
                    group.addTask {
                        try? await self.fetchStory(byId: item.id)
                    }
                }

                var results: [Story] = []
                for await story in group {
                    if let story = story {
                        results.append(story)
                    }
                }
                return results
            }

            // Sort stories by JLPT level (N5 first) then by title
            let sortedStories = stories.sorted { story1, story2 in
                if story1.metadata.jlptLevel != story2.metadata.jlptLevel {
                    return story1.metadata.jlptLevel.sortOrder < story2.metadata.jlptLevel.sortOrder
                }
                return story1.metadata.title < story2.metadata.title
            }

            return .success(sortedStories)
        } catch let error as URLError {
            switch error.code {
            case .notConnectedToInternet, .networkConnectionLost:
                return .failure(.noConnection)
            case .timedOut:
                return .failure(.timeout)
            default:
                return .failure(.unknown(error))
            }
        } catch let error as DecodingError {
            return .failure(.decodingError(error))
        } catch {
            return .failure(.unknown(error))
        }
    }

    private func fetchStory(byId id: String) async throws -> Story? {
        guard let url = URL(string: "\(baseURL)/api/stories/\(id)") else {
            throw NetworkError.invalidURL
        }

        let (data, response) = try await APIConfig.session.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.unknown(NSError(domain: "StoryService", code: -1))
        }

        guard httpResponse.statusCode == 200 else {
            throw NetworkError.serverError(statusCode: httpResponse.statusCode)
        }

        let decoder = JSONDecoder()
        return try decoder.decode(Story.self, from: data)
    }
}

/// Summary view of a story for listing (matches backend response)
struct StoryListItem: Codable {
    let id: String
    let title: String
    let titleJapanese: String?
    let jlptLevel: String
    let wordCount: Int
    let genre: String
    let summary: String
    let coverImageURL: String?
    let chapterCount: Int
}
