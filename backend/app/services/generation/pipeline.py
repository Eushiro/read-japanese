"""
Story generation pipeline
Orchestrates story, image, and audio generation into a single workflow.
"""
import logging
import json
from pathlib import Path
from typing import Optional
from .story_generator import StoryGenerator
from .image_generator import ImageGenerator
from .audio_generator import AudioGenerator

logger = logging.getLogger(__name__)

# Directory for storing story JSON files
STORIES_DIR = Path(__file__).parent.parent.parent / "data" / "stories"


class StoryPipeline:
    """
    Complete story generation pipeline.
    Generates story content, cover image, and audio narration.
    """

    def __init__(self):
        self.story_generator = StoryGenerator()
        self.image_generator = ImageGenerator()
        self.audio_generator = AudioGenerator()

    async def generate_complete_story(
        self,
        jlpt_level: str,
        genre: str,
        theme: Optional[str] = None,
        num_chapters: int = 5,
        words_per_chapter: int = 100,
        voice: str = "makoto",
        image_style: str = "anime",
        generate_audio: bool = True,
        generate_image: bool = True,
        tokenize: bool = True
    ) -> dict:
        """
        Generate a complete story with all assets.

        Args:
            jlpt_level: Target JLPT level (N5-N1)
            genre: Story genre
            theme: Optional theme/topic
            num_chapters: Number of chapters
            words_per_chapter: Approximate characters per chapter
            voice: TTS voice name
            image_style: Cover art style
            generate_audio: Whether to generate audio
            generate_image: Whether to generate cover image
            tokenize: Whether to tokenize the story text

        Returns:
            Complete story dict with all generated content
        """
        logger.info(f"Starting story pipeline: {jlpt_level} {genre}")

        # Step 1: Generate story content
        logger.info("Step 1/4: Generating story content...")
        story = await self.story_generator.generate_story(
            jlpt_level=jlpt_level,
            genre=genre,
            theme=theme,
            num_chapters=num_chapters,
            words_per_chapter=words_per_chapter
        )

        # Step 2: Tokenize the story
        if tokenize:
            logger.info("Step 2/4: Tokenizing story content...")
            story = await self._tokenize_story(story)
        else:
            logger.info("Step 2/4: Skipping tokenization")

        # Step 3: Generate cover image
        if generate_image:
            logger.info("Step 3/4: Generating cover image...")
            image_path = await self.image_generator.generate_cover(
                story_title=story["metadata"]["title"],
                story_summary=story["metadata"]["summary"],
                genre=genre,
                jlpt_level=jlpt_level,
                style=image_style
            )
            if image_path:
                story["metadata"]["coverImageURL"] = image_path
        else:
            logger.info("Step 3/4: Skipping image generation")

        # Step 4: Generate audio
        if generate_audio and self.audio_generator.is_configured:
            logger.info("Step 4/4: Generating audio narration...")
            audio_path = await self.audio_generator.generate_story_audio(
                story_id=story["id"],
                chapters=story["chapters"],
                voice=voice
            )
            if audio_path:
                story["metadata"]["audioURL"] = audio_path
                story["metadata"]["audioVoiceName"] = voice.capitalize()
        else:
            logger.info("Step 4/4: Skipping audio generation")

        # Save story to file
        await self._save_story(story)

        logger.info(f"Story generation complete: {story['id']}")
        return story

    async def _tokenize_story(self, story: dict) -> dict:
        """Tokenize all text segments in the story"""
        from ..tokenizer import get_tokenizer_service

        tokenizer = get_tokenizer_service()

        for chapter in story.get("chapters", []):
            # Tokenize chapter title
            if chapter.get("titleJapanese"):
                chapter["titleTokens"] = [
                    token.__dict__ if hasattr(token, '__dict__') else token
                    for token in tokenizer.tokenize_text(chapter["titleJapanese"])
                ]

            # Tokenize content segments
            for segment in chapter.get("content", []):
                if segment.get("text"):
                    tokens = tokenizer.tokenize_text(segment["text"])
                    segment["tokens"] = [
                        self._token_to_dict(token) for token in tokens
                    ]

        # Tokenize story title
        if story["metadata"].get("titleJapanese"):
            story["metadata"]["titleTokens"] = [
                self._token_to_dict(token)
                for token in tokenizer.tokenize_text(story["metadata"]["titleJapanese"])
            ]

        return story

    def _token_to_dict(self, token) -> dict:
        """Convert Token object to dictionary"""
        result = {
            "surface": token.surface,
            "baseForm": token.baseForm,
            "partOfSpeech": token.partOfSpeech
        }
        if token.parts:
            result["parts"] = [
                {"text": p.text, "reading": p.reading} if p.reading else {"text": p.text}
                for p in token.parts
            ]
        return result

    async def _save_story(self, story: dict) -> None:
        """Save story to JSON file"""
        STORIES_DIR.mkdir(parents=True, exist_ok=True)

        filename = f"{story['id']}.json"
        filepath = STORIES_DIR / filename

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(story, f, ensure_ascii=False, indent=2)

        logger.info(f"Story saved to: {filepath}")

    async def generate_ideas(self, jlpt_level: str) -> dict:
        """Generate story ideas for a given JLPT level"""
        return await self.story_generator.generate_story_idea(jlpt_level)

    @staticmethod
    def get_available_voices() -> dict:
        """Get available TTS voices"""
        return AudioGenerator.get_available_voices()

    @staticmethod
    def get_available_genres() -> list:
        """Get suggested story genres"""
        return [
            "slice of life",
            "mystery",
            "adventure",
            "romance",
            "comedy",
            "fantasy",
            "horror",
            "school life",
            "workplace",
            "travel",
            "food",
            "sports",
            "music",
            "family",
            "friendship"
        ]

    @staticmethod
    def get_available_image_styles() -> list:
        """Get available cover art styles"""
        return [
            "anime",
            "watercolor",
            "minimalist",
            "realistic",
            "ghibli"
        ]
