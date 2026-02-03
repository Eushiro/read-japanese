"""
Story generation service using OpenRouter.
Generates graded reader stories with appropriate vocabulary and grammar for JLPT/CEFR levels.
Supports Japanese, English, and French.
"""

import json
import logging
import random
from pathlib import Path
from typing import Literal

from ...config.models import ModelConfig
from ..openrouter_client import get_openrouter_client

logger = logging.getLogger(__name__)

# Data directories
DATA_DIR = Path(__file__).parent.parent.parent / "data"
JLPT_DIR = DATA_DIR / "jlpt"
CEFR_DIR = DATA_DIR / "cefr"
GRAMMAR_DIR = JLPT_DIR / "grammar"

# Language type
Language = Literal["japanese", "english", "french"]

# Level mapping for each language
LEVEL_SYSTEMS = {
    "japanese": ["N5", "N4", "N3", "N2", "N1"],
    "english": ["A1", "A2", "B1", "B2", "C1", "C2"],
    "french": ["A1", "A2", "B1", "B2", "C1", "C2"],
}


class StoryGenerator:
    """Generates graded reader stories using OpenRouter (Gemini 3 Flash)"""

    def __init__(self):
        self.client = get_openrouter_client()
        self.model = ModelConfig.TEXT_MODEL
        self._grammar_cache: dict[str, dict] = {}  # Cache grammar constraints by language

    def _load_vocabulary_examples(
        self, language: Language, target_level: str, sample_size: int = 20
    ) -> list[str]:
        """
        Load a small sample of vocabulary to illustrate the target difficulty level.
        These are examples only, not a prescriptive list.

        Args:
            language: Target language (japanese, english, french)
            target_level: JLPT level (N5-N1) for Japanese or CEFR (A1-C2) for others
            sample_size: Number of example words to return
        """
        if language == "japanese":
            level_file = JLPT_DIR / f"{target_level.lower()}.txt"
        else:
            level_file = CEFR_DIR / language / f"{target_level.lower()}.txt"

        if not level_file.exists():
            logger.warning(f"Vocabulary file not found: {level_file}")
            return []

        with open(level_file, encoding="utf-8") as f:
            words = [line.strip() for line in f if line.strip()]

        # Return a small random sample as examples
        return random.sample(words, min(sample_size, len(words)))

    # Backwards compatibility alias
    def _load_jlpt_vocabulary_examples(self, target_level: str, sample_size: int = 20) -> list[str]:
        """Deprecated: Use _load_vocabulary_examples instead"""
        return self._load_vocabulary_examples("japanese", target_level, sample_size)

    def _get_grammar_file_path(self, language: Language) -> Path:
        """Get the path to grammar constraints file for a language."""
        if language == "japanese":
            return JLPT_DIR / "grammar" / "grammar_constraints.json"
        else:
            return CEFR_DIR / "grammar" / f"{language}_grammar_constraints.json"

    def _load_grammar_constraints(self, target_level: str, language: Language = "japanese") -> dict:
        """
        Load grammar constraints for the target level and language.

        Args:
            target_level: JLPT level (N5-N1) or CEFR level (A1-C2)
            language: Target language (japanese, english, french)

        Returns:
            Dict with 'allowed' and 'forbidden' grammar patterns
        """
        cache_key = f"{language}_{target_level.upper()}"

        # Check if already cached
        if cache_key in self._grammar_cache:
            return self._grammar_cache[cache_key]

        # Load grammar file for this language
        grammar_file = self._get_grammar_file_path(language)
        if grammar_file.exists():
            try:
                with open(grammar_file, encoding="utf-8") as f:
                    all_constraints = json.load(f)
                logger.info(f"Loaded {language} grammar constraints from {grammar_file}")

                # Cache the specific level
                level_constraints = all_constraints.get(
                    target_level.upper(), {"allowed": [], "forbidden": []}
                )
                self._grammar_cache[cache_key] = level_constraints
                return level_constraints

            except Exception as e:
                logger.warning(f"Failed to load grammar constraints for {language}: {e}")
                return {"allowed": [], "forbidden": []}
        else:
            logger.warning(f"Grammar constraints file not found: {grammar_file}")
            return {"allowed": [], "forbidden": []}

    def _format_grammar_constraints(self, constraints: dict) -> str:
        """
        Format grammar constraints for inclusion in the prompt.

        Args:
            constraints: Dict with 'allowed' and 'forbidden' lists

        Returns:
            Formatted string for the prompt
        """
        lines = []

        forbidden = constraints.get("forbidden", [])
        if forbidden:
            lines.append("FORBIDDEN GRAMMAR (DO NOT USE):")
            for item in forbidden:
                if isinstance(item, dict):
                    example = f" (e.g., {item['example']})" if item.get("example") else ""
                    lines.append(f"  ✗ {item['pattern']}: {item['description']}{example}")
                elif isinstance(item, str):
                    lines.append(f"  ✗ {item}")

        allowed = constraints.get("allowed", [])
        if allowed:
            lines.append("\nALLOWED GRAMMAR (USE THESE):")
            for item in allowed:
                if isinstance(item, dict):
                    lines.append(f"  ✓ {item['pattern']}: {item['description']}")
                elif isinstance(item, str):
                    lines.append(f"  ✓ {item}")

        return "\n".join(lines)

    async def simplify_sentences(
        self, story: dict, problematic_words: list[str], level: str, language: Language = "japanese"
    ) -> dict:
        """
        Rewrite specific sentences containing problematic vocabulary.
        More focused than regenerating the whole story.

        Args:
            story: The story dict with chapters and segments
            problematic_words: List of words to replace
            level: Target level (JLPT N5-N1 or CEFR A1-C2)
            language: Target language

        Returns:
            Story with simplified sentences
        """
        if not problematic_words:
            return story

        logger.info(
            f"Simplifying {language} sentences with {len(problematic_words)} problematic words..."
        )

        # Find segments containing problematic words
        segments_to_fix = []
        for chapter in story.get("chapters", []):
            for segment in chapter.get("content", []):
                text = segment.get("text", "")
                if any(word in text for word in problematic_words):
                    segments_to_fix.append({"segment_id": segment.get("id", ""), "text": text})

        if not segments_to_fix:
            logger.info("No segments found with problematic words")
            return story

        logger.info(f"Found {len(segments_to_fix)} segments to simplify")

        # Load grammar constraints for context
        grammar_constraints = self._load_grammar_constraints(level, language)
        grammar_section = self._format_grammar_constraints(grammar_constraints)

        language_name = {"japanese": "Japanese", "english": "English", "french": "French"}[language]

        prompt = f"""Rewrite these {language_name} sentences for {level} learners.

PROBLEMATIC WORDS TO REPLACE: {", ".join(problematic_words[:20])}

GRAMMAR CONSTRAINTS:
{grammar_section}

SENTENCES TO REWRITE:
{json.dumps(segments_to_fix, ensure_ascii=False, indent=2)}

For each sentence:
1. Replace the problematic words with simpler {level}-appropriate alternatives
2. Keep the meaning and plot the same
3. Maintain natural {language_name} flow
4. Follow the grammar constraints above

Output as JSON:
{{"rewrites": [{{"segment_id": "...", "new_text": "..."}}]}}"""

        try:
            result = await self.client.generate_json(prompt, temperature=0.5)
            rewrites = {r["segment_id"]: r["new_text"] for r in result.get("rewrites", [])}

            # Apply rewrites to story
            rewrite_count = 0
            for chapter in story.get("chapters", []):
                for segment in chapter.get("content", []):
                    seg_id = segment.get("id", "")
                    if seg_id in rewrites:
                        segment["text"] = rewrites[seg_id]
                        rewrite_count += 1

            logger.info(f"Applied {rewrite_count} sentence rewrites")
            return story

        except Exception as e:
            logger.error(f"Sentence simplification failed: {e}")
            return story

    async def generate_story(
        self,
        level: str,
        genre: str,
        theme: str | None = None,
        detailed_prompt: str | None = None,
        num_chapters: int = 5,
        words_per_chapter: int = 100,
        language: Language = "japanese",
    ) -> dict:
        """
        Generate a complete story with chapters.

        Args:
            level: Target level (JLPT N5-N1 for Japanese, CEFR A1-C2 for English/French)
            genre: Story genre (e.g., "slice of life", "mystery", "adventure")
            theme: Optional theme or topic for the story
            detailed_prompt: Optional detailed prompt (overrides theme if provided)
            num_chapters: Number of chapters to generate
            words_per_chapter: Approximate words per chapter
            language: Target language (japanese, english, french)

        Returns:
            Complete story dict with metadata, chapters, and segments
        """
        logger.info(f"Generating {language} {level} story: {genre}, theme={theme}")

        # Load example vocabulary to illustrate the target level
        vocab_examples = self._load_vocabulary_examples(language, level)

        # Build the prompt
        system_prompt = self._get_system_prompt(level, vocab_examples, language)
        user_prompt = self._build_story_prompt(
            level, genre, theme, detailed_prompt, num_chapters, words_per_chapter, language
        )

        try:
            story_json = await self.client.generate_json(
                prompt=user_prompt, system_prompt=system_prompt, temperature=0.8
            )
            return self._format_story(story_json, level, genre, language)

        except Exception as e:
            logger.error(f"Story generation failed: {e}")
            raise

    async def regenerate_story(
        self,
        failed_story: dict,
        validation_result: dict,
        level: str,
        genre: str,
        theme: str | None = None,
        num_chapters: int = 5,
        words_per_chapter: int = 100,
        attempt: int = 1,
        language: Language = "japanese",
    ) -> dict:
        """
        Regenerate a story with feedback from vocabulary validation.

        Args:
            failed_story: The story that failed validation
            validation_result: The validation result with feedback
            level: Target level (JLPT or CEFR)
            genre: Story genre
            theme: Optional theme
            num_chapters: Number of chapters
            words_per_chapter: Words per chapter
            attempt: Current attempt number (for logging)
            language: Target language

        Returns:
            Regenerated story dict
        """
        logger.info(
            f"Regenerating {language} story (attempt {attempt}) with vocabulary feedback..."
        )

        # Load example vocabulary to illustrate the target level
        vocab_examples = self._load_vocabulary_examples(language, level)

        # Build feedback prompt
        feedback_parts = []

        if not validation_result.get("hasLearningValue", True):
            target_count = validation_result.get("targetLevelCount", 0)
            min_threshold = validation_result.get("minTargetThreshold", 0)
            feedback_parts.append(
                f"- The story needs MORE {level} vocabulary. "
                f"Found only {target_count} unique {level} words (need at least {min_threshold})."
            )

        if not validation_result.get("notTooHard", True):
            above_count = validation_result.get("aboveLevelCount", 0)
            max_threshold = validation_result.get("maxAboveThreshold", 0)
            above_words = validation_result.get("aboveLevelWords", [])[:15]
            feedback_parts.append(
                f"- The story uses TOO MANY advanced words ({above_count} above {level}, max {max_threshold}).\n"
                f"  Avoid or simplify these words: {', '.join(above_words)}"
            )

        if not validation_result.get("notTooObscure", True):
            unknown_count = validation_result.get("unknownCount", 0)
            unknown_words = validation_result.get("unknownWords", [])[:15]
            feedback_parts.append(
                f"- The story uses too many rare/literary words ({unknown_count} unknown).\n"
                f"  Avoid these uncommon words: {', '.join(unknown_words)}"
            )

        level_system = "JLPT" if language == "japanese" else "CEFR"
        feedback_prompt = (
            "\n".join(feedback_parts)
            if feedback_parts
            else f"Please use more standard {level_system} vocabulary."
        )

        # Build system prompt with vocabulary examples
        system_prompt = self._get_system_prompt(level, vocab_examples, language)
        user_prompt = self._build_regeneration_prompt(
            level, genre, theme, num_chapters, words_per_chapter, feedback_prompt, language
        )

        try:
            story_json = await self.client.generate_json(
                prompt=user_prompt,
                system_prompt=system_prompt,
                temperature=0.7,  # Slightly lower for more focused output
            )
            result = self._format_story(story_json, level, genre, language)
            result["metadata"]["regenerationAttempt"] = attempt
            return result

        except Exception as e:
            logger.error(f"Story regeneration failed: {e}")
            raise

    def _build_regeneration_prompt(
        self,
        level: str,
        genre: str,
        theme: str | None,
        num_chapters: int,
        words_per_chapter: int,
        feedback: str,
        language: Language = "japanese",
    ) -> str:
        """Build prompt for regeneration with vocabulary feedback and grammar reminders"""
        theme_text = f" about {theme}" if theme else ""

        # Include grammar constraints in regeneration prompt
        grammar_constraints = self._load_grammar_constraints(level, language)
        grammar_section = self._format_grammar_constraints(grammar_constraints)

        language_name = {"japanese": "Japanese", "english": "English", "french": "French"}[language]
        level_system = "JLPT" if language == "japanese" else "CEFR"
        char_or_word = "characters" if language == "japanese" else "words"

        return f"""The previous story had vocabulary issues that need to be fixed:

{feedback}

Please create a NEW {genre} story{theme_text} for {language_name} learners at {level_system} {level} level.

IMPORTANT VOCABULARY REQUIREMENTS:
- Use MOSTLY words from the {level} level vocabulary list provided above
- Avoid complex or literary vocabulary not commonly used in everyday {language_name}
- Prefer simple, common expressions over sophisticated alternatives
- If you must use an advanced word, consider if a simpler synonym exists

GRAMMAR REMINDERS FOR {level}:
{grammar_section}

Requirements:
- {num_chapters} chapters
- Approximately {words_per_chapter} {char_or_word} per chapter
- Engaging plot with character development
- Natural dialogue between characters
- Cultural authenticity
- STRICTLY follow grammar constraints above

Generate the complete story now as a JSON object."""

    def _get_system_prompt(
        self, level: str, vocabulary: list[str] = None, language: Language = "japanese"
    ) -> str:
        """Get system prompt with level guidelines, vocabulary, and grammar constraints"""

        # Language-specific level guidelines
        jlpt_guidelines = {
            "N5": """
- Use only basic vocabulary (~800 words)
- Simple sentence structures (です/ます form)
- Basic particles (は, が, を, に, で, へ, と, も)
- Present and past tense only
- Common everyday topics
- Short, simple sentences
""",
            "N4": """
- Vocabulary up to ~1,500 words
- て-form, ない-form, た-form
- Basic compound sentences
- Potential and volitional forms
- Conditionals (たら, と)
- Giving/receiving verbs
""",
            "N3": """
- Vocabulary up to ~3,750 words
- Complex sentence structures
- Passive, causative forms
- More formal/informal registers
- Idiomatic expressions
- Abstract concepts
""",
            "N2": """
- Vocabulary up to ~6,000 words
- Advanced grammar patterns
- Formal written style
- Complex conditionals
- Nuanced expressions
- Business/academic topics
""",
            "N1": """
- Full vocabulary range (~10,000+ words)
- Literary and formal expressions
- Classical grammar influences
- Sophisticated idioms
- Complex nested clauses
- Any topic or register
""",
        }

        cefr_guidelines = {
            "A1": """
- Very basic vocabulary (~500 words)
- Simple present and past tense
- Basic sentence structures (subject-verb-object)
- Common everyday phrases
- Short, simple sentences
- Familiar topics (family, shopping, daily routines)
""",
            "A2": """
- Elementary vocabulary (~1,000 words)
- Past continuous, future tense
- Comparatives and superlatives
- Basic connectors (and, but, because)
- Simple compound sentences
- Familiar situations (travel, work, hobbies)
""",
            "B1": """
- Intermediate vocabulary (~2,000 words)
- Present perfect, first conditional
- Basic passive voice
- Common phrasal verbs
- Connected discourse
- Abstract and cultural topics
""",
            "B2": """
- Upper-intermediate vocabulary (~4,000 words)
- All tenses including perfect forms
- Second and third conditionals
- Complex sentences and clauses
- Nuanced expressions
- Professional and academic topics
""",
            "C1": """
- Advanced vocabulary (~8,000 words)
- All grammar structures
- Idiomatic expressions
- Subtle nuances and implications
- Formal and informal registers
- Complex abstract concepts
""",
            "C2": """
- Full vocabulary range (~16,000+ words)
- Native-level complexity
- Literary expressions
- Stylistic devices
- Any topic or register
- Full command of grammar
""",
        }

        language_name = {"japanese": "Japanese", "english": "English", "french": "French"}[language]
        level_system = "JLPT" if language == "japanese" else "CEFR"

        if language == "japanese":
            guidelines = jlpt_guidelines.get(level.upper(), jlpt_guidelines["N5"])
        else:
            guidelines = cefr_guidelines.get(level.upper(), cefr_guidelines["A1"])

        # Build vocabulary guidance section
        vocab_section = ""
        if vocabulary:
            vocab_list = ", ".join(vocabulary[:20])
            vocab_section = f"""
VOCABULARY DIFFICULTY GUIDANCE:
Here are some example {level} words to illustrate the target difficulty level:
{vocab_list}

These examples show the complexity of vocabulary appropriate for {level}. You are NOT limited to these specific words - use any vocabulary at this difficulty level. The goal is to write at {level} difficulty, using words that {level} learners would know or be learning.
"""

        # Build grammar constraints section
        grammar_constraints = self._load_grammar_constraints(level, language)
        grammar_section = self._format_grammar_constraints(grammar_constraints)

        # Language-specific title field names
        if language == "japanese":
            native_title_field = '"titleJapanese": "日本語タイトル"'
            native_summary_field = '"summaryJapanese": "日本語の要約"'
            chapter_native_title = '"titleJapanese": "章のタイトル"'
            write_only_rule = "Write ONLY in Japanese (no English translations in the story text)"
        elif language == "french":
            native_title_field = '"titleFrench": "Titre en français"'
            native_summary_field = '"summaryFrench": "Résumé en français"'
            chapter_native_title = '"titleFrench": "Titre du chapitre"'
            write_only_rule = "Write ONLY in French (no English translations in the story text)"
        else:  # english
            native_title_field = '"titleEnglish": "English title"'
            native_summary_field = '"summaryEnglish": "English summary"'
            chapter_native_title = '"titleEnglish": "Chapter title"'
            write_only_rule = "Write the story in English"

        return f"""You are a {language_name} language educator creating graded reader stories.
Your task is to write engaging stories appropriate for {level_system} {level} learners.

{level_system} {level} Guidelines:
{guidelines}
{vocab_section}
GRAMMAR CONSTRAINTS FOR {level}:
{grammar_section}

CRITICAL: You MUST follow the grammar constraints above. Using forbidden grammar patterns will make the story too difficult for learners at this level.

IMPORTANT RULES:
1. {write_only_rule}
2. Use natural, conversational {language_name} appropriate for the level
3. STRICTLY avoid forbidden grammar patterns listed above
4. Include dialogue when appropriate
5. Create relatable characters and situations
6. Each chapter should have a clear narrative arc
7. Use repetition of key vocabulary for learning reinforcement
8. Output MUST be valid JSON

Your response must be a JSON object with this exact structure:
{{
  "title": "English title",
  {native_title_field},
  "summary": "English summary (2-3 sentences)",
  {native_summary_field},
  "chapters": [
    {{
      "title": "Chapter title in English",
      {chapter_native_title},
      "content": [
        {{
          "type": "narration|dialogue|thought",
          "speaker": "Character name (for dialogue only)",
          "text": "{language_name} text content"
        }}
      ]
    }}
  ]
}}"""

    def _build_story_prompt(
        self,
        level: str,
        genre: str,
        theme: str | None,
        detailed_prompt: str | None,
        num_chapters: int,
        words_per_chapter: int,
        language: Language = "japanese",
    ) -> str:
        """Build the user prompt for story generation"""
        language_name = {"japanese": "Japanese", "english": "English", "french": "French"}[language]
        level_system = "JLPT" if language == "japanese" else "CEFR"
        char_or_word = "characters" if language == "japanese" else "words"

        # Use detailed prompt if provided, otherwise use theme
        if detailed_prompt:
            story_description = f"""Create a story based on this detailed description:

{detailed_prompt}

Target audience: {language_name} learners at {level_system} {level} level.
Genre: {genre}"""
        else:
            theme_text = f" about {theme}" if theme else ""
            story_description = f"Create a {genre} story{theme_text} for {language_name} learners at {level_system} {level} level."

        return f"""{story_description}

Requirements:
- {num_chapters} chapters
- Approximately {words_per_chapter} {char_or_word} per chapter
- Engaging plot with character development
- Natural dialogue between characters
- Cultural authenticity

Generate the complete story now as a JSON object."""

    def _format_story(
        self, raw_story: dict, level: str, genre: str, language: Language = "japanese"
    ) -> dict:
        """Format the generated story into the app's expected structure"""
        import uuid
        from datetime import datetime

        # Create story ID with language prefix
        lang_prefix = {"japanese": "jp", "english": "en", "french": "fr"}[language]
        story_id = f"{lang_prefix}_{level.lower()}_{raw_story.get('title', 'story').lower().replace(' ', '_')}_{uuid.uuid4().hex[:6]}"

        # Get native title field based on language
        native_title_key = {
            "japanese": "titleJapanese",
            "english": "titleEnglish",
            "french": "titleFrench",
        }[language]

        native_summary_key = {
            "japanese": "summaryJapanese",
            "english": "summaryEnglish",
            "french": "summaryFrench",
        }[language]

        chapters = []
        for i, chapter in enumerate(raw_story.get("chapters", [])):
            segments = []
            for j, content in enumerate(chapter.get("content", [])):
                segment = {
                    "id": f"{story_id}_ch{i + 1}_seg{j + 1}",
                    "type": content.get("type", "narration"),
                    "text": content.get("text", ""),
                }
                if content.get("speaker"):
                    segment["speaker"] = content["speaker"]
                segments.append(segment)

            chapter_data = {
                "id": f"{story_id}_ch{i + 1}",
                "number": i + 1,
                "title": chapter.get("title", f"Chapter {i + 1}"),
                "content": segments,
            }
            # Add native title if present
            if chapter.get(native_title_key):
                chapter_data[native_title_key] = chapter[native_title_key]
            # Backwards compatibility for Japanese
            if language == "japanese" and chapter.get("titleJapanese"):
                chapter_data["titleJapanese"] = chapter["titleJapanese"]

            chapters.append(chapter_data)

        # Calculate word count
        total_chars = sum(
            len(seg.get("text", "")) for ch in chapters for seg in ch.get("content", [])
        )

        # Build metadata
        metadata = {
            "title": raw_story.get("title", "Untitled"),
            "language": language,
            "level": level.upper(),
            "wordCount": total_chars,
            "genre": genre,
            "summary": raw_story.get("summary", ""),
            "createdDate": datetime.utcnow().isoformat() + "Z",
            "generationModel": self.model,
            "coverImageURL": None,
            "audioURL": None,
        }

        # Add native title/summary
        if raw_story.get(native_title_key):
            metadata[native_title_key] = raw_story[native_title_key]
        if raw_story.get(native_summary_key):
            metadata[native_summary_key] = raw_story[native_summary_key]

        # Backwards compatibility: keep jlptLevel for Japanese
        if language == "japanese":
            metadata["jlptLevel"] = level.upper()
            if raw_story.get("titleJapanese"):
                metadata["titleJapanese"] = raw_story["titleJapanese"]
            if raw_story.get("summaryJapanese"):
                metadata["summaryJapanese"] = raw_story["summaryJapanese"]

        return {"id": story_id, "metadata": metadata, "chapters": chapters}

    async def refine_user_prompt(
        self,
        user_prompt: str,
        level: str,
        genre: str | None = None,
        language: Language = "japanese",
    ) -> dict:
        """
        Refine and expand a user's story prompt into detailed story parameters.

        Args:
            user_prompt: The user's raw story idea/prompt
            level: Target level (JLPT or CEFR)
            genre: Optional genre hint
            language: Target language

        Returns:
            Dict with refined theme, suggested genre, and story parameters
        """
        language_name = {"japanese": "Japanese", "english": "English", "french": "French"}[language]
        level_system = "JLPT" if language == "japanese" else "CEFR"

        logger.info(f"Refining user prompt for {language} {level}...")

        system_prompt = f"You analyze story ideas and refine them for {language_name} language learners. Always output valid JSON."

        # Determine beginner levels for this language
        beginner_levels = ["N5", "N4"] if language == "japanese" else ["A1", "A2"]
        words_per_chapter = 150 if level.upper() in beginner_levels else 200

        prompt = f"""Analyze and refine this story idea for a {language_name} graded reader at {level_system} {level} level.

User's idea: "{user_prompt}"
{f"Suggested genre: {genre}" if genre else ""}

Consider:
1. Is the topic appropriate for {level} vocabulary and grammar?
2. Can this be written with mostly {level}-level {language_name}?
3. Is the setting/scenario relatable for language learners?

Output a JSON object with:
{{
  "refined_theme": "A more detailed, specific story theme based on the user's idea",
  "genre": "Best genre for this story (slice of life, mystery, adventure, romance, comedy, fantasy, school life, workplace, travel, food, sports, family, friendship)",
  "suggested_title": "A suggested English title",
  "suggested_title_native": "Title in {language_name}",
  "setting": "Suggested setting for the story",
  "main_character": "Brief description of the main character",
  "num_chapters": 5,
  "words_per_chapter": {words_per_chapter},
  "vocabulary_focus": ["list", "of", "3-5", "vocabulary", "themes"],
  "level_appropriate": true,
  "adjustments_made": "Brief note on any adjustments made to fit the level"
}}"""

        try:
            result = await self.client.generate_json(
                prompt=prompt, system_prompt=system_prompt, temperature=0.7
            )
            logger.info(f"  Refined theme: {result.get('refined_theme', '')[:50]}...")
            return result

        except Exception as e:
            logger.error(f"Prompt refinement failed: {e}")
            # Return basic refinement on failure
            return {
                "refined_theme": user_prompt,
                "genre": genre or "slice of life",
                "num_chapters": 5,
                "words_per_chapter": words_per_chapter,
                "level_appropriate": True,
                "adjustments_made": "Using original prompt",
            }

    async def generate_from_user_prompt(
        self,
        user_prompt: str,
        level: str,
        genre: str | None = None,
        refine_prompt: bool = True,
        language: Language = "japanese",
    ) -> dict:
        """
        Generate a story from a user's prompt, optionally refining it first.

        Args:
            user_prompt: The user's story idea
            level: Target level (JLPT or CEFR)
            genre: Optional genre preference
            refine_prompt: Whether to refine the prompt first
            language: Target language

        Returns:
            Generated story dict
        """
        beginner_levels = ["N5", "N4"] if language == "japanese" else ["A1", "A2"]

        if refine_prompt:
            # Refine the user's prompt
            refined = await self.refine_user_prompt(user_prompt, level, genre, language)
            theme = refined.get("refined_theme", user_prompt)
            story_genre = refined.get("genre", genre or "slice of life")
            num_chapters = refined.get("num_chapters", 5)
            words_per_chapter = refined.get("words_per_chapter", 150)
        else:
            theme = user_prompt
            story_genre = genre or "slice of life"
            num_chapters = 5
            words_per_chapter = 150 if level.upper() in beginner_levels else 200

        # Generate the story with the refined parameters
        story = await self.generate_story(
            level=level,
            genre=story_genre,
            theme=theme,
            num_chapters=num_chapters,
            words_per_chapter=words_per_chapter,
            language=language,
        )

        # Add refinement info to metadata
        if refine_prompt:
            story["metadata"]["promptRefinement"] = refined

        return story

    async def generate_story_idea(self, level: str, language: Language = "japanese") -> dict:
        """Generate a story idea/outline without full content"""
        language_name = {"japanese": "Japanese", "english": "English", "french": "French"}[language]
        level_system = "JLPT" if language == "japanese" else "CEFR"

        system_prompt = f"You generate creative story ideas for {language_name} learners. Always output valid JSON."

        prompt = f"""Generate 3 unique story ideas for {level_system} {level} learners studying {language_name}.
Each idea should have:
- title (English)
- titleNative (in {language_name})
- genre
- summary (2-3 sentences)
- themes (list of 2-3 themes)

Output as JSON: {{"ideas": [...]}}"""

        try:
            return await self.client.generate_json(
                prompt=prompt, system_prompt=system_prompt, temperature=1.0
            )
        except Exception as e:
            logger.error(f"Idea generation failed: {e}")
            raise
