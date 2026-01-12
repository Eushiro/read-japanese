"""
Image generation service using Google Imagen 3
Generates cover art for Japanese graded reader stories.
"""
import os
import logging
import base64
from pathlib import Path
from typing import Optional
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

# Directory for storing generated images
IMAGES_DIR = Path(__file__).parent.parent.parent / "static" / "images"


class ImageGenerator:
    """Generates cover images using Google Imagen 3"""

    def __init__(self):
        api_key = os.getenv("GOOGLE_AI_API_KEY")
        if api_key:
            self.client = genai.Client(api_key=api_key)
        else:
            self.client = None
        self.model = "imagen-3.0-generate-002"  # Imagen 3 Fast

    @property
    def is_configured(self) -> bool:
        """Check if API is configured"""
        return self.client is not None

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
        if not self.is_configured:
            logger.warning("Google AI API key not configured")
            return None

        logger.info(f"Generating cover for: {story_title}")

        prompt = self._build_prompt(story_title, story_summary, genre, style)

        try:
            # Generate image using Imagen 3
            response = self.client.models.generate_images(
                model=self.model,
                prompt=prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=1,
                    aspect_ratio="1:1",
                    safety_filter_level="BLOCK_MEDIUM_AND_ABOVE"
                )
            )

            if not response.generated_images:
                logger.error("No images generated")
                return None

            # Get the image data
            image_data = response.generated_images[0].image.image_bytes

            # Save the image
            image_path = self._save_image(image_data, story_title)
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

    def _save_image(self, image_data: bytes, title: str) -> str:
        """Save image bytes to file"""
        import re
        import uuid

        # Create safe filename from title
        safe_title = re.sub(r'[^\w\s-]', '', title.lower())
        safe_title = re.sub(r'[-\s]+', '_', safe_title)
        filename = f"cover_{safe_title}_{uuid.uuid4().hex[:8]}.png"

        # Ensure images directory exists
        IMAGES_DIR.mkdir(parents=True, exist_ok=True)

        filepath = IMAGES_DIR / filename

        with open(filepath, "wb") as f:
            f.write(image_data)

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
        if not self.is_configured:
            return None

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
            response = self.client.models.generate_images(
                model=self.model,
                prompt=prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=1,
                    aspect_ratio="16:9",
                    safety_filter_level="BLOCK_MEDIUM_AND_ABOVE"
                )
            )

            if not response.generated_images:
                return None

            image_data = response.generated_images[0].image.image_bytes

            import uuid
            filename = f"scene_{uuid.uuid4().hex[:12]}.png"
            IMAGES_DIR.mkdir(parents=True, exist_ok=True)
            filepath = IMAGES_DIR / filename

            with open(filepath, "wb") as f:
                f.write(image_data)

            return f"/cdn/images/{filename}"

        except Exception as e:
            logger.error(f"Scene image generation failed: {e}")
            return None
