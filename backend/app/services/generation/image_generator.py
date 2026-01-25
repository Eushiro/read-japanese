"""
Image generation service using OpenRouter with Gemini Image model.
Generates cover art and chapter illustrations for Japanese graded reader stories.

Images are uploaded directly to R2 storage - no local files are saved.
"""
import base64
import logging
from typing import Optional

import httpx

from ...config.models import ModelConfig
from .media import get_image_bytes_as_webp
from ..storage import upload_story_cover, upload_story_chapter_image

logger = logging.getLogger(__name__)


class ImageGenerator:
    """Generates images using OpenRouter with Gemini Image model"""

    # Narrative style descriptions (Gemini prefers descriptions over keywords)
    STYLE_NARRATIVES = {
        "anime": "rendered in a beautiful anime art style with soft cel-shading, clean line work, and vibrant yet harmonious colors typical of Japanese animation",
        "watercolor": "painted in a delicate watercolor style with soft edges, translucent washes of color, and an ethereal dreamy quality",
        "minimalist": "illustrated in a minimalist Japanese art style with clean precise lines, a limited refined color palette, and elegant simplicity",
        "realistic": "depicted in a realistic digital art style with careful attention to lighting, natural proportions, and cinematic composition",
        "ghibli": "rendered in the warm, whimsical style of Studio Ghibli with rich detailed backgrounds, expressive characters, and a sense of wonder"
    }

    def __init__(self):
        self.api_key = ModelConfig.OPENROUTER_API_KEY
        self.base_url = ModelConfig.OPENROUTER_BASE_URL
        self.model = ModelConfig.IMAGE_MODEL

    @property
    def is_configured(self) -> bool:
        """Check if API is configured"""
        return bool(self.api_key)

    async def _call_openrouter_image(
        self,
        prompt: str,
        reference_image: Optional[bytes] = None
    ) -> Optional[bytes]:
        """
        Call OpenRouter API to generate an image.

        Args:
            prompt: The image generation prompt
            reference_image: Optional reference image for style consistency

        Returns:
            Image bytes or None if failed
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://read-japanese.onrender.com",
            "X-Title": "Read Japanese"
        }

        # Build messages with optional reference image
        messages = []

        if reference_image:
            # Add reference image as a user message with image
            ref_b64 = base64.b64encode(reference_image).decode()
            messages.append({
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{ref_b64}"
                        }
                    },
                    {
                        "type": "text",
                        "text": "Use this image as a style reference. Maintain the same artistic style, color palette, and character appearances."
                    }
                ]
            })

        # Add the main prompt
        messages.append({
            "role": "user",
            "content": prompt
        })

        payload = {
            "model": self.model,
            "messages": messages,
            "modalities": ["image"],  # Request image output
            "max_tokens": 4096
        }

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload
                )
                response.raise_for_status()
                result = response.json()

                # Extract image from response
                if result.get("choices") and len(result["choices"]) > 0:
                    choice = result["choices"][0]
                    message = choice.get("message", {})

                    # Check for image in content
                    content = message.get("content")
                    if isinstance(content, list):
                        for part in content:
                            if part.get("type") == "image_url":
                                image_url = part.get("image_url", {}).get("url", "")
                                if image_url.startswith("data:"):
                                    # Extract base64 data
                                    _, b64_data = image_url.split(",", 1)
                                    return base64.b64decode(b64_data)
                    elif isinstance(content, str) and content.startswith("data:"):
                        # Direct base64 image
                        _, b64_data = content.split(",", 1)
                        return base64.b64decode(b64_data)

                    # Check for image in tool calls or other formats
                    if "image" in message:
                        image_data = message["image"]
                        if isinstance(image_data, str):
                            return base64.b64decode(image_data)

                logger.error(f"No image in response: {result}")
                return None

        except httpx.HTTPStatusError as e:
            logger.error(f"OpenRouter API error: {e.response.status_code} - {e.response.text}")
            return None
        except Exception as e:
            logger.error(f"Image generation failed: {e}")
            return None

    async def generate_from_description(
        self,
        description: str,
        visual_tags: Optional[str] = None,
        character_descriptions: Optional[dict] = None,
        color_palette: Optional[str] = None,
        style: str = "anime",
        aspect_ratio: str = "16:9",
        reference_image: Optional[bytes] = None,
        story_id: Optional[str] = None,
        language: str = "japanese",
        chapter_num: Optional[int] = None,
    ) -> Optional[dict]:
        """
        Generate an image from a synthesized description with optional reference.
        Uploads directly to R2 - no local files saved.

        Args:
            description: Pre-synthesized image description from ImageDescriber
            visual_tags: Cinematic visual tags (lighting, angle, composition)
            character_descriptions: Dict of character name -> visual description
            color_palette: Color mood/palette description
            style: Art style name
            aspect_ratio: Image aspect ratio
            reference_image: Optional reference image bytes for style consistency
            story_id: Story ID for R2 path (required for R2 upload)
            language: Content language (for R2 path)
            chapter_num: Chapter number for chapter images (None for cover)

        Returns:
            Dict with url, model, model_name, image_bytes, or None if failed
        """
        if not self.is_configured:
            logger.warning("OpenRouter API key not configured")
            return None

        logger.info(f"Generating image from description (aspect ratio: {aspect_ratio})")

        # Build narrative prompt
        style_narrative = self.STYLE_NARRATIVES.get(style, self.STYLE_NARRATIVES["anime"])

        # Build character context as narrative
        char_narrative = ""
        if character_descriptions:
            char_parts = [f"{name} appears as {desc}" for name, desc in character_descriptions.items()]
            char_narrative = f"\n\nThe characters are: {'; '.join(char_parts)}."

        # Add visual tags if provided
        visual_context = ""
        if visual_tags:
            visual_context = f"\n\nVisual style: {visual_tags}"

        prompt = f"""Generate an illustration for a Japanese graded reader story.

Scene: {description}{char_narrative}{visual_context}

The overall color mood is {color_palette or 'warm and inviting'}. The image is {style_narrative}.

The composition should feel like a key moment from a storybook, with careful attention to atmosphere and emotional resonance. No text, letters, or writing should appear in the image.

Aspect ratio: {aspect_ratio}"""

        image_bytes = await self._call_openrouter_image(prompt, reference_image)

        if image_bytes:
            # Compress to WebP in memory
            webp_bytes = get_image_bytes_as_webp(image_bytes, quality=85, max_size=800)

            # Upload to R2 if story_id provided
            if story_id:
                if chapter_num is not None:
                    url = upload_story_chapter_image(webp_bytes, story_id, language, chapter_num)
                else:
                    url = upload_story_cover(webp_bytes, story_id, language)
            else:
                # Fallback: return None URL but still provide bytes
                logger.warning("No story_id provided, image not uploaded to R2")
                url = None

            return {
                "url": url,
                "model": self.model,
                "model_name": "Gemini Image (OpenRouter)",
                "image_bytes": image_bytes
            }

        return None

    async def generate_cover(
        self,
        story_title: str,
        story_summary: str,
        genre: str,
        jlpt_level: str,
        style: str = "anime",
        aspect_ratio: str = "4:5",
        story_id: Optional[str] = None,
        language: str = "japanese",
    ) -> Optional[dict]:
        """
        Generate a cover image for a story (legacy method).
        Uploads directly to R2 if story_id provided.
        """
        if not self.is_configured:
            logger.warning("OpenRouter API key not configured")
            return None

        logger.info(f"Generating cover for: {story_title} (aspect ratio: {aspect_ratio})")

        style_narrative = self.STYLE_NARRATIVES.get(style, self.STYLE_NARRATIVES["anime"])

        prompt = f"""Generate a book cover illustration for a Japanese graded reader story.

The story is called "{story_title}" and is a {genre} story. {story_summary}

The illustration is {style_narrative}. It should capture the essence and mood of the story in a single compelling image.

The composition is vertical (portrait orientation), suitable for a book cover. No text, letters, or writing should appear in the image. The illustration should be professional quality, culturally appropriate for Japan, and evocative of the story's themes.

Aspect ratio: {aspect_ratio}"""

        image_bytes = await self._call_openrouter_image(prompt)

        if image_bytes:
            # Compress to WebP in memory
            webp_bytes = get_image_bytes_as_webp(image_bytes, quality=85, max_size=800)

            # Upload to R2 if story_id provided
            if story_id:
                url = upload_story_cover(webp_bytes, story_id, language)
            else:
                logger.warning("No story_id provided, cover not uploaded to R2")
                url = None

            return {
                "url": url,
                "model": self.model,
                "model_name": "Gemini Image (OpenRouter)",
                "image_bytes": image_bytes
            }

        return None

    async def generate_chapter_image(
        self,
        chapter_title: str,
        chapter_content: str,
        story_title: str,
        genre: str,
        style: str = "anime",
        aspect_ratio: str = "16:9",
        story_id: Optional[str] = None,
        language: str = "japanese",
        chapter_num: int = 1,
    ) -> Optional[dict]:
        """
        Generate an illustration for a story chapter (legacy method).
        Uploads directly to R2 if story_id provided.
        """
        if not self.is_configured:
            logger.warning("OpenRouter API key not configured")
            return None

        logger.info(f"Generating chapter image for: {chapter_title}")

        style_narrative = self.STYLE_NARRATIVES.get(style, self.STYLE_NARRATIVES["anime"])

        prompt = f"""Generate an illustration for a chapter in a Japanese graded reader story.

The story "{story_title}" is a {genre} story. This chapter, "{chapter_title}", depicts the following scene: {chapter_content}

The illustration is {style_narrative}. It should capture a key moment from this chapter with careful attention to atmosphere and emotional resonance.

The composition is landscape (horizontal), suitable for a chapter illustration. No text, letters, or writing should appear in the image. The illustration should be professional quality and culturally appropriate for Japan.

Aspect ratio: {aspect_ratio}"""

        image_bytes = await self._call_openrouter_image(prompt)

        if image_bytes:
            # Compress to WebP in memory
            webp_bytes = get_image_bytes_as_webp(image_bytes, quality=85, max_size=800)

            # Upload to R2 if story_id provided
            if story_id:
                url = upload_story_chapter_image(webp_bytes, story_id, language, chapter_num)
            else:
                logger.warning("No story_id provided, chapter image not uploaded to R2")
                url = None

            return {
                "url": url,
                "model": self.model,
                "model_name": "Gemini Image (OpenRouter)",
                "image_bytes": image_bytes
            }

        return None

