"""
Story generation service using OpenRouter.
Generates Japanese graded reader stories with appropriate vocabulary and grammar for JLPT levels.
"""
import json
import logging
import random
from pathlib import Path
from typing import Optional, List

from ..openrouter_client import get_openrouter_client
from ...config.models import ModelConfig

logger = logging.getLogger(__name__)

# JLPT data directories
JLPT_DIR = Path(__file__).parent.parent.parent / "data" / "jlpt"
GRAMMAR_DIR = JLPT_DIR / "grammar"


class StoryGenerator:
    """Generates Japanese stories using OpenRouter (Gemini 3 Flash)"""

    def __init__(self):
        self.client = get_openrouter_client()
        self.model = ModelConfig.TEXT_MODEL
        self._grammar_cache = None  # Cache grammar constraints

    def _load_jlpt_vocabulary_examples(self, target_level: str, sample_size: int = 20) -> list[str]:
        """
        Load a small sample of JLPT vocabulary to illustrate the target difficulty level.
        These are examples only, not a prescriptive list.
        """
        level_file = JLPT_DIR / f"{target_level.lower()}.txt"
        if not level_file.exists():
            return []

        with open(level_file, "r", encoding="utf-8") as f:
            words = [line.strip() for line in f if line.strip()]

        # Return a small random sample as examples
        return random.sample(words, min(sample_size, len(words)))

    def _load_grammar_constraints(self, target_level: str) -> dict:
        """
        Load grammar constraints for the target JLPT level.

        Returns:
            Dict with 'allowed' and 'forbidden' grammar patterns
        """
        if self._grammar_cache is None:
            grammar_file = GRAMMAR_DIR / "grammar_constraints.json"
            if grammar_file.exists():
                try:
                    with open(grammar_file, "r", encoding="utf-8") as f:
                        self._grammar_cache = json.load(f)
                    logger.info(f"Loaded grammar constraints from {grammar_file}")
                except Exception as e:
                    logger.warning(f"Failed to load grammar constraints: {e}")
                    self._grammar_cache = {}
            else:
                logger.warning(f"Grammar constraints file not found: {grammar_file}")
                self._grammar_cache = {}

        return self._grammar_cache.get(target_level.upper(), {"allowed": [], "forbidden": []})

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
                    example = f" (e.g., {item['example']})" if item.get('example') else ""
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
        self,
        story: dict,
        problematic_words: List[str],
        jlpt_level: str
    ) -> dict:
        """
        Rewrite specific sentences containing problematic vocabulary.
        More focused than regenerating the whole story.

        Args:
            story: The story dict with chapters and segments
            problematic_words: List of words to replace
            jlpt_level: Target JLPT level

        Returns:
            Story with simplified sentences
        """
        if not problematic_words:
            return story

        logger.info(f"Simplifying sentences with {len(problematic_words)} problematic words...")

        # Find segments containing problematic words
        segments_to_fix = []
        for chapter in story.get("chapters", []):
            for segment in chapter.get("content", []):
                text = segment.get("text", "")
                if any(word in text for word in problematic_words):
                    segments_to_fix.append({
                        "segment_id": segment.get("id", ""),
                        "text": text
                    })

        if not segments_to_fix:
            logger.info("No segments found with problematic words")
            return story

        logger.info(f"Found {len(segments_to_fix)} segments to simplify")

        # Load grammar constraints for context
        grammar_constraints = self._load_grammar_constraints(jlpt_level)
        grammar_section = self._format_grammar_constraints(grammar_constraints)

        prompt = f"""Rewrite these Japanese sentences for {jlpt_level} learners.

PROBLEMATIC WORDS TO REPLACE: {', '.join(problematic_words[:20])}

GRAMMAR CONSTRAINTS:
{grammar_section}

SENTENCES TO REWRITE:
{json.dumps(segments_to_fix, ensure_ascii=False, indent=2)}

For each sentence:
1. Replace the problematic words with simpler {jlpt_level}-appropriate alternatives
2. Keep the meaning and plot the same
3. Maintain natural Japanese flow
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
        jlpt_level: str,
        genre: str,
        theme: Optional[str] = None,
        num_chapters: int = 5,
        words_per_chapter: int = 100
    ) -> dict:
        """
        Generate a complete story with chapters.

        Args:
            jlpt_level: Target JLPT level (N5, N4, N3, N2, N1)
            genre: Story genre (e.g., "slice of life", "mystery", "adventure")
            theme: Optional theme or topic for the story
            num_chapters: Number of chapters to generate
            words_per_chapter: Approximate words per chapter

        Returns:
            Complete story dict with metadata, chapters, and segments
        """
        logger.info(f"Generating {jlpt_level} story: {genre}, theme={theme}")

        # Load example vocabulary to illustrate the target level
        vocab_examples = self._load_jlpt_vocabulary_examples(jlpt_level)

        # Build the prompt
        system_prompt = self._get_system_prompt(jlpt_level, vocab_examples)
        user_prompt = self._build_story_prompt(
            jlpt_level, genre, theme, num_chapters, words_per_chapter
        )

        try:
            story_json = await self.client.generate_json(
                prompt=user_prompt,
                system_prompt=system_prompt,
                temperature=0.8
            )
            return self._format_story(story_json, jlpt_level, genre)

        except Exception as e:
            logger.error(f"Story generation failed: {e}")
            raise

    async def regenerate_story(
        self,
        failed_story: dict,
        validation_result: dict,
        jlpt_level: str,
        genre: str,
        theme: Optional[str] = None,
        num_chapters: int = 5,
        words_per_chapter: int = 100,
        attempt: int = 1
    ) -> dict:
        """
        Regenerate a story with feedback from vocabulary validation.

        Args:
            failed_story: The story that failed validation
            validation_result: The validation result with feedback
            jlpt_level: Target JLPT level
            genre: Story genre
            theme: Optional theme
            num_chapters: Number of chapters
            words_per_chapter: Words per chapter
            attempt: Current attempt number (for logging)

        Returns:
            Regenerated story dict
        """
        logger.info(f"Regenerating story (attempt {attempt}) with vocabulary feedback...")

        # Load example vocabulary to illustrate the target level
        vocab_examples = self._load_jlpt_vocabulary_examples(jlpt_level)

        # Build feedback prompt
        feedback_parts = []

        if not validation_result.get("hasLearningValue", True):
            target_count = validation_result.get("targetLevelCount", 0)
            min_threshold = validation_result.get("minTargetThreshold", 0)
            feedback_parts.append(
                f"- The story needs MORE {jlpt_level} vocabulary. "
                f"Found only {target_count} unique {jlpt_level} words (need at least {min_threshold})."
            )

        if not validation_result.get("notTooHard", True):
            above_count = validation_result.get("aboveLevelCount", 0)
            max_threshold = validation_result.get("maxAboveThreshold", 0)
            above_words = validation_result.get("aboveLevelWords", [])[:15]
            feedback_parts.append(
                f"- The story uses TOO MANY advanced words ({above_count} above {jlpt_level}, max {max_threshold}).\n"
                f"  Avoid or simplify these words: {', '.join(above_words)}"
            )

        if not validation_result.get("notTooObscure", True):
            unknown_count = validation_result.get("unknownCount", 0)
            unknown_words = validation_result.get("unknownWords", [])[:15]
            feedback_parts.append(
                f"- The story uses too many rare/literary words ({unknown_count} unknown).\n"
                f"  Avoid these uncommon words: {', '.join(unknown_words)}"
            )

        feedback_prompt = "\n".join(feedback_parts) if feedback_parts else "Please use more standard JLPT vocabulary."

        # Build system prompt with vocabulary examples
        system_prompt = self._get_system_prompt(jlpt_level, vocab_examples)
        user_prompt = self._build_regeneration_prompt(
            jlpt_level, genre, theme, num_chapters, words_per_chapter, feedback_prompt
        )

        try:
            story_json = await self.client.generate_json(
                prompt=user_prompt,
                system_prompt=system_prompt,
                temperature=0.7  # Slightly lower for more focused output
            )
            result = self._format_story(story_json, jlpt_level, genre)
            result["metadata"]["regenerationAttempt"] = attempt
            return result

        except Exception as e:
            logger.error(f"Story regeneration failed: {e}")
            raise

    def _build_regeneration_prompt(
        self,
        jlpt_level: str,
        genre: str,
        theme: Optional[str],
        num_chapters: int,
        words_per_chapter: int,
        feedback: str
    ) -> str:
        """Build prompt for regeneration with vocabulary feedback and grammar reminders"""
        theme_text = f" about {theme}" if theme else ""

        # Include grammar constraints in regeneration prompt
        grammar_constraints = self._load_grammar_constraints(jlpt_level)
        grammar_section = self._format_grammar_constraints(grammar_constraints)

        return f"""The previous story had vocabulary issues that need to be fixed:

{feedback}

Please create a NEW {genre} story{theme_text} for Japanese learners at JLPT {jlpt_level} level.

IMPORTANT VOCABULARY REQUIREMENTS:
- Use MOSTLY words from the {jlpt_level} level vocabulary list provided above
- Avoid complex or literary vocabulary not commonly used in everyday Japanese
- Prefer simple, common expressions over sophisticated alternatives
- If you must use an advanced word, consider if a simpler synonym exists

GRAMMAR REMINDERS FOR {jlpt_level}:
{grammar_section}

Requirements:
- {num_chapters} chapters
- Approximately {words_per_chapter} Japanese characters per chapter
- Engaging plot with character development
- Natural dialogue between characters
- Cultural authenticity
- STRICTLY follow grammar constraints above

Generate the complete story now as a JSON object."""

    def _get_system_prompt(self, jlpt_level: str, vocabulary: list[str] = None) -> str:
        """Get system prompt with JLPT level guidelines, vocabulary, and grammar constraints"""
        level_guidelines = {
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
"""
        }

        guidelines = level_guidelines.get(jlpt_level.upper(), level_guidelines["N5"])

        # Build vocabulary guidance section
        vocab_section = ""
        if vocabulary:
            vocab_list = ", ".join(vocabulary[:20])
            vocab_section = f"""
VOCABULARY DIFFICULTY GUIDANCE:
Here are some example {jlpt_level} words to illustrate the target difficulty level:
{vocab_list}

These examples show the complexity of vocabulary appropriate for {jlpt_level}. You are NOT limited to these specific words - use any vocabulary at this difficulty level. The goal is to write at {jlpt_level} difficulty, using words that {jlpt_level} learners would know or be learning.
"""

        # Build grammar constraints section
        grammar_constraints = self._load_grammar_constraints(jlpt_level)
        grammar_section = self._format_grammar_constraints(grammar_constraints)

        return f"""You are a Japanese language educator creating graded reader stories.
Your task is to write engaging stories appropriate for {jlpt_level} learners.

JLPT {jlpt_level} Guidelines:
{guidelines}
{vocab_section}
GRAMMAR CONSTRAINTS FOR {jlpt_level}:
{grammar_section}

CRITICAL: You MUST follow the grammar constraints above. Using forbidden grammar patterns will make the story too difficult for learners at this level.

IMPORTANT RULES:
1. Write ONLY in Japanese (no English translations in the story text)
2. Use natural, conversational Japanese appropriate for the level
3. STRICTLY avoid forbidden grammar patterns listed above
4. Include dialogue when appropriate
5. Create relatable characters and situations
6. Each chapter should have a clear narrative arc
7. Use repetition of key vocabulary for learning reinforcement
8. Output MUST be valid JSON

Your response must be a JSON object with this exact structure:
{{
  "title": "English title",
  "titleJapanese": "日本語タイトル",
  "summary": "English summary (2-3 sentences)",
  "summaryJapanese": "日本語の要約",
  "chapters": [
    {{
      "title": "Chapter title in English",
      "titleJapanese": "章のタイトル",
      "content": [
        {{
          "type": "narration|dialogue|thought",
          "speaker": "Character name (for dialogue only)",
          "text": "Japanese text content"
        }}
      ]
    }}
  ]
}}"""

    def _build_story_prompt(
        self,
        jlpt_level: str,
        genre: str,
        theme: Optional[str],
        num_chapters: int,
        words_per_chapter: int
    ) -> str:
        """Build the user prompt for story generation"""
        theme_text = f" about {theme}" if theme else ""

        return f"""Create a {genre} story{theme_text} for Japanese learners at JLPT {jlpt_level} level.

Requirements:
- {num_chapters} chapters
- Approximately {words_per_chapter} Japanese characters per chapter
- Engaging plot with character development
- Natural dialogue between characters
- Cultural authenticity

Generate the complete story now as a JSON object."""

    def _format_story(self, raw_story: dict, jlpt_level: str, genre: str) -> dict:
        """Format the generated story into the app's expected structure"""
        import uuid
        from datetime import datetime

        story_id = f"{jlpt_level.lower()}_{raw_story.get('title', 'story').lower().replace(' ', '_')}_{uuid.uuid4().hex[:6]}"

        chapters = []
        for i, chapter in enumerate(raw_story.get("chapters", [])):
            segments = []
            for j, content in enumerate(chapter.get("content", [])):
                segment = {
                    "id": f"{story_id}_ch{i+1}_seg{j+1}",
                    "type": content.get("type", "narration"),
                    "text": content.get("text", "")
                }
                if content.get("speaker"):
                    segment["speaker"] = content["speaker"]
                segments.append(segment)

            chapters.append({
                "id": f"{story_id}_ch{i+1}",
                "number": i + 1,
                "title": chapter.get("title", f"Chapter {i+1}"),
                "titleJapanese": chapter.get("titleJapanese"),
                "content": segments
            })

        # Calculate word count (Japanese characters)
        total_chars = sum(
            len(seg.get("text", ""))
            for ch in chapters
            for seg in ch.get("content", [])
        )

        return {
            "id": story_id,
            "metadata": {
                "title": raw_story.get("title", "Untitled"),
                "titleJapanese": raw_story.get("titleJapanese"),
                "jlptLevel": jlpt_level.upper(),
                "wordCount": total_chars,
                "genre": genre,
                "summary": raw_story.get("summary", ""),
                "summaryJapanese": raw_story.get("summaryJapanese"),
                "createdDate": datetime.utcnow().isoformat() + "Z",
                "generationModel": self.model,
                "coverImageURL": None,
                "audioURL": None
            },
            "chapters": chapters
        }

    async def refine_user_prompt(
        self,
        user_prompt: str,
        jlpt_level: str,
        genre: Optional[str] = None
    ) -> dict:
        """
        Refine and expand a user's story prompt into detailed story parameters.

        Args:
            user_prompt: The user's raw story idea/prompt
            jlpt_level: Target JLPT level
            genre: Optional genre hint

        Returns:
            Dict with refined theme, suggested genre, and story parameters
        """
        logger.info(f"Refining user prompt for {jlpt_level}...")

        system_prompt = "You analyze story ideas and refine them for Japanese language learners. Always output valid JSON."

        prompt = f"""Analyze and refine this story idea for a Japanese graded reader at {jlpt_level} level.

User's idea: "{user_prompt}"
{f"Suggested genre: {genre}" if genre else ""}

Consider:
1. Is the topic appropriate for {jlpt_level} vocabulary and grammar?
2. Can this be written with mostly {jlpt_level}-level Japanese?
3. Is the setting/scenario relatable for language learners?

Output a JSON object with:
{{
  "refined_theme": "A more detailed, specific story theme based on the user's idea",
  "genre": "Best genre for this story (slice of life, mystery, adventure, romance, comedy, fantasy, school life, workplace, travel, food, sports, family, friendship)",
  "suggested_title": "A suggested English title",
  "suggested_title_japanese": "日本語のタイトル",
  "setting": "Suggested setting for the story",
  "main_character": "Brief description of the main character",
  "num_chapters": 5,
  "words_per_chapter": {150 if jlpt_level.upper() in ["N5", "N4"] else 200},
  "vocabulary_focus": ["list", "of", "3-5", "vocabulary", "themes"],
  "level_appropriate": true,
  "adjustments_made": "Brief note on any adjustments made to fit the level"
}}"""

        try:
            result = await self.client.generate_json(
                prompt=prompt,
                system_prompt=system_prompt,
                temperature=0.7
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
                "words_per_chapter": 150 if jlpt_level.upper() in ["N5", "N4"] else 200,
                "level_appropriate": True,
                "adjustments_made": "Using original prompt"
            }

    async def generate_from_user_prompt(
        self,
        user_prompt: str,
        jlpt_level: str,
        genre: Optional[str] = None,
        refine_prompt: bool = True
    ) -> dict:
        """
        Generate a story from a user's prompt, optionally refining it first.

        Args:
            user_prompt: The user's story idea
            jlpt_level: Target JLPT level
            genre: Optional genre preference
            refine_prompt: Whether to refine the prompt first

        Returns:
            Generated story dict
        """
        if refine_prompt:
            # Refine the user's prompt
            refined = await self.refine_user_prompt(user_prompt, jlpt_level, genre)
            theme = refined.get("refined_theme", user_prompt)
            story_genre = refined.get("genre", genre or "slice of life")
            num_chapters = refined.get("num_chapters", 5)
            words_per_chapter = refined.get("words_per_chapter", 150)
        else:
            theme = user_prompt
            story_genre = genre or "slice of life"
            num_chapters = 5
            words_per_chapter = 150 if jlpt_level.upper() in ["N5", "N4"] else 200

        # Generate the story with the refined parameters
        story = await self.generate_story(
            jlpt_level=jlpt_level,
            genre=story_genre,
            theme=theme,
            num_chapters=num_chapters,
            words_per_chapter=words_per_chapter
        )

        # Add refinement info to metadata
        if refine_prompt:
            story["metadata"]["promptRefinement"] = refined

        return story

    async def generate_story_idea(self, jlpt_level: str) -> dict:
        """Generate a story idea/outline without full content"""
        system_prompt = "You generate creative story ideas for Japanese learners. Always output valid JSON."

        prompt = f"""Generate 3 unique story ideas for JLPT {jlpt_level} learners.
Each idea should have:
- title (English)
- titleJapanese
- genre
- summary (2-3 sentences)
- themes (list of 2-3 themes)

Output as JSON: {{"ideas": [...]}}"""

        try:
            return await self.client.generate_json(
                prompt=prompt,
                system_prompt=system_prompt,
                temperature=1.0
            )
        except Exception as e:
            logger.error(f"Idea generation failed: {e}")
            raise
