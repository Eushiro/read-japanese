"""
Image generation service using Google Nano Banana (Gemini Image)
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
ORIGINALS_DIR = Path(__file__).parent.parent.parent / "static" / "images" / "originals"

# Nano Banana model (Gemini 2.5 Flash Image)
NANO_BANANA_MODEL = "gemini-2.5-flash-image"


class ImageGenerator:
    """Generates cover images using Google Nano Banana (Gemini Image)"""

    def __init__(self):
        api_key = os.getenv("GOOGLE_AI_API_KEY")
        if api_key:
            self.client = genai.Client(api_key=api_key)
        else:
            self.client = None
        self.model = NANO_BANANA_MODEL

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
        style: str = "anime",
        aspect_ratio: str = "3:4"
    ) -> Optional[dict]:
        """
        Generate a cover image for a story.

        Args:
            story_title: The story title
            story_summary: Brief summary of the story
            genre: Story genre
            jlpt_level: JLPT level (for style hints)
            style: Art style ("anime", "watercolor", "minimalist", "realistic")
            aspect_ratio: Image aspect ratio (default "3:4" for book covers)
                Options: "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"

        Returns:
            Dict with url, model, model_name, or None if generation failed
        """
        if not self.is_configured:
            logger.warning("Google AI API key not configured")
            return None

        logger.info(f"Generating cover for: {story_title} (aspect ratio: {aspect_ratio})")

        prompt = self._build_prompt(story_title, story_summary, genre, style)

        try:
            # Generate image using Nano Banana (Gemini Image)
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE", "TEXT"],
                    image_config=types.ImageConfig(
                        aspect_ratio=aspect_ratio
                    )
                )
            )

            # Extract image from response
            if not response.candidates or not response.candidates[0].content.parts:
                logger.error("No images generated")
                return None

            for part in response.candidates[0].content.parts:
                if hasattr(part, 'inline_data') and part.inline_data:
                    image_data = part.inline_data.data
                    # Handle both bytes and base64-encoded string
                    if isinstance(image_data, bytes):
                        image_bytes = image_data
                    else:
                        image_bytes = base64.b64decode(image_data)
                    # Save the image
                    image_path = self._save_image(image_bytes, story_title)
                    return {
                        "url": image_path,
                        "model": self.model,
                        "model_name": "Nano Banana"
                    }

            logger.error("No image data in response")
            return None

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

    def _save_image(self, image_data: bytes, title: str, max_size: int = 800, quality: int = 85) -> str:
        """Save original and optimized image bytes to file

        Args:
            image_data: Raw image bytes
            title: Title for filename
            max_size: Maximum dimension (width or height) in pixels
            quality: WebP quality (1-100)
        """
        import re
        import uuid
        import io
        from PIL import Image

        # Create safe filename from title
        safe_title = re.sub(r'[^\w\s-]', '', title.lower())
        safe_title = re.sub(r'[-\s]+', '_', safe_title)
        base_filename = f"cover_{safe_title}_{uuid.uuid4().hex[:8]}"

        # Ensure directories exist
        IMAGES_DIR.mkdir(parents=True, exist_ok=True)
        ORIGINALS_DIR.mkdir(parents=True, exist_ok=True)

        # Save original PNG
        original_path = ORIGINALS_DIR / f"{base_filename}.png"
        with open(original_path, "wb") as f:
            f.write(image_data)

        # Open and optimize the image
        img = Image.open(io.BytesIO(image_data))

        # Convert to RGB if necessary (WebP doesn't support all modes)
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')

        # Resize if larger than max_size while preserving aspect ratio
        if max(img.size) > max_size:
            img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

        # Save as optimized WebP
        optimized_path = IMAGES_DIR / f"{base_filename}.webp"
        img.save(optimized_path, 'WEBP', quality=quality, method=6)

        original_size = len(image_data)
        final_size = optimized_path.stat().st_size
        logger.info(f"Image saved: original {original_size/1024:.1f}KB -> optimized {final_size/1024:.1f}KB")

        # Return the CDN path to optimized version
        return f"/cdn/images/{base_filename}.webp"

    async def generate_chapter_image(
        self,
        chapter_title: str,
        chapter_content: str,
        story_title: str,
        genre: str,
        style: str = "anime"
    ) -> Optional[dict]:
        """
        Generate an illustration for a story chapter.

        Args:
            chapter_title: The chapter title
            chapter_content: Brief description or text of the chapter
            story_title: The overall story title
            genre: Story genre
            style: Art style

        Returns:
            Dict with url, model, model_name, or None if generation failed
        """
        if not self.is_configured:
            logger.warning("Google AI API key not configured")
            return None

        logger.info(f"Generating chapter image for: {chapter_title}")

        style_descriptions = {
            "anime": "in beautiful anime/manga art style, soft colors, detailed backgrounds",
            "watercolor": "in soft watercolor illustration style, dreamy and artistic",
            "minimalist": "in minimalist Japanese art style, clean lines, limited color palette",
            "realistic": "in realistic digital art style, cinematic lighting",
            "ghibli": "in Studio Ghibli inspired style, whimsical and detailed"
        }

        style_desc = style_descriptions.get(style, style_descriptions["anime"])

        prompt = f"""Create an illustration for a chapter in a Japanese graded reader story.

Story: "{story_title}"
Chapter: "{chapter_title}"
Genre: {genre}
Scene: {chapter_content}

Style: {style_desc}

Requirements:
- Wide landscape composition (16:9 aspect ratio)
- No text or letters in the image
- Evoke the mood and setting of this chapter
- Suitable for a Japanese language learning book
- High quality, professional illustration
- Culturally appropriate imagery for Japan"""

        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE", "TEXT"]
                )
            )

            if not response.candidates or not response.candidates[0].content.parts:
                logger.error("No images generated for chapter")
                return None

            for part in response.candidates[0].content.parts:
                if hasattr(part, 'inline_data') and part.inline_data:
                    image_data = part.inline_data.data
                    # Handle both bytes and base64-encoded string
                    if isinstance(image_data, bytes):
                        image_bytes = image_data
                    else:
                        image_bytes = base64.b64decode(image_data)
                    image_path = self._save_chapter_image(
                        image_bytes,
                        story_title,
                        chapter_title
                    )
                    return {
                        "url": image_path,
                        "model": self.model,
                        "model_name": "Nano Banana"
                    }

            logger.error("No image data in response")
            return None

        except Exception as e:
            logger.error(f"Chapter image generation failed: {e}")
            return None

    def _save_chapter_image(self, image_data: bytes, story_title: str, chapter_title: str, max_size: int = 800, quality: int = 85) -> str:
        """Save original and optimized chapter image bytes to file

        Args:
            image_data: Raw image bytes
            story_title: Story title for filename
            chapter_title: Chapter title for filename
            max_size: Maximum dimension (width or height) in pixels
            quality: WebP quality (1-100)
        """
        import re
        import uuid
        import io
        from PIL import Image

        safe_story = re.sub(r'[^\w\s-]', '', story_title.lower())
        safe_story = re.sub(r'[-\s]+', '_', safe_story)
        safe_chapter = re.sub(r'[^\w\s-]', '', chapter_title.lower())
        safe_chapter = re.sub(r'[-\s]+', '_', safe_chapter)
        base_filename = f"chapter_{safe_story}_{safe_chapter}_{uuid.uuid4().hex[:8]}"

        # Ensure directories exist
        IMAGES_DIR.mkdir(parents=True, exist_ok=True)
        ORIGINALS_DIR.mkdir(parents=True, exist_ok=True)

        # Save original PNG
        original_path = ORIGINALS_DIR / f"{base_filename}.png"
        with open(original_path, "wb") as f:
            f.write(image_data)

        # Open and optimize the image
        img = Image.open(io.BytesIO(image_data))

        # Convert to RGB if necessary (WebP doesn't support all modes)
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')

        # Resize if larger than max_size while preserving aspect ratio
        if max(img.size) > max_size:
            img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

        # Save as optimized WebP
        optimized_path = IMAGES_DIR / f"{base_filename}.webp"
        img.save(optimized_path, 'WEBP', quality=quality, method=6)

        original_size = len(image_data)
        final_size = optimized_path.stat().st_size
        logger.info(f"Chapter image saved: original {original_size/1024:.1f}KB -> optimized {final_size/1024:.1f}KB")

        return f"/cdn/images/{base_filename}.webp"

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
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE", "TEXT"]
                )
            )

            if not response.candidates or not response.candidates[0].content.parts:
                return None

            for part in response.candidates[0].content.parts:
                if hasattr(part, 'inline_data') and part.inline_data:
                    image_data = part.inline_data.data
                    # Handle both bytes and base64-encoded string
                    if isinstance(image_data, bytes):
                        image_bytes = image_data
                    else:
                        image_bytes = base64.b64decode(image_data)

                    import uuid
                    filename = f"scene_{uuid.uuid4().hex[:12]}.png"
                    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
                    filepath = IMAGES_DIR / filename

                    with open(filepath, "wb") as f:
                        f.write(image_bytes)

                    return f"/cdn/images/{filename}"

            return None

        except Exception as e:
            logger.error(f"Scene image generation failed: {e}")
            return None

