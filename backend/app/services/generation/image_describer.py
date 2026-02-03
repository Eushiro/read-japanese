"""
Image description generator for story illustrations.
Generates consistent image descriptions for all story images in one call.
"""

import json
import logging

from ..openrouter_client import get_openrouter_client

logger = logging.getLogger(__name__)


class ImageDescriber:
    """
    Generates detailed image descriptions for story illustrations.
    Processes the complete story to ensure visual consistency across all images.
    """

    def __init__(self):
        self.client = get_openrouter_client()

    async def describe_all_images(self, story: dict) -> dict:
        """
        Generate image descriptions for cover and all chapters in one call.
        This ensures visual consistency across the entire story.

        Args:
            story: Complete story dict with metadata and chapters

        Returns:
            Dict with structure:
            {
                "cover": {
                    "description": "Scene description...",
                    "visual_tags": "cinematic lighting, low angle, warm colors..."
                },
                "chapters": [
                    {"description": "Chapter 1 scene...", "visual_tags": "wide shot, afternoon sun..."},
                    ...
                ],
                "characterDescriptions": {"Name": "Visual description..."},
                "colorPalette": "Overall color mood..."
            }
        """
        logger.info("Generating image descriptions for story...")

        # Format the complete story for the model
        story_text = self._format_story_for_description(story)
        num_chapters = len(story.get("chapters", []))

        prompt = f"""You are creating image descriptions for a Japanese graded reader story.

COMPLETE STORY:
{story_text}

Generate image descriptions for this story. Each description should be 2-3 detailed sentences describing WHAT is in the scene (characters, actions, setting).

SEPARATE from the description, provide visual_tags with CINEMATIC terms: camera angle, lighting, composition, atmosphere. This helps the image generator create more cinematic illustrations.

IMPORTANT FOR VISUAL CONSISTENCY:
- Describe characters with EXACT same appearance in every image (same hair color/style, eye color, clothing, distinctive features)
- Maintain consistent color palette and atmospheric mood throughout
- Each chapter image should feel like it belongs to the same visual story
- Be specific about character positions, expressions, and actions
- Include relevant background/setting details

Output as JSON with this exact structure:
{{
  "cover": {{
    "description": "A detailed scene description for the book cover that captures the story's essence...",
    "visual_tags": "cinematic lighting, dramatic angle, warm golden hour, soft focus background, portrait composition"
  }},
  "chapters": [
    {{
      "description": "Chapter 1: A detailed scene description showing...",
      "visual_tags": "wide shot, classroom setting, afternoon sun through windows, natural lighting, depth of field"
    }},
    ... (exactly {num_chapters} chapter objects with description and visual_tags)
  ],
  "characterDescriptions": {{
    "CharacterName": "Detailed visual description: age, hair color/style, eye color, typical clothing, distinctive features..."
  }},
  "colorPalette": "Overall color mood and atmosphere for the story (e.g., 'warm earth tones with soft amber lighting' or 'cool blues and greens with misty atmosphere')"
}}

VISUAL_TAGS EXAMPLES:
- "low angle, dramatic lighting, silhouette, sunset backdrop, wide composition"
- "close-up, soft natural light, shallow depth of field, intimate mood"
- "bird's eye view, morning mist, cool blue tones, establishing shot"
- "medium shot, warm indoor lighting, cozy atmosphere, bokeh background"
- "dynamic angle, motion blur hint, energetic composition, vibrant colors" """

        try:
            result = await self.client.generate_json(prompt, temperature=0.7)
            logger.info(
                f"Generated descriptions for cover + {len(result.get('chapters', []))} chapters"
            )
            return result
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse image descriptions JSON: {e}")
            return self._get_fallback_descriptions(story)
        except Exception as e:
            logger.error(f"Failed to generate image descriptions: {e}")
            return self._get_fallback_descriptions(story)

    def _format_story_for_description(self, story: dict) -> str:
        """
        Format the complete story with clear chapter boundaries.
        Extracts text from tokens if available, otherwise uses raw text.
        """
        parts = []

        # Story metadata
        metadata = story.get("metadata", {})
        parts.append(f"Title: {metadata.get('title', 'Untitled')}")
        if metadata.get("titleJapanese"):
            parts.append(f"Japanese Title: {metadata['titleJapanese']}")
        parts.append(f"Genre: {metadata.get('genre', 'general')}")
        parts.append(f"Summary: {metadata.get('summary', '')}")
        parts.append("")

        # Chapters with content
        for i, chapter in enumerate(story.get("chapters", [])):
            title = chapter.get("titleJapanese") or chapter.get("title", f"Chapter {i + 1}")
            parts.append(f"=== CHAPTER {i + 1}: {title} ===")

            for segment in chapter.get("content", []):
                text = self._extract_segment_text(segment)
                if text.strip():
                    parts.append(text)

            parts.append("")

        return "\n".join(parts)

    def _extract_segment_text(self, segment: dict) -> str:
        """Extract text from a segment, preferring tokens if available."""
        if segment.get("tokens"):
            return "".join(t.get("surface", "") for t in segment["tokens"])
        return segment.get("text", "")

    def _get_fallback_descriptions(self, story: dict) -> dict:
        """Generate basic fallback descriptions if AI generation fails."""
        metadata = story.get("metadata", {})
        chapters = story.get("chapters", [])

        return {
            "cover": {
                "description": f"A book cover for '{metadata.get('title', 'Story')}', a {metadata.get('genre', 'Japanese')} story.",
                "visual_tags": "warm lighting, portrait composition, soft focus background",
            },
            "chapters": [
                {
                    "description": f"An illustration for chapter {i + 1}: {ch.get('title', 'Chapter')}",
                    "visual_tags": "medium shot, natural lighting, soft atmosphere",
                }
                for i, ch in enumerate(chapters)
            ],
            "characterDescriptions": {},
            "colorPalette": "warm, inviting colors",
        }


# Singleton instance
_describer: ImageDescriber | None = None


def get_image_describer() -> ImageDescriber:
    """Get or create singleton ImageDescriber."""
    global _describer
    if _describer is None:
        _describer = ImageDescriber()
    return _describer
