import Foundation

/// Service for looking up Japanese words using Jisho.org API
class DictionaryService {
    static let shared = DictionaryService()

    private let baseURL = "https://jisho.org/api/v1/search/words"
    private var cache: [String: WordDefinition] = [:]

    private init() {}

    /// Look up a word in the dictionary
    func lookup(_ word: String) async throws -> WordDefinition? {
        // Check cache first
        if let cached = cache[word] {
            return cached
        }

        // Build URL
        guard let encodedWord = word.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "\(baseURL)?keyword=\(encodedWord)") else {
            throw DictionaryError.invalidWord
        }

        // Make request
        let (data, response) = try await URLSession.shared.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw DictionaryError.networkError
        }

        // Parse response
        let result = try JSONDecoder().decode(JishoResponse.self, from: data)

        guard let firstResult = result.data.first else {
            return nil
        }

        // Convert to WordDefinition
        let definition = parseJishoResult(firstResult, searchWord: word)

        // Cache the result
        cache[word] = definition

        return definition
    }

    /// Parse Jisho API result into WordDefinition
    private func parseJishoResult(_ result: JishoWord, searchWord: String) -> WordDefinition {
        // Get the main word/reading
        let japanese = result.japanese.first
        let word = japanese?.word ?? japanese?.reading ?? searchWord
        let reading = japanese?.reading ?? word

        // Get definitions
        var definitions: [String] = []
        var partsOfSpeech: [String] = []

        for sense in result.senses {
            let meanings = sense.english_definitions.joined(separator: ", ")
            if !meanings.isEmpty {
                definitions.append(meanings)
            }
            partsOfSpeech.append(contentsOf: sense.parts_of_speech)
        }

        // Get JLPT level
        let jlptLevel = result.jlpt.first

        return WordDefinition(
            word: word,
            reading: reading,
            definitions: definitions,
            partsOfSpeech: Array(Set(partsOfSpeech)), // Remove duplicates
            jlptLevel: jlptLevel,
            isCommon: result.is_common ?? false
        )
    }

    /// Clear the cache
    func clearCache() {
        cache.removeAll()
    }
}

// MARK: - Jisho API Response Models

struct JishoResponse: Codable {
    let data: [JishoWord]
}

struct JishoWord: Codable {
    let slug: String
    let is_common: Bool?
    let jlpt: [String]
    let japanese: [JishoJapanese]
    let senses: [JishoSense]
}

struct JishoJapanese: Codable {
    let word: String?
    let reading: String?
}

struct JishoSense: Codable {
    let english_definitions: [String]
    let parts_of_speech: [String]
}

// MARK: - Errors

enum DictionaryError: LocalizedError {
    case invalidWord
    case networkError
    case parseError

    var errorDescription: String? {
        switch self {
        case .invalidWord:
            return "Invalid word"
        case .networkError:
            return "Network error"
        case .parseError:
            return "Failed to parse response"
        }
    }
}
