"""
Story generation service using OpenAI GPT-4
Generates Japanese graded reader stories with appropriate vocabulary for JLPT levels.
"""
import os
import json
import logging
from typing import Optional
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)


class StoryGenerator:
    """Generates Japanese stories using GPT-4"""

    def __init__(self):
        self.client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.model = "gpt-4o"

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

        # Build the prompt
        prompt = self._build_story_prompt(
            jlpt_level, genre, theme, num_chapters, words_per_chapter
        )

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self._get_system_prompt(jlpt_level)},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.8,
                response_format={"type": "json_object"}
            )

            story_json = json.loads(response.choices[0].message.content)
            return self._format_story(story_json, jlpt_level, genre)

        except Exception as e:
            logger.error(f"Story generation failed: {e}")
            raise

    def _get_system_prompt(self, jlpt_level: str) -> str:
        """Get system prompt with JLPT level guidelines"""
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

        return f"""You are a Japanese language educator creating graded reader stories.
Your task is to write engaging stories appropriate for {jlpt_level} learners.

JLPT {jlpt_level} Guidelines:
{guidelines}

IMPORTANT RULES:
1. Write ONLY in Japanese (no English translations in the story text)
2. Use natural, conversational Japanese appropriate for the level
3. Include dialogue when appropriate
4. Create relatable characters and situations
5. Each chapter should have a clear narrative arc
6. Use repetition of key vocabulary for learning reinforcement
7. Output MUST be valid JSON

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
                "coverImageURL": None,
                "audioURL": None
            },
            "chapters": chapters
        }

    async def generate_story_idea(self, jlpt_level: str) -> dict:
        """Generate a story idea/outline without full content"""
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You generate creative story ideas for Japanese learners. Output JSON only."
                    },
                    {
                        "role": "user",
                        "content": f"""Generate 3 unique story ideas for JLPT {jlpt_level} learners.
Each idea should have:
- title (English)
- titleJapanese
- genre
- summary (2-3 sentences)
- themes (list of 2-3 themes)

Output as JSON: {{"ideas": [...]}}"""
                    }
                ],
                temperature=1.0,
                response_format={"type": "json_object"}
            )

            return json.loads(response.choices[0].message.content)

        except Exception as e:
            logger.error(f"Idea generation failed: {e}")
            raise
