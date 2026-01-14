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
        generate_chapter_images: bool = True,
        align_audio: bool = True,
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
            generate_chapter_images: Whether to generate chapter illustrations
            align_audio: Whether to align audio with text for word-level timestamps
            tokenize: Whether to tokenize the story text

        Returns:
            Complete story dict with all generated content
        """
        logger.info(f"Starting story pipeline: {jlpt_level} {genre}")

        # Step 1: Generate story content
        logger.info("Step 1/6: Generating story content...")
        story = await self.story_generator.generate_story(
            jlpt_level=jlpt_level,
            genre=genre,
            theme=theme,
            num_chapters=num_chapters,
            words_per_chapter=words_per_chapter
        )

        # Step 2: Tokenize the story
        if tokenize:
            logger.info("Step 2/6: Tokenizing story content...")
            story = await self._tokenize_story(story)
        else:
            logger.info("Step 2/6: Skipping tokenization")

        # Step 3: Generate cover image
        if generate_image and self.image_generator.is_configured:
            logger.info("Step 3/6: Generating cover image...")
            image_result = await self.image_generator.generate_cover(
                story_title=story["metadata"]["title"],
                story_summary=story["metadata"]["summary"],
                genre=genre,
                jlpt_level=jlpt_level,
                style=image_style
            )
            if image_result:
                story["metadata"]["coverImageURL"] = image_result["url"]
                story["metadata"]["coverImageModel"] = image_result["model"]
                story["metadata"]["coverImageModelName"] = image_result["model_name"]
        else:
            logger.info("Step 3/6: Skipping cover image generation (not configured or disabled)")

        # Step 4: Generate chapter images
        if generate_chapter_images and self.image_generator.is_configured:
            logger.info("Step 4/6: Generating chapter images...")
            story = await self._generate_chapter_images(story, genre, image_style)
        else:
            logger.info("Step 4/6: Skipping chapter image generation")

        # Step 5: Generate audio
        if generate_audio and self.audio_generator.is_configured:
            logger.info("Step 5/6: Generating audio narration...")
            audio_result = await self.audio_generator.generate_story_audio(
                story_id=story["id"],
                chapters=story["chapters"],
                voice=voice
            )
            if audio_result:
                story["metadata"]["audioURL"] = audio_result
                story["metadata"]["audioVoiceName"] = voice.capitalize()
        else:
            logger.info("Step 5/6: Skipping audio generation")

        # Step 6: Align audio with text
        if align_audio and generate_audio and story["metadata"].get("audioURL"):
            logger.info("Step 6/6: Aligning audio with text...")
            story = await self._align_audio(story)
        else:
            logger.info("Step 6/6: Skipping audio alignment")

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

    async def _generate_chapter_images(self, story: dict, genre: str, style: str) -> dict:
        """Generate images for each chapter"""
        import asyncio

        for i, chapter in enumerate(story.get("chapters", [])):
            chapter_title = chapter.get("titleJapanese") or chapter.get("title", f"Chapter {i+1}")
            logger.info(f"  Generating image for chapter {i+1}: {chapter_title}")

            # Extract description from chapter content
            description = self._extract_chapter_description(chapter)

            chapter_result = await self.image_generator.generate_chapter_image(
                chapter_title=chapter_title,
                chapter_content=description,
                story_title=story["metadata"]["title"],
                genre=genre,
                style=style,
                aspect_ratio="16:9"
            )

            if chapter_result:
                chapter["imageURL"] = chapter_result["url"]
                chapter["imageModel"] = chapter_result["model"]
                chapter["imageModelName"] = chapter_result["model_name"]
                logger.info(f"  Chapter {i+1} image: {chapter_result['url']}")
            else:
                logger.warning(f"  Failed to generate image for chapter {i+1}")

            # Brief pause between image generations
            if i < len(story["chapters"]) - 1:
                await asyncio.sleep(1)

        return story

    def _extract_chapter_description(self, chapter: dict) -> str:
        """Extract a description from chapter content for image generation"""
        if chapter.get("summary"):
            return chapter["summary"]

        texts = []
        for segment in chapter.get("content", []):
            if segment.get("text"):
                texts.append(segment["text"])
            elif segment.get("tokens"):
                text = "".join(t.get("surface", "") for t in segment["tokens"])
                texts.append(text)

        full_text = " ".join(texts)
        if len(full_text) > 200:
            return full_text[:200] + "..."
        return full_text or chapter.get("title", "")

    async def _align_audio(self, story: dict) -> dict:
        """Align audio with text using stable-whisper for word-level timestamps"""
        try:
            import stable_whisper
        except ImportError:
            logger.warning("stable_whisper not installed, skipping audio alignment")
            return story

        # Find audio file
        audio_dir = Path(__file__).parent.parent.parent / "static" / "audio"
        audio_originals_dir = audio_dir / "originals"
        story_id = story["id"]

        # Prefer WAV original for better alignment
        audio_path = audio_originals_dir / f"{story_id}.wav"
        if not audio_path.exists():
            audio_path = audio_dir / f"{story_id}.mp3"
        if not audio_path.exists():
            logger.warning(f"No audio file found for {story_id}")
            return story

        logger.info(f"  Loading Whisper model for alignment...")
        model = stable_whisper.load_model("small")

        logger.info(f"  Transcribing audio: {audio_path.name}")
        result = model.transcribe(
            str(audio_path),
            language="ja",
            word_timestamps=True,
        )

        # Collect all words with timestamps
        all_words = []
        for whisper_seg in result.segments:
            if hasattr(whisper_seg, 'words') and whisper_seg.words:
                for word in whisper_seg.words:
                    all_words.append({
                        "text": word.word.strip(),
                        "start": round(word.start, 3),
                        "end": round(word.end, 3),
                    })

        if not all_words:
            logger.warning("No words detected in audio")
            return story

        logger.info(f"  Detected {len(all_words)} words in audio")

        # Match words to story segments
        word_idx = 0
        matched_segments = 0

        for chapter in story.get("chapters", []):
            for segment in chapter.get("content", []):
                seg_text = self._get_segment_text(segment)
                if not seg_text.strip():
                    continue

                seg_start = None
                seg_end = None
                seg_words = []
                remaining_text = seg_text

                while word_idx < len(all_words) and remaining_text:
                    word = all_words[word_idx]
                    word_text = word["text"]

                    if word_text and word_text in remaining_text:
                        if seg_start is None:
                            seg_start = word["start"]
                        seg_end = word["end"]
                        seg_words.append({
                            "text": word_text,
                            "start": word["start"],
                            "end": word["end"],
                        })
                        idx = remaining_text.find(word_text)
                        remaining_text = remaining_text[idx + len(word_text):]
                        word_idx += 1
                    elif not word_text.strip():
                        word_idx += 1
                    else:
                        if len(remaining_text) < len(seg_text) * 0.3:
                            break
                        word_idx += 1

                if seg_start is not None and seg_end is not None:
                    segment["audioStartTime"] = seg_start
                    segment["audioEndTime"] = seg_end
                    segment["audioWords"] = seg_words
                    matched_segments += 1

        logger.info(f"  Aligned {matched_segments} segments with audio")
        return story

    def _get_segment_text(self, segment: dict) -> str:
        """Extract plain text from a segment"""
        if "tokens" in segment and segment["tokens"]:
            return "".join(token["surface"] for token in segment["tokens"])
        return segment.get("text", "")

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
