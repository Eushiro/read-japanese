"""
Image generation service using OpenAI DALL-E 3
Generates cover art for Japanese graded reader stories.
"""
import os
import logging
import httpx
from pathlib import Path
from typing import Optional
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

# Directory for storing generated images
IMAGES_DIR = Path(__file__).parent.parent.parent / "static" / "images"


class ImageGenerator:
    """Generates cover images using DALL-E 3"""

    def __init__(self):
        self.client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    async def generate_cover(
        self,
        story_title: str,
        story_summary: str,
        genre: str,
        jlpt_level: str,
        style: str = "anime"
    ) -> Optional[str]:
        """
        Generate a cover image for a story.

        Args:
            story_title: The story title
            story_summary: Brief summary of the story
            genre: Story genre
            jlpt_level: JLPT level (for style hints)
            style: Art style ("anime", "watercolor", "minimalist", "realistic")

        Returns:
            Local path to the saved image, or None if generation failed
        """
        logger.info(f"Generating cover for: {story_title}")

        prompt = self._build_prompt(story_title, story_summary, genre, style)

        try:
            response = await self.client.images.generate(
                model="dall-e-3",
                prompt=prompt,
                size="1024x1024",
                quality="standard",
                n=1
            )

            image_url = response.data[0].url

            # Download and save the image
            image_path = await self._download_image(image_url, story_title)
            return image_path

        except Exception as e:
            logger.error(f"Image generation failed: {e}")
            return None

    def _build_prompt(
        self,
        title: str,
        summary: str,
        genre: str,
        style: str
    ) -> str:
        """Build DALL-E prompt for cover generation"""
        style_descriptions = {
            "anime": "in beautiful anime/manga art style, soft colors, detailed backgrounds",
            "watercolor": "in soft watercolor illustration style, dreamy and artistic",
            "minimalist": "in minimalist Japanese art style, clean lines, limited color palette",
            "realistic": "in realistic digital art style, cinematic lighting",
            "ghibli": "in Studio Ghibli inspired style, whimsical and detailed"
        }

        style_desc = style_descriptions.get(style, style_descriptions["anime"])

        return f"""Create a book cover illustration for a Japanese graded reader story.

Title: "{title}"
Genre: {genre}
Story: {summary}

Style: {style_desc}

Requirements:
- Vertical book cover composition (portrait orientation)
- No text or letters in the image
- Evoke the mood and setting of the story
- Suitable for a Japanese language learning book
- High quality, professional illustration
- Culturally appropriate imagery"""

    async def _download_image(self, url: str, title: str) -> str:
        """Download image from URL and save locally"""
        import re
        import uuid

        # Create safe filename from title
        safe_title = re.sub(r'[^\w\s-]', '', title.lower())
        safe_title = re.sub(r'[-\s]+', '_', safe_title)
        filename = f"cover_{safe_title}_{uuid.uuid4().hex[:8]}.png"

        # Ensure images directory exists
        IMAGES_DIR.mkdir(parents=True, exist_ok=True)

        filepath = IMAGES_DIR / filename

        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            response.raise_for_status()

            with open(filepath, "wb") as f:
                f.write(response.content)

        logger.info(f"Image saved to: {filepath}")

        # Return the CDN path
        return f"/cdn/images/{filename}"

    async def generate_scene_image(
        self,
        scene_description: str,
        style: str = "anime"
    ) -> Optional[str]:
        """
        Generate an illustration for a specific scene.

        Args:
            scene_description: Description of the scene
            style: Art style

        Returns:
            Local path to the saved image
        """
        style_descriptions = {
            "anime": "anime illustration style",
            "watercolor": "soft watercolor style",
            "minimalist": "minimalist Japanese art"
        }

        style_desc = style_descriptions.get(style, "anime style")

        prompt = f"""Illustrate this scene from a Japanese story, {style_desc}:

{scene_description}

Requirements:
- No text or letters
- Horizontal landscape composition
- Detailed and expressive
- Suitable for a language learning book"""

        try:
            response = await self.client.images.generate(
                model="dall-e-3",
                prompt=prompt,
                size="1792x1024",
                quality="standard",
                n=1
            )

            image_url = response.data[0].url

            import uuid
            filename = f"scene_{uuid.uuid4().hex[:12]}.png"
            IMAGES_DIR.mkdir(parents=True, exist_ok=True)
            filepath = IMAGES_DIR / filename

            async with httpx.AsyncClient() as client:
                resp = await client.get(image_url)
                resp.raise_for_status()
                with open(filepath, "wb") as f:
                    f.write(resp.content)

            return f"/cdn/images/{filename}"

        except Exception as e:
            logger.error(f"Scene image generation failed: {e}")
            return None
