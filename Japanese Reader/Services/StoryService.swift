import Foundation

/// Service for loading and managing stories from the backend API
class StoryService {
    private var cachedStories: [Story] = []
    private let baseURL = "http://localhost:8000"

    /// Load all stories from the backend API
    func loadAllStories() async -> [Story] {
        if !cachedStories.isEmpty {
            return cachedStories
        }

        guard let url = URL(string: "\(baseURL)/api/stories") else {
            print("StoryService: Invalid URL")
            return []
        }

        do {
            let (data, response) = try await URLSession.shared.data(from: url)

            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                print("StoryService: Bad response from server")
                return []
            }

            let decoder = JSONDecoder()
            let storyList = try decoder.decode([StoryListItem].self, from: data)

            // Fetch full story details for each story
            var stories: [Story] = []
            for item in storyList {
                if let story = await loadStory(byId: item.id) {
                    stories.append(story)
                }
            }

            // Sort stories by JLPT level (N5 first) then by title
            stories.sort { story1, story2 in
                if story1.metadata.jlptLevel != story2.metadata.jlptLevel {
                    return story1.metadata.jlptLevel.sortOrder < story2.metadata.jlptLevel.sortOrder
                }
                return story1.metadata.title < story2.metadata.title
            }

            cachedStories = stories
            return stories
        } catch {
            print("StoryService: Error loading stories: \(error)")
            return []
        }
    }

    /// Load stories for a specific JLPT level
    func loadStories(for level: JLPTLevel) async -> [Story] {
        let allStories = await loadAllStories()
        return allStories.filter { $0.metadata.jlptLevel == level }
    }

    /// Load a story by its ID from the backend
    func loadStory(byId id: String) async -> Story? {
        guard let url = URL(string: "\(baseURL)/api/stories/\(id)") else {
            print("StoryService: Invalid URL for story \(id)")
            return nil
        }

        do {
            let (data, response) = try await URLSession.shared.data(from: url)

            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                print("StoryService: Bad response for story \(id)")
                return nil
            }

            let decoder = JSONDecoder()
            let story = try decoder.decode(Story.self, from: data)
            return story
        } catch {
            print("StoryService: Error loading story \(id): \(error)")
            return nil
        }
    }

    /// Get stories filtered by level
    func stories(for level: JLPTLevel) async -> [Story] {
        let allStories = await loadAllStories()
        return allStories.filter { $0.metadata.jlptLevel == level }
    }

    /// Get stories grouped by JLPT level
    func storiesGroupedByLevel() async -> [JLPTLevel: [Story]] {
        let allStories = await loadAllStories()
        return Dictionary(grouping: allStories) { $0.metadata.jlptLevel }
    }

    /// Clear cached stories (useful for refreshing)
    func clearCache() {
        cachedStories = []
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
