import Foundation

/// Represents a word definition from dictionary lookup
struct WordDefinition: Identifiable, Codable {
    let id: UUID
    let word: String
    let reading: String
    let definitions: [String]
    let partsOfSpeech: [String]
    let jlptLevel: String?
    let isCommon: Bool

    init(
        id: UUID = UUID(),
        word: String,
        reading: String,
        definitions: [String],
        partsOfSpeech: [String] = [],
        jlptLevel: String? = nil,
        isCommon: Bool = false
    ) {
        self.id = id
        self.word = word
        self.reading = reading
        self.definitions = definitions
        self.partsOfSpeech = partsOfSpeech
        self.jlptLevel = jlptLevel
        self.isCommon = isCommon
    }
}

/// Represents a saved vocabulary item
struct VocabularyItem: Identifiable, Codable {
    let id: UUID
    let word: String
    let reading: String
    let meaning: String
    let jlptLevel: String?
    let sourceStoryId: String?
    let dateAdded: Date

    init(
        id: UUID = UUID(),
        word: String,
        reading: String,
        meaning: String,
        jlptLevel: String? = nil,
        sourceStoryId: String? = nil,
        dateAdded: Date = Date()
    ) {
        self.id = id
        self.word = word
        self.reading = reading
        self.meaning = meaning
        self.jlptLevel = jlptLevel
        self.sourceStoryId = sourceStoryId
        self.dateAdded = dateAdded
    }

    /// Create from a WordDefinition
    static func from(_ definition: WordDefinition, sourceStoryId: String? = nil) -> VocabularyItem {
        VocabularyItem(
            word: definition.word,
            reading: definition.reading,
            meaning: definition.definitions.joined(separator: "; "),
            jlptLevel: definition.jlptLevel,
            sourceStoryId: sourceStoryId
        )
    }
}
