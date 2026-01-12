"""
Generic script to generate AI images for any story.
Generates cover image (4:5 portrait) and chapter images (16:9 landscape).

Usage:
    python scripts/generate_story_images.py <story_file.json>
    python scripts/generate_story_images.py app/data/stories/n5_my_day_at_school.json
    python scripts/generate_story_images.py app/data/stories/n5_my_day_at_school.json --style ghibli
"""
import argparse
import asyncio
import json
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.services.generation.image_generator import ImageGenerator


def extract_chapter_description(chapter: dict) -> str:
    """Extract a description from chapter content for image generation"""
    # Try to use the chapter summary if available
    if chapter.get("summary"):
        return chapter["summary"]

    # Otherwise, extract text from content segments
    texts = []
    for segment in chapter.get("content", []):
        # Get text from segment
        if segment.get("text"):
            texts.append(segment["text"])
        # Or reconstruct from tokens
        elif segment.get("tokens"):
            text = "".join(t.get("surface", "") for t in segment["tokens"])
            texts.append(text)

    # Return first ~200 characters as description
    full_text = " ".join(texts)
    if len(full_text) > 200:
        return full_text[:200] + "..."
    return full_text or chapter.get("title", "")


async def generate_images(story_path: str, style: str = "anime", skip_cover: bool = False, skip_chapters: bool = False):
    """Generate all images for a story"""

    story_file = Path(story_path)
    if not story_file.exists():
        print(f"ERROR: Story file not found: {story_file}")
        return

    # Load the story
    with open(story_file, "r", encoding="utf-8") as f:
        story = json.load(f)

    print(f"Loaded story: {story['metadata']['title']}")
    if story['metadata'].get('titleJapanese'):
        print(f"Japanese title: {story['metadata']['titleJapanese']}")
    print(f"Style: {style}")
    print()

    # Initialize image generator
    generator = ImageGenerator()

    if not generator.is_configured:
        print("ERROR: Google AI API key not configured!")
        print("Please set GOOGLE_AI_API_KEY in .env file")
        return

    print("Image generator configured successfully")
    print(f"Using model: {generator.model}")
    print()

    # Generate cover image (4:5 portrait for thumbnail)
    if not skip_cover:
        print("=" * 50)
        print("Generating cover image (4:5 portrait)...")
        print("=" * 50)

        cover_result = await generator.generate_cover(
            story_title=story["metadata"]["title"],
            story_summary=story["metadata"].get("summary", story["metadata"]["title"]),
            genre=story["metadata"].get("genre", "general"),
            jlpt_level=story["metadata"].get("jlptLevel", "N5"),
            style=style,
            aspect_ratio="4:5"
        )

        if cover_result:
            print(f"Cover image generated: {cover_result['url']}")
            story["metadata"]["coverImageURL"] = cover_result["url"]
            story["metadata"]["coverImageModel"] = cover_result["model"]
            story["metadata"]["coverImageModelName"] = cover_result["model_name"]
        else:
            print("Failed to generate cover image")

        print()
        await asyncio.sleep(1)

    # Generate chapter images (16:9 landscape)
    if not skip_chapters and story.get("chapters"):
        for i, chapter in enumerate(story["chapters"]):
            chapter_title = chapter.get("titleJapanese") or chapter.get("title", f"Chapter {i+1}")

            print("=" * 50)
            print(f"Generating image for: {chapter_title}")
            print("=" * 50)

            description = extract_chapter_description(chapter)
            print(f"Description: {description[:100]}...")

            chapter_result = await generator.generate_chapter_image(
                chapter_title=chapter_title,
                chapter_content=description,
                story_title=story["metadata"]["title"],
                genre=story["metadata"].get("genre", "general"),
                style=style,
                aspect_ratio="16:9"
            )

            if chapter_result:
                print(f"Chapter image generated: {chapter_result['url']}")
                chapter["imageURL"] = chapter_result["url"]
                chapter["imageModel"] = chapter_result["model"]
                chapter["imageModelName"] = chapter_result["model_name"]
            else:
                print(f"Failed to generate image for: {chapter_title}")

            print()

            # Wait between requests (except after the last one)
            if i < len(story["chapters"]) - 1:
                await asyncio.sleep(1)

    # Save updated story
    print("=" * 50)
    print("Saving updated story...")
    print("=" * 50)

    with open(story_file, "w", encoding="utf-8") as f:
        json.dump(story, f, ensure_ascii=False, indent=2)

    print(f"Story saved to: {story_file}")
    print()
    print("Done!")


def main():
    parser = argparse.ArgumentParser(description="Generate AI images for a story")
    parser.add_argument("story_file", help="Path to the story JSON file")
    parser.add_argument("--style", default="anime",
                       choices=["anime", "watercolor", "minimalist", "realistic", "ghibli"],
                       help="Art style for images (default: anime)")
    parser.add_argument("--skip-cover", action="store_true", help="Skip cover image generation")
    parser.add_argument("--skip-chapters", action="store_true", help="Skip chapter image generation")

    args = parser.parse_args()

    asyncio.run(generate_images(
        args.story_file,
        style=args.style,
        skip_cover=args.skip_cover,
        skip_chapters=args.skip_chapters
    ))


if __name__ == "__main__":
    main()
