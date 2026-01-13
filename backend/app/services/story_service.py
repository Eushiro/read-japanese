"""Service for loading and managing stories"""
import json
from pathlib import Path
from typing import List, Optional
from app.models.story import Story, StoryListItem


class StoryService:
    """Service for loading stories from JSON files"""

    def __init__(self, stories_path: Path):
        self.stories_path = stories_path
        self._stories_cache: dict[str, Story] = {}
        self._load_stories()

    def _load_stories(self) -> None:
        """Load all stories from JSON files into cache"""
        if not self.stories_path.exists():
            return

        for json_file in self.stories_path.glob("*.json"):
            try:
                with open(json_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    story = Story(**data)
                    self._stories_cache[story.id] = story
            except Exception as e:
                print(f"Error loading story from {json_file}: {e}")

    def get_all_stories(self) -> List[StoryListItem]:
        """Get list of all stories (summary view)"""
        return [
            StoryListItem(
                id=story.id,
                title=story.metadata.title,
                titleJapanese=story.metadata.titleJapanese,
                jlptLevel=story.metadata.jlptLevel,
                wordCount=story.metadata.wordCount,
                genre=story.metadata.genre,
                summary=story.metadata.summary,
                coverImageURL=story.metadata.coverImageURL,
                chapterCount=len(story.chapters),
                isPremium=story.metadata.isPremium
            )
            for story in self._stories_cache.values()
        ]

    def get_story_by_id(self, story_id: str) -> Optional[Story]:
        """Get a specific story by ID"""
        return self._stories_cache.get(story_id)

    def get_stories_by_level(self, jlpt_level: str) -> List[StoryListItem]:
        """Get all stories for a specific JLPT level"""
        return [
            StoryListItem(
                id=story.id,
                title=story.metadata.title,
                titleJapanese=story.metadata.titleJapanese,
                jlptLevel=story.metadata.jlptLevel,
                wordCount=story.metadata.wordCount,
                genre=story.metadata.genre,
                summary=story.metadata.summary,
                coverImageURL=story.metadata.coverImageURL,
                chapterCount=len(story.chapters),
                isPremium=story.metadata.isPremium
            )
            for story in self._stories_cache.values()
            if story.metadata.jlptLevel.upper() == jlpt_level.upper()
        ]

    def reload_stories(self) -> None:
        """Reload all stories from disk"""
        self._stories_cache.clear()
        self._load_stories()


# Global instance
_story_service: Optional[StoryService] = None


def get_story_service() -> StoryService:
    """Get or create the story service instance"""
    global _story_service
    if _story_service is None:
        # Default path - can be configured via environment
        stories_path = Path(__file__).parent.parent / "data" / "stories"
        _story_service = StoryService(stories_path)
    return _story_service
