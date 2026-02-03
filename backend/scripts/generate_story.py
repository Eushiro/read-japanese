#!/usr/bin/env python3
"""
Generate a complete story with all assets using the story pipeline.

Generates:
- Story content (via Claude AI)
- Tokenization with furigana
- Cover image (4:5 portrait)
- Chapter images (16:9 landscape)
- Audio narration (TTS)
- Audio alignment (word-level timestamps)

Usage:
    python scripts/generate_story.py --level N5 --genre "slice of life"
    python scripts/generate_story.py --level N4 --genre adventure --theme "lost in Tokyo"
    python scripts/generate_story.py --level N3 --genre mystery --chapters 3 --style ghibli
    python scripts/generate_story.py --level N5 --genre comedy --no-audio --no-images
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load environment variables from web/.env.local (shared with frontend)
from dotenv import load_dotenv

env_path = Path(__file__).parent.parent.parent / "web" / ".env.local"
load_dotenv(env_path)

from app.services.generation.pipeline import StoryPipeline

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s", datefmt="%H:%M:%S"
)
logger = logging.getLogger(__name__)


async def generate_story(
    jlpt_level: str,
    genre: str,
    theme: str = None,
    num_chapters: int = 5,
    words_per_chapter: int = 100,
    voice: str = "makoto",
    image_style: str = "anime",
    generate_audio: bool = True,
    generate_image: bool = True,
    generate_chapter_images: bool = True,
    align_audio: bool = True,
):
    """Generate a complete story with all assets."""

    print("=" * 60)
    print("Story Generation Pipeline")
    print("=" * 60)
    print(f"JLPT Level: {jlpt_level}")
    print(f"Genre: {genre}")
    if theme:
        print(f"Theme: {theme}")
    print(f"Chapters: {num_chapters}")
    print(f"Words/Chapter: ~{words_per_chapter}")
    print(f"Image Style: {image_style}")
    print(f"Voice: {voice}")
    print()
    print("Features:")
    print(f"  Cover Image: {'Yes' if generate_image else 'No'}")
    print(f"  Chapter Images: {'Yes' if generate_chapter_images else 'No'}")
    print(f"  Audio: {'Yes' if generate_audio else 'No'}")
    print(f"  Audio Alignment: {'Yes' if align_audio and generate_audio else 'No'}")
    print("=" * 60)
    print()

    pipeline = StoryPipeline()

    # Check configuration
    if generate_image or generate_chapter_images:
        if not pipeline.image_generator.is_configured:
            print("WARNING: Image generator not configured (GEMINI_API_KEY missing)")
            print("  Images will be skipped.")
            print()

    if generate_audio:
        if not pipeline.audio_generator.is_configured:
            print("WARNING: Audio generator not configured")
            print("  Audio will be skipped.")
            print()

    try:
        story = await pipeline.generate_complete_story(
            jlpt_level=jlpt_level,
            genre=genre,
            theme=theme,
            num_chapters=num_chapters,
            words_per_chapter=words_per_chapter,
            voice=voice,
            image_style=image_style,
            generate_audio=generate_audio,
            generate_image=generate_image,
            generate_chapter_images=generate_chapter_images,
            align_audio=align_audio,
        )

        print()
        print("=" * 60)
        print("Generation Complete!")
        print("=" * 60)
        print(f"Story ID: {story['id']}")
        print(f"Title: {story['metadata']['title']}")
        if story["metadata"].get("titleJapanese"):
            print(f"Japanese: {story['metadata']['titleJapanese']}")
        print(f"Chapters: {len(story.get('chapters', []))}")

        if story["metadata"].get("coverImageURL"):
            print(f"Cover: {story['metadata']['coverImageURL']}")

        chapter_images = sum(1 for ch in story.get("chapters", []) if ch.get("imageURL"))
        if chapter_images:
            print(f"Chapter Images: {chapter_images}")

        if story["metadata"].get("audioURL"):
            print(f"Audio: {story['metadata']['audioURL']}")

        # Check for audio alignment
        aligned_segments = 0
        for ch in story.get("chapters", []):
            for seg in ch.get("content", []):
                if seg.get("audioStartTime") is not None:
                    aligned_segments += 1
        if aligned_segments:
            print(f"Aligned Segments: {aligned_segments}")

        print()
        print(f"Story saved to: backend/app/data/stories/{story['id']}.json")
        print("=" * 60)

        return story

    except Exception as e:
        logger.error(f"Story generation failed: {e}")
        raise


def main():
    parser = argparse.ArgumentParser(
        description="Generate a complete story with all assets",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/generate_story.py --level N5 --genre "slice of life"
  python scripts/generate_story.py --level N4 --genre adventure --theme "lost in Tokyo"
  python scripts/generate_story.py --level N3 --genre mystery --chapters 3 --style ghibli
  python scripts/generate_story.py --level N5 --genre comedy --no-audio

Available genres:
  slice of life, mystery, adventure, romance, comedy, fantasy,
  horror, school life, workplace, travel, food, sports, music,
  family, friendship

Available image styles:
  anime, watercolor, minimalist, realistic, ghibli
        """,
    )

    # Required arguments
    parser.add_argument(
        "--level",
        "-l",
        required=True,
        choices=["N5", "N4", "N3", "N2", "N1"],
        help="JLPT level (N5-N1)",
    )
    parser.add_argument(
        "--genre", "-g", required=True, help="Story genre (e.g., 'slice of life', 'adventure')"
    )

    # Optional content arguments
    parser.add_argument("--theme", "-t", help="Optional theme or topic for the story")
    parser.add_argument(
        "--chapters", "-c", type=int, default=5, help="Number of chapters (default: 5)"
    )
    parser.add_argument(
        "--words", type=int, default=100, help="Approximate words per chapter (default: 100)"
    )

    # Style arguments
    parser.add_argument(
        "--style",
        "-s",
        default="anime",
        choices=["anime", "watercolor", "minimalist", "realistic", "ghibli"],
        help="Image art style (default: anime)",
    )
    parser.add_argument("--voice", "-v", default="makoto", help="TTS voice name (default: makoto)")

    # Feature toggles
    parser.add_argument("--no-audio", action="store_true", help="Skip audio generation")
    parser.add_argument(
        "--no-images", action="store_true", help="Skip all image generation (cover and chapters)"
    )
    parser.add_argument(
        "--no-chapter-images",
        action="store_true",
        help="Skip chapter image generation (still generates cover)",
    )
    parser.add_argument("--no-alignment", action="store_true", help="Skip audio alignment")

    args = parser.parse_args()

    # Run the pipeline
    asyncio.run(
        generate_story(
            jlpt_level=args.level,
            genre=args.genre,
            theme=args.theme,
            num_chapters=args.chapters,
            words_per_chapter=args.words,
            voice=args.voice,
            image_style=args.style,
            generate_audio=not args.no_audio,
            generate_image=not args.no_images,
            generate_chapter_images=not args.no_images and not args.no_chapter_images,
            align_audio=not args.no_alignment,
        )
    )


if __name__ == "__main__":
    main()
