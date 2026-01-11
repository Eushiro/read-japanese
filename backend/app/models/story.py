"""Pydantic models for Story data"""
from typing import Optional, List
from pydantic import BaseModel


class TokenPart(BaseModel):
    """A part of a token with optional reading"""
    text: str
    reading: Optional[str] = None


class Token(BaseModel):
    """A tokenized word with furigana and grammar info"""
    surface: str
    parts: Optional[List[TokenPart]] = None
    baseForm: Optional[str] = None
    partOfSpeech: Optional[str] = None


class ContentSegment(BaseModel):
    """A segment of content (paragraph or dialogue)"""
    id: str
    segmentType: str
    tokens: List[Token]
    # Audio timing for sentence sync (in seconds)
    audioStartTime: Optional[float] = None
    audioEndTime: Optional[float] = None


class Chapter(BaseModel):
    """A chapter in a story"""
    # Support both id/title and chapterNumber/chapterTitle formats
    id: Optional[str] = None
    chapterNumber: Optional[int] = None
    title: Optional[str] = None
    chapterTitle: Optional[str] = None
    chapterTitleEnglish: Optional[str] = None
    titleJapanese: Optional[str] = None
    titleTokens: Optional[List[Token]] = None
    titleEnglish: Optional[str] = None
    segments: Optional[List[ContentSegment]] = None
    content: Optional[List[ContentSegment]] = None  # Alias for segments
    imageURL: Optional[str] = None
    audioURL: Optional[str] = None  # Audio file for this chapter

    @property
    def chapter_id(self) -> str:
        """Get chapter ID from either format"""
        return self.id or f"chapter_{self.chapterNumber or 0}"

    @property
    def chapter_title(self) -> str:
        """Get chapter title from either format"""
        return self.title or self.chapterTitleEnglish or self.chapterTitle or "Untitled"

    @property
    def all_segments(self) -> List[ContentSegment]:
        """Get segments from either field"""
        return self.segments or self.content or []


class StoryMetadata(BaseModel):
    """Metadata for a story"""
    title: str
    titleJapanese: Optional[str] = None
    titleTokens: Optional[List[Token]] = None
    author: str
    tokenizerSource: Optional[str] = None
    jlptLevel: str
    wordCount: int
    characterCount: int
    genre: str
    tags: List[str]
    summary: str
    summaryJapanese: Optional[str] = None
    coverImageURL: Optional[str] = None
    audioURL: Optional[str] = None
    createdDate: str


class Story(BaseModel):
    """A complete story with all data"""
    id: str
    metadata: StoryMetadata
    chapters: Optional[List[Chapter]] = None
    content: Optional[List[ContentSegment]] = None  # For non-chapter stories
    vocabulary: Optional[List[str]] = None
    grammarPoints: Optional[List[str]] = None


class StoryListItem(BaseModel):
    """Summary view of a story for listing"""
    id: str
    title: str
    titleJapanese: Optional[str] = None
    jlptLevel: str
    wordCount: int
    genre: str
    summary: str
    coverImageURL: Optional[str] = None
    chapterCount: int
