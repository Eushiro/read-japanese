import Foundation

// MARK: - Safe Array Subscript

extension Collection {
    /// Returns the element at the specified index if it is within bounds, otherwise nil.
    subscript(safe index: Index) -> Element? {
        return indices.contains(index) ? self[index] : nil
    }
}

/// Main story model containing all story data
struct Story: Identifiable, Codable, Hashable {
    let id: String
    let metadata: StoryMetadata
    let content: [StorySegment]?  // Optional - may be nil for chapter-based stories
    let chapters: [Chapter]?
    let vocabulary: [String]?
    let grammarPoints: [String]?

    /// Whether this story has chapters
    var hasChapters: Bool {
        guard let chapters = chapters else { return false }
        return !chapters.isEmpty
    }

    /// Number of chapters (1 if no chapters defined)
    var chapterCount: Int {
        chapters?.count ?? 1
    }

    /// Get all segments for a specific chapter (0-indexed)
    /// Returns all content if no chapters defined
    func segments(forChapter index: Int) -> [StorySegment] {
        guard let chapters = chapters, index < chapters.count else {
            return content ?? []
        }
        return chapters[index].segments
    }

    /// Estimated reading time in minutes based on character count
    var estimatedReadingTime: Int {
        let totalCharacters = allSegments.reduce(0) { $0 + $1.fullText.count }
        // Average reading speed: ~300 characters per minute for learners
        return max(1, totalCharacters / 300)
    }

    /// Total character count across all segments
    var totalCharacterCount: Int {
        allSegments.reduce(0) { $0 + $1.fullText.count }
    }

    /// All segments across all chapters (or direct content)
    var allSegments: [StorySegment] {
        if let chapters = chapters, !chapters.isEmpty {
            return chapters.flatMap { $0.segments }
        }
        return content ?? []
    }
}

/// A chapter within a story
struct Chapter: Identifiable, Codable, Hashable {
    let id: String
    let title: String
    let titleJapanese: String?
    let titleTokens: [Token]?  // Tokenized Japanese title with furigana
    let titleEnglish: String?
    let segments: [StorySegment]
    let imageURL: String?
    let audioURL: String?  // Audio file for this chapter

    enum CodingKeys: String, CodingKey {
        case id, title, chapterTitle
        case titleJapanese, titleTokens, titleEnglish
        case chapterTitleEnglish
        case segments, content, imageURL, audioURL
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        // Handle optional id (generate one if missing)
        if let id = try container.decodeIfPresent(String.self, forKey: .id) {
            self.id = id
        } else {
            self.id = UUID().uuidString
        }

        // Get chapterTitle (could be Japanese) and chapterTitleEnglish
        let chapterTitle = try container.decodeIfPresent(String.self, forKey: .chapterTitle)
        let chapterTitleEnglish = try container.decodeIfPresent(String.self, forKey: .chapterTitleEnglish)

        // Handle title - prefer explicit title, then chapterTitleEnglish, then chapterTitle
        if let title = try container.decodeIfPresent(String.self, forKey: .title) {
            self.title = title
        } else if let english = chapterTitleEnglish {
            self.title = english
        } else if let chapter = chapterTitle {
            self.title = chapter
        } else {
            self.title = "Untitled Chapter"
        }

        // Handle titleJapanese - prefer explicit titleJapanese, then chapterTitle (if English title exists)
        if let titleJapanese = try container.decodeIfPresent(String.self, forKey: .titleJapanese) {
            self.titleJapanese = titleJapanese
        } else if chapterTitleEnglish != nil, let chapter = chapterTitle {
            // If we have an English title, assume chapterTitle is Japanese
            self.titleJapanese = chapter
        } else {
            self.titleJapanese = nil
        }

        // Handle titleEnglish
        if let titleEnglish = try container.decodeIfPresent(String.self, forKey: .titleEnglish) {
            self.titleEnglish = titleEnglish
        } else {
            self.titleEnglish = chapterTitleEnglish
        }

        // Handle title tokens for furigana
        self.titleTokens = try container.decodeIfPresent([Token].self, forKey: .titleTokens)

        self.imageURL = try container.decodeIfPresent(String.self, forKey: .imageURL)
        self.audioURL = try container.decodeIfPresent(String.self, forKey: .audioURL)

        // Handle both "segments" and "content" as the segments array
        if let segments = try container.decodeIfPresent([StorySegment].self, forKey: .segments) {
            self.segments = segments
        } else if let content = try container.decodeIfPresent([StorySegment].self, forKey: .content) {
            self.segments = content
        } else {
            self.segments = []
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(title, forKey: .title)
        try container.encodeIfPresent(titleJapanese, forKey: .titleJapanese)
        try container.encodeIfPresent(titleTokens, forKey: .titleTokens)
        try container.encodeIfPresent(titleEnglish, forKey: .titleEnglish)
        try container.encode(segments, forKey: .segments)
        try container.encodeIfPresent(imageURL, forKey: .imageURL)
        try container.encodeIfPresent(audioURL, forKey: .audioURL)
    }

    init(id: String, title: String, titleJapanese: String?, titleTokens: [Token]? = nil, titleEnglish: String? = nil, segments: [StorySegment], imageURL: String? = nil, audioURL: String? = nil) {
        self.id = id
        self.title = title
        self.titleJapanese = titleJapanese
        self.titleTokens = titleTokens
        self.titleEnglish = titleEnglish
        self.segments = segments
        self.imageURL = imageURL
        self.audioURL = audioURL
    }

    /// Character count for this chapter
    var characterCount: Int {
        segments.reduce(0) { $0 + $1.fullText.count }
    }

    /// Estimated reading time for this chapter
    var estimatedReadingTime: Int {
        max(1, characterCount / 300)
    }
}

/// Metadata about a story (title, author, level, etc.)
struct StoryMetadata: Codable, Hashable {
    let title: String
    let titleJapanese: String?
    let titleTokens: [Token]?  // Tokenized Japanese title with furigana
    let author: String
    let tokenizerSource: String?  // "SudachiPy" for dictionary-based, nil for AI-generated
    let jlptLevel: JLPTLevel
    let wordCount: Int
    let characterCount: Int
    let genre: String
    let tags: [String]
    let summary: String
    let summaryJapanese: String?
    let coverImageURL: String?
    let audioURL: String?
    let audioVoiceId: String?
    let audioVoiceName: String?
    let createdDate: Date

    enum CodingKeys: String, CodingKey {
        case title
        case titleJapanese
        case titleTokens
        case author
        case tokenizerSource
        case jlptLevel
        case wordCount
        case characterCount
        case genre
        case tags
        case summary
        case summaryJapanese
        case coverImageURL
        case audioURL
        case audioVoiceId
        case audioVoiceName
        case createdDate
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        title = try container.decode(String.self, forKey: .title)
        titleJapanese = try container.decodeIfPresent(String.self, forKey: .titleJapanese)
        titleTokens = try container.decodeIfPresent([Token].self, forKey: .titleTokens)
        author = try container.decode(String.self, forKey: .author)
        tokenizerSource = try container.decodeIfPresent(String.self, forKey: .tokenizerSource)
        jlptLevel = try container.decode(JLPTLevel.self, forKey: .jlptLevel)
        wordCount = try container.decode(Int.self, forKey: .wordCount)
        characterCount = try container.decode(Int.self, forKey: .characterCount)
        genre = try container.decode(String.self, forKey: .genre)
        tags = try container.decode([String].self, forKey: .tags)
        summary = try container.decode(String.self, forKey: .summary)
        summaryJapanese = try container.decodeIfPresent(String.self, forKey: .summaryJapanese)
        coverImageURL = try container.decodeIfPresent(String.self, forKey: .coverImageURL)
        audioURL = try container.decodeIfPresent(String.self, forKey: .audioURL)
        audioVoiceId = try container.decodeIfPresent(String.self, forKey: .audioVoiceId)
        audioVoiceName = try container.decodeIfPresent(String.self, forKey: .audioVoiceName)

        // Handle ISO8601 date string
        let dateString = try container.decode(String.self, forKey: .createdDate)
        let formatter = ISO8601DateFormatter()
        if let date = formatter.date(from: dateString) {
            createdDate = date
        } else {
            createdDate = Date()
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(title, forKey: .title)
        try container.encodeIfPresent(titleJapanese, forKey: .titleJapanese)
        try container.encodeIfPresent(titleTokens, forKey: .titleTokens)
        try container.encode(author, forKey: .author)
        try container.encodeIfPresent(tokenizerSource, forKey: .tokenizerSource)
        try container.encode(jlptLevel, forKey: .jlptLevel)
        try container.encode(wordCount, forKey: .wordCount)
        try container.encode(characterCount, forKey: .characterCount)
        try container.encode(genre, forKey: .genre)
        try container.encode(tags, forKey: .tags)
        try container.encode(summary, forKey: .summary)
        try container.encodeIfPresent(summaryJapanese, forKey: .summaryJapanese)
        try container.encodeIfPresent(coverImageURL, forKey: .coverImageURL)
        try container.encodeIfPresent(audioURL, forKey: .audioURL)
        try container.encodeIfPresent(audioVoiceId, forKey: .audioVoiceId)
        try container.encodeIfPresent(audioVoiceName, forKey: .audioVoiceName)

        let formatter = ISO8601DateFormatter()
        try container.encode(formatter.string(from: createdDate), forKey: .createdDate)
    }

    init(
        title: String,
        titleJapanese: String?,
        titleTokens: [Token]? = nil,
        author: String,
        tokenizerSource: String? = nil,
        jlptLevel: JLPTLevel,
        wordCount: Int,
        characterCount: Int,
        genre: String,
        tags: [String],
        summary: String,
        summaryJapanese: String?,
        coverImageURL: String? = nil,
        audioURL: String? = nil,
        audioVoiceId: String? = nil,
        audioVoiceName: String? = nil,
        createdDate: Date = Date()
    ) {
        self.title = title
        self.titleJapanese = titleJapanese
        self.titleTokens = titleTokens
        self.author = author
        self.tokenizerSource = tokenizerSource
        self.jlptLevel = jlptLevel
        self.wordCount = wordCount
        self.characterCount = characterCount
        self.genre = genre
        self.tags = tags
        self.summary = summary
        self.summaryJapanese = summaryJapanese
        self.coverImageURL = coverImageURL
        self.audioURL = audioURL
        self.audioVoiceId = audioVoiceId
        self.audioVoiceName = audioVoiceName
        self.createdDate = createdDate
    }
}

/// A segment of story content (paragraph, dialogue, etc.)
struct StorySegment: Identifiable, Codable, Hashable {
    let id: String
    let segmentType: SegmentType

    // New tokenized format (preferred)
    let tokens: [Token]?

    // Legacy format (backwards compatibility)
    let text: String?
    let furigana: [FuriganaAnnotation]?

    // Audio timing for sentence sync (in seconds)
    let audioStartTime: Double?
    let audioEndTime: Double?

    enum SegmentType: String, Codable {
        case paragraph
        case dialogue
        case heading
    }

    /// Whether this segment uses the tokenized format
    var isTokenized: Bool {
        tokens != nil && !(tokens?.isEmpty ?? true)
    }

    /// Whether this segment has audio timing data
    var hasAudioTiming: Bool {
        audioStartTime != nil && audioEndTime != nil
    }

    /// Get the full text of the segment (works for both formats)
    var fullText: String {
        if let tokens = tokens, !tokens.isEmpty {
            return tokens.map { $0.surface }.joined()
        }
        return text ?? ""
    }

    /// Custom initializer for legacy format
    init(id: String, text: String, furigana: [FuriganaAnnotation]?, segmentType: SegmentType, audioStartTime: Double? = nil, audioEndTime: Double? = nil) {
        self.id = id
        self.text = text
        self.furigana = furigana
        self.segmentType = segmentType
        self.tokens = nil
        self.audioStartTime = audioStartTime
        self.audioEndTime = audioEndTime
    }

    /// Custom initializer for tokenized format
    init(id: String, tokens: [Token], segmentType: SegmentType, audioStartTime: Double? = nil, audioEndTime: Double? = nil) {
        self.id = id
        self.tokens = tokens
        self.segmentType = segmentType
        self.text = nil
        self.furigana = nil
        self.audioStartTime = audioStartTime
        self.audioEndTime = audioEndTime
    }
}

/// A token represents a single word or punctuation in the text
struct Token: Codable, Hashable, Identifiable {
    var id: String { surface + String(describing: parts) }

    /// The surface form (how it appears in text)
    let surface: String

    /// Parts of the word - allows furigana only on kanji portions
    /// e.g., "食べます" -> [{"text": "食", "reading": "た"}, {"text": "べます"}]
    let parts: [TokenPart]?

    /// The base/dictionary form of the word (nil for punctuation)
    let baseForm: String?

    /// Part of speech (noun, verb, particle, punctuation, etc.)
    let partOfSpeech: String?

    /// Whether this token is punctuation (not tappable)
    var isPunctuation: Bool {
        partOfSpeech == "punctuation" || partOfSpeech == "symbol"
    }

    /// Whether this token has any parts with furigana
    var hasFurigana: Bool {
        guard let parts = parts else { return false }
        return parts.contains { $0.reading != nil }
    }
}

/// A part of a token - either kanji with reading or plain kana
struct TokenPart: Codable, Hashable {
    /// The text of this part (e.g., "食" or "べます")
    let text: String

    /// The reading for this part (only for kanji, nil for kana)
    let reading: String?
}

/// Furigana reading annotation for kanji (legacy format)
struct FuriganaAnnotation: Codable, Hashable {
    let word: String
    let reading: String
    let rangeStart: Int
    let rangeLength: Int
}

/// Information about a tapped word for lookup and display
struct WordInfo {
    /// The word as displayed in text (e.g., "食べます")
    let surface: String
    /// The dictionary form for lookup (e.g., "食べる")
    let baseForm: String?
    /// The full reading in hiragana (derived from parts)
    let reading: String?

    /// The word to use for dictionary lookup (baseForm if available, otherwise surface)
    var lookupWord: String {
        baseForm ?? surface
    }

    /// Create from a Token
    static func from(_ token: Token) -> WordInfo {
        // Derive reading from parts if available
        let reading: String?
        if let parts = token.parts {
            // Combine readings from parts, using text for parts without reading
            reading = parts.map { $0.reading ?? $0.text }.joined()
        } else {
            reading = nil
        }
        return WordInfo(surface: token.surface, baseForm: token.baseForm, reading: reading)
    }

    /// Create from legacy format (surface only)
    static func surface(_ word: String) -> WordInfo {
        WordInfo(surface: word, baseForm: nil, reading: nil)
    }
}
