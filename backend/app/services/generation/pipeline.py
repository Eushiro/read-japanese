"""
Story generation pipeline
Orchestrates story, image, and audio generation into a single workflow.

All media is uploaded directly to R2 - no local files are saved.
"""
import logging
import json
from pathlib import Path
from typing import Optional
from .story_generator import StoryGenerator
from .image_generator import ImageGenerator
from .audio_generator import AudioGenerator
from .image_describer import get_image_describer
from .vocabulary_validator import get_validator
from ..storage import upload_story_json

logger = logging.getLogger(__name__)

# Optional local backup directory (if needed for debugging)
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
        self.image_describer = get_image_describer()

    async def generate_complete_story(
        self,
        jlpt_level: str,
        genre: Optional[str] = None,
        theme: Optional[str] = None,
        user_prompt: Optional[str] = None,
        refine_prompt: bool = True,
        num_chapters: int = 5,
        words_per_chapter: int = 100,
        voice: str = "makoto",
        image_style: str = "anime",
        generate_audio: bool = True,
        generate_image: bool = True,
        generate_chapter_images: bool = True,
        align_audio: bool = True,
        tokenize: bool = True,
        max_regeneration_attempts: int = 3
    ) -> dict:
        """
        Generate a complete story with all assets.

        Args:
            jlpt_level: Target JLPT level (N5-N1)
            genre: Story genre (optional if user_prompt provided)
            theme: Optional theme/topic
            user_prompt: User's story idea (will be refined if refine_prompt=True)
            refine_prompt: Whether to refine the user's prompt using AI
            num_chapters: Number of chapters
            words_per_chapter: Approximate characters per chapter
            voice: TTS voice name
            image_style: Cover art style
            generate_audio: Whether to generate audio
            generate_image: Whether to generate cover image
            generate_chapter_images: Whether to generate chapter illustrations
            align_audio: Whether to align audio with text for word-level timestamps
            tokenize: Whether to tokenize the story text
            max_regeneration_attempts: Max attempts to regenerate if vocabulary validation fails

        Returns:
            Complete story dict with all generated content
        """
        logger.info(f"Starting story pipeline: {jlpt_level} {genre or 'auto'}")

        # Step 1: Generate story content with regeneration loop
        story = await self._generate_with_validation_loop(
            jlpt_level=jlpt_level,
            genre=genre,
            theme=theme,
            user_prompt=user_prompt,
            refine_prompt=refine_prompt,
            num_chapters=num_chapters,
            words_per_chapter=words_per_chapter,
            tokenize=tokenize,
            max_attempts=max_regeneration_attempts
        )

        # Step 3: Generate image descriptions (all at once for consistency)
        image_descriptions = None
        cover_image_bytes = None

        if (generate_image or generate_chapter_images) and self.image_generator.is_configured:
            logger.info("Step 3/6: Generating image descriptions...")
            try:
                image_descriptions = await self.image_describer.describe_all_images(story)
                story["imageDescriptions"] = image_descriptions
                logger.info(f"  Generated descriptions for cover + {len(image_descriptions.get('chapters', []))} chapters")
            except Exception as e:
                logger.warning(f"  Image description generation failed: {e}, using fallback")
                image_descriptions = None
        else:
            logger.info("Step 3/6: Skipping image description generation")

        # Step 4: Generate cover image
        if generate_image and self.image_generator.is_configured:
            logger.info("Step 4/6: Generating cover image...")
            if image_descriptions:
                # Use synthesized description for consistency
                # Handle both new format (dict with description/visual_tags) and old format (string)
                cover_data = image_descriptions.get("cover", {})
                if isinstance(cover_data, dict):
                    cover_description = cover_data.get("description", story["metadata"]["summary"])
                    cover_visual_tags = cover_data.get("visual_tags")
                else:
                    cover_description = cover_data or story["metadata"]["summary"]
                    cover_visual_tags = None

                image_result = await self.image_generator.generate_from_description(
                    description=cover_description,
                    visual_tags=cover_visual_tags,
                    character_descriptions=image_descriptions.get("characterDescriptions"),
                    color_palette=image_descriptions.get("colorPalette"),
                    style=image_style,
                    aspect_ratio="4:5",
                    story_id=story["id"],
                    language="japanese",
                    chapter_num=None,  # Cover, not a chapter
                )
            else:
                # Fallback to legacy method
                image_result = await self.image_generator.generate_cover(
                    story_title=story["metadata"]["title"],
                    story_summary=story["metadata"]["summary"],
                    genre=genre,
                    jlpt_level=jlpt_level,
                    style=image_style,
                    story_id=story["id"],
                    language="japanese",
                )
            if image_result:
                story["metadata"]["coverImageURL"] = image_result["url"]
                story["metadata"]["coverImageModel"] = image_result["model"]
                story["metadata"]["coverImageModelName"] = image_result["model_name"]
                cover_image_bytes = image_result.get("image_bytes")  # Save for reference
        else:
            logger.info("Step 4/6: Skipping cover image generation (not configured or disabled)")

        # Step 5: Generate chapter images
        if generate_chapter_images and self.image_generator.is_configured:
            logger.info("Step 5/6: Generating chapter images...")
            story = await self._generate_chapter_images(
                story, genre, image_style, image_descriptions, cover_image_bytes, "japanese"
            )
        else:
            logger.info("Step 5/6: Skipping chapter image generation")

        # Step 6 & 7: Generate audio with optional alignment
        if generate_audio and self.audio_generator.is_configured:
            logger.info("Step 6/7: Generating audio narration...")
            audio_result = await self._generate_audio_with_alignment(
                story=story,
                voice=voice,
                language="japanese",
                align=align_audio,
            )
            if audio_result:
                story["metadata"]["audioURL"] = audio_result.get("audioURL")
                story["metadata"]["audioModel"] = audio_result.get("audioModel")
                story["metadata"]["audioVoice"] = audio_result.get("audioVoice")
                story["metadata"]["audioVoiceName"] = voice.capitalize()
        else:
            logger.info("Step 6/7: Skipping audio generation")

        # Save story to R2
        await self._save_story(story, "japanese")

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

    async def _validate_vocabulary(self, story: dict, jlpt_level: str) -> dict:
        """Validate story vocabulary against JLPT level"""
        logger.info(f"Validating vocabulary for {jlpt_level}...")

        # Collect all tokens from story
        all_tokens = []
        for chapter in story.get("chapters", []):
            # Include title tokens
            if chapter.get("titleTokens"):
                all_tokens.extend(chapter["titleTokens"])
            # Include content tokens
            for segment in chapter.get("content", []):
                if segment.get("tokens"):
                    all_tokens.extend(segment["tokens"])

        # Include story title tokens
        if story["metadata"].get("titleTokens"):
            all_tokens.extend(story["metadata"]["titleTokens"])

        if not all_tokens:
            logger.warning("No tokens found for validation")
            return story

        # Run validation
        validator = get_validator()
        result = validator.validate_tokens(all_tokens, jlpt_level)

        # Add validation result to story metadata
        story["metadata"]["vocabularyValidation"] = validator.to_dict(result)

        # Log result
        if result.passed:
            logger.info(f"  ✓ Vocabulary validation passed: {result.difficulty_score:.1%} appropriate")
        else:
            logger.warning(f"  ✗ Vocabulary validation failed: {result.message}")
            if result.above_level_words:
                logger.warning(f"    Above level words: {', '.join(result.above_level_words[:10])}")
            if result.below_level_words:
                logger.warning(f"    Below level words: {', '.join(result.below_level_words[:10])}")

        return story

    async def _generate_with_validation_loop(
        self,
        jlpt_level: str,
        genre: Optional[str],
        theme: Optional[str],
        user_prompt: Optional[str],
        refine_prompt: bool,
        num_chapters: int,
        words_per_chapter: int,
        tokenize: bool,
        max_attempts: int = 3
    ) -> dict:
        """
        Generate story with validation loop.
        Regenerates if vocabulary validation fails.

        Args:
            jlpt_level: Target JLPT level
            genre: Story genre (optional if user_prompt provided)
            theme: Optional theme
            user_prompt: User's story idea
            refine_prompt: Whether to refine user's prompt
            num_chapters: Number of chapters
            words_per_chapter: Words per chapter
            tokenize: Whether to tokenize
            max_attempts: Maximum generation attempts

        Returns:
            Story dict with validation passed (or best attempt if all fail)
        """
        import asyncio

        best_story = None
        best_validation = None
        refined_params = None

        for attempt in range(1, max_attempts + 1):
            logger.info(f"Step 1/6: Generating story content (attempt {attempt}/{max_attempts})...")

            if attempt == 1:
                # First attempt: use user prompt or theme
                if user_prompt:
                    # Refine user prompt if requested
                    if refine_prompt:
                        refined_params = await self.story_generator.refine_user_prompt(
                            user_prompt, jlpt_level, genre
                        )
                        story = await self.story_generator.generate_story(
                            jlpt_level=jlpt_level,
                            genre=refined_params.get("genre", genre or "slice of life"),
                            theme=refined_params.get("refined_theme", user_prompt),
                            num_chapters=refined_params.get("num_chapters", num_chapters),
                            words_per_chapter=refined_params.get("words_per_chapter", words_per_chapter)
                        )
                        story["metadata"]["promptRefinement"] = refined_params
                        story["metadata"]["originalPrompt"] = user_prompt
                    else:
                        story = await self.story_generator.generate_story(
                            jlpt_level=jlpt_level,
                            genre=genre or "slice of life",
                            theme=user_prompt,
                            num_chapters=num_chapters,
                            words_per_chapter=words_per_chapter
                        )
                        story["metadata"]["originalPrompt"] = user_prompt
                else:
                    # No user prompt, use theme/genre directly
                    story = await self.story_generator.generate_story(
                        jlpt_level=jlpt_level,
                        genre=genre or "slice of life",
                        theme=theme,
                        num_chapters=num_chapters,
                        words_per_chapter=words_per_chapter
                    )
            else:
                # Subsequent attempts: regenerate with feedback
                # Use refined parameters if available
                regen_genre = genre or "slice of life"
                regen_theme = theme
                regen_chapters = num_chapters
                regen_words = words_per_chapter

                if refined_params:
                    regen_genre = refined_params.get("genre", regen_genre)
                    regen_theme = refined_params.get("refined_theme", user_prompt or theme)
                    regen_chapters = refined_params.get("num_chapters", num_chapters)
                    regen_words = refined_params.get("words_per_chapter", words_per_chapter)
                elif user_prompt:
                    regen_theme = user_prompt

                story = await self.story_generator.regenerate_story(
                    failed_story=best_story,
                    validation_result=best_validation,
                    jlpt_level=jlpt_level,
                    genre=regen_genre,
                    theme=regen_theme,
                    num_chapters=regen_chapters,
                    words_per_chapter=regen_words,
                    attempt=attempt
                )

                # Preserve original prompt and refinement info
                if user_prompt:
                    story["metadata"]["originalPrompt"] = user_prompt
                if refined_params:
                    story["metadata"]["promptRefinement"] = refined_params

            # Tokenize
            if tokenize:
                logger.info("Step 2/6: Tokenizing story content...")
                story = await self._tokenize_story(story)

            # Validate vocabulary
            if tokenize:
                story = await self._validate_vocabulary(story, jlpt_level)
                validation = story["metadata"].get("vocabularyValidation", {})

                # Track best attempt (in case all fail)
                if best_story is None or self._is_better_validation(validation, best_validation):
                    best_story = story
                    best_validation = validation

                # Check if passed
                if validation.get("passed", False):
                    logger.info(f"  ✓ Vocabulary validation passed on attempt {attempt}")
                    story["metadata"]["generationAttempts"] = attempt
                    return story

                # After 2nd failure, try simplifier before full regeneration
                if attempt == 2:
                    logger.info("  Trying sentence simplifier before regeneration...")
                    problematic_words = (
                        validation.get("aboveLevelWords", []) +
                        validation.get("unknownWords", [])
                    )
                    if problematic_words:
                        simplified_story = await self.story_generator.simplify_sentences(
                            story, problematic_words, jlpt_level
                        )
                        # Re-tokenize the simplified story
                        simplified_story = await self._tokenize_story(simplified_story)
                        simplified_story = await self._validate_vocabulary(simplified_story, jlpt_level)
                        simplified_validation = simplified_story["metadata"].get("vocabularyValidation", {})

                        if simplified_validation.get("passed", False):
                            logger.info(f"  ✓ Simplifier fixed vocabulary issues!")
                            simplified_story["metadata"]["generationAttempts"] = attempt
                            simplified_story["metadata"]["simplifierUsed"] = True
                            return simplified_story

                        # Update best if simplifier improved things
                        if self._is_better_validation(simplified_validation, best_validation):
                            best_story = simplified_story
                            best_validation = simplified_validation
                            logger.info("  Simplifier improved validation, continuing with attempts...")
                        else:
                            logger.info("  Simplifier didn't fix all issues, continuing with regeneration...")

                # Log failure and prepare for retry
                if attempt < max_attempts:
                    logger.warning(f"  Vocabulary validation failed, regenerating...")
                    # Brief pause before retry
                    await asyncio.sleep(1)
            else:
                # No tokenization means no validation
                story["metadata"]["generationAttempts"] = 1
                return story

        # All attempts failed, return best attempt
        logger.warning(f"  All {max_attempts} attempts failed validation, using best attempt")
        best_story["metadata"]["generationAttempts"] = max_attempts
        best_story["metadata"]["validationPassedOnRetry"] = False
        return best_story

    def _is_better_validation(self, new_val: dict, old_val: dict) -> bool:
        """Compare two validations to determine which is better"""
        if old_val is None:
            return True

        # Count how many checks pass
        new_passes = sum([
            new_val.get("hasLearningValue", False),
            new_val.get("notTooHard", False),
            new_val.get("notTooObscure", False)
        ])
        old_passes = sum([
            old_val.get("hasLearningValue", False),
            old_val.get("notTooHard", False),
            old_val.get("notTooObscure", False)
        ])

        if new_passes != old_passes:
            return new_passes > old_passes

        # If same number of checks pass, prefer higher readability score
        return new_val.get("readabilityScore", 0) > old_val.get("readabilityScore", 0)

    async def _generate_audio_with_alignment(
        self,
        story: dict,
        voice: str,
        language: str,
        align: bool,
    ) -> Optional[dict]:
        """
        Generate audio, optionally align, then upload to R2.

        This keeps audio in memory for alignment before uploading,
        avoiding the need to download from R2 for alignment.
        """
        from .media import get_audio_bytes_as_mp3
        from ..storage import upload_story_audio
        from .audio_generator import select_voice, GEMINI_MODEL, NARRATION_PROMPT

        if not self.audio_generator.is_configured:
            return None

        # Select voice if not provided
        if voice is None:
            voice = select_voice()

        # Extract all text from chapters
        full_text = self.audio_generator._extract_story_text(story["chapters"])
        if not full_text:
            logger.warning("No text to generate audio for")
            return None

        logger.info(f"Generating audio for {story['id']} with voice {voice}")

        # Generate PCM audio
        pcm_data = self.audio_generator.get_pcm_audio(full_text, voice)
        if not pcm_data:
            return None

        # Align if requested (before converting to MP3)
        if align:
            logger.info("Step 7/7: Aligning audio with text...")
            story = await self._align_audio_from_pcm(story, pcm_data)
        else:
            logger.info("Step 7/7: Skipping audio alignment")

        # Convert to MP3 in memory
        mp3_bytes = get_audio_bytes_as_mp3(pcm_data, bitrate="64k")

        # Upload to R2
        url = upload_story_audio(mp3_bytes, story["id"], language)
        logger.info(f"Audio uploaded to R2: {len(mp3_bytes) / 1024:.1f}KB")

        return {
            "audioURL": url,
            "audioModel": GEMINI_MODEL,
            "audioPrompt": NARRATION_PROMPT.strip(),
            "audioVoice": voice,
        }

    async def _align_audio_from_pcm(self, story: dict, pcm_data: bytes) -> dict:
        """Align audio with text using stable-whisper, from in-memory PCM data"""
        import tempfile
        import wave

        try:
            import stable_whisper
        except ImportError:
            logger.warning("stable_whisper not installed, skipping audio alignment")
            return story

        # Create temporary WAV file for stable-whisper
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = tmp.name
            with wave.open(tmp, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)  # 16-bit
                wf.setframerate(24000)  # Gemini TTS sample rate
                wf.writeframes(pcm_data)

        try:
            logger.info("  Loading Whisper model for alignment...")
            model = stable_whisper.load_model("small")

            logger.info("  Transcribing audio for alignment...")
            result = model.transcribe(
                tmp_path,
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

        finally:
            # Clean up temp file
            import os
            os.unlink(tmp_path)

        return story

    async def _save_story(self, story: dict, language: str = "japanese") -> str:
        """
        Save story to R2 and return URL.
        Also saves a local backup for debugging.
        """
        story_json = json.dumps(story, ensure_ascii=False, indent=2)
        story_bytes = story_json.encode("utf-8")

        # Upload to R2
        try:
            url = upload_story_json(story_bytes, story["id"], language)
            logger.info(f"Story uploaded to R2: {url}")
        except Exception as e:
            logger.warning(f"R2 upload failed: {e}, saving locally only")
            url = None

        # Also save locally for debugging/backup
        STORIES_DIR.mkdir(parents=True, exist_ok=True)
        filepath = STORIES_DIR / f"{story['id']}.json"
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(story_json)
        logger.info(f"Story backed up to: {filepath}")

        return url

    async def _generate_chapter_images(
        self,
        story: dict,
        genre: str,
        style: str,
        image_descriptions: Optional[dict] = None,
        reference_image: Optional[bytes] = None,
        language: str = "japanese",
    ) -> dict:
        """Generate images for each chapter using descriptions and reference image for consistency"""
        import asyncio

        chapter_descriptions = image_descriptions.get("chapters", []) if image_descriptions else []
        character_descriptions = image_descriptions.get("characterDescriptions") if image_descriptions else None
        color_palette = image_descriptions.get("colorPalette") if image_descriptions else None

        for i, chapter in enumerate(story.get("chapters", [])):
            chapter_title = chapter.get("titleJapanese") or chapter.get("title", f"Chapter {i+1}")
            logger.info(f"  Generating image for chapter {i+1}: {chapter_title}")

            # Use pre-generated description if available
            if i < len(chapter_descriptions):
                chapter_data = chapter_descriptions[i]
                # Handle both new format (dict with description/visual_tags) and old format (string)
                if isinstance(chapter_data, dict):
                    description = chapter_data.get("description", "")
                    visual_tags = chapter_data.get("visual_tags")
                else:
                    description = chapter_data
                    visual_tags = None

                chapter_result = await self.image_generator.generate_from_description(
                    description=description,
                    visual_tags=visual_tags,
                    character_descriptions=character_descriptions,
                    color_palette=color_palette,
                    style=style,
                    aspect_ratio="16:9",
                    reference_image=reference_image,
                    story_id=story["id"],
                    language=language,
                    chapter_num=i + 1,
                )
            else:
                # Fallback to legacy method
                description = self._extract_chapter_description(chapter)
                chapter_result = await self.image_generator.generate_chapter_image(
                    chapter_title=chapter_title,
                    chapter_content=description,
                    story_title=story["metadata"]["title"],
                    genre=genre,
                    style=style,
                    aspect_ratio="16:9",
                    story_id=story["id"],
                    language=language,
                    chapter_num=i + 1,
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
