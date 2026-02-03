"""Pydantic models for Story data"""

from pydantic import BaseModel


class TokenPart(BaseModel):
    """A part of a token with optional reading"""

    text: str
    reading: str | None = None


class Token(BaseModel):
    """A tokenized word with furigana and grammar info"""

    surface: str
    parts: list[TokenPart] | None = None
    baseForm: str | None = None
    partOfSpeech: str | None = None


class AudioWord(BaseModel):
    """Word-level audio timing from Whisper alignment"""

    text: str
    start: float
    end: float
    confidence: float | None = None


class ContentSegment(BaseModel):
    """A segment of content (paragraph or dialogue)"""

    id: str
    segmentType: str
    tokens: list[Token]
    # Audio timing for sentence sync (in seconds)
    audioStartTime: float | None = None
    audioEndTime: float | None = None
    # Word-level audio timing from Whisper
    audioWords: list[AudioWord] | None = None


class Chapter(BaseModel):
    """A chapter in a story"""

    # Support both id/title and chapterNumber/chapterTitle formats
    id: str | None = None
    chapterNumber: int | None = None
    title: str | None = None
    chapterTitle: str | None = None
    chapterTitleEnglish: str | None = None
    titleJapanese: str | None = None
    titleTokens: list[Token] | None = None
    titleEnglish: str | None = None
    segments: list[ContentSegment] | None = None
    content: list[ContentSegment] | None = None  # Alias for segments
    imageURL: str | None = None
    audioURL: str | None = None  # Audio file for this chapter

    @property
    def chapter_id(self) -> str:
        """Get chapter ID from either format"""
        return self.id or f"chapter_{self.chapterNumber or 0}"

    @property
    def chapter_title(self) -> str:
        """Get chapter title from either format"""
        return self.title or self.chapterTitleEnglish or self.chapterTitle or "Untitled"

    @property
    def all_segments(self) -> list[ContentSegment]:
        """Get segments from either field"""
        return self.segments or self.content or []


class VocabularyValidation(BaseModel):
    """Result of JLPT vocabulary validation using Learning Value Score"""

    # Story metrics
    totalTokens: int  # Total token count (for threshold scaling)
    uniqueWords: int  # Unique word count
    wordsByLevel: dict = {}  # {"N5": 40, "N4": 30, ..., "unknown": 5}

    # Unique counts (what we test against thresholds)
    targetLevelCount: int  # Unique words AT target level
    aboveLevelCount: int  # Unique words ABOVE target level
    unknownCount: int  # Unique words not in any JLPT list

    # Calculated thresholds (for transparency)
    minTargetThreshold: int
    maxAboveThreshold: int  # -1 means no limit (N1)
    maxUnknownThreshold: int

    # Pass/fail checks
    hasLearningValue: bool  # target_level_count >= min_target_threshold
    notTooHard: bool  # above_level_count <= max_above_threshold
    notTooObscure: bool  # unknown_count <= max_unknown_threshold
    passed: bool  # All three checks pass

    # Informational
    readabilityScore: float  # % of tokens at or below target level
    targetLevel: str
    message: str

    # Detailed word lists for debugging/display
    targetLevelWords: list[str] = []
    aboveLevelWords: list[str] = []
    unknownWords: list[str] = []


class StoryMetadata(BaseModel):
    """Metadata for a story"""

    title: str
    titleJapanese: str | None = None
    titleTokens: list[Token] | None = None
    author: str
    tokenizerSource: str | None = None
    jlptLevel: str
    wordCount: int
    characterCount: int
    genre: str
    tags: list[str]
    summary: str
    summaryJapanese: str | None = None
    coverImageURL: str | None = None
    audioURL: str | None = None
    createdDate: str
    isPremium: bool = False  # Whether this story requires premium subscription
    vocabularyValidation: VocabularyValidation | None = None  # JLPT vocabulary validation result


class Story(BaseModel):
    """A complete story with all data"""

    id: str
    metadata: StoryMetadata
    chapters: list[Chapter] | None = None
    content: list[ContentSegment] | None = None  # For non-chapter stories
    vocabulary: list[str] | None = None
    grammarPoints: list[str] | None = None


class StoryListItem(BaseModel):
    """Summary view of a story for listing"""

    id: str
    title: str
    titleJapanese: str | None = None
    jlptLevel: str
    wordCount: int
    genre: str
    summary: str
    coverImageURL: str | None = None
    chapterCount: int
    isPremium: bool = False
