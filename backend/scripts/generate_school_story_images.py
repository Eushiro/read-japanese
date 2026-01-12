"""
Script to generate AI images for the school day story (n5_my_day_at_school.json)
Generates cover image (portrait) and chapter images (landscape) using Nano Banana.
"""
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


STORY_FILE = Path(__file__).parent.parent / "app" / "data" / "stories" / "n5_my_day_at_school.json"

# Chapter descriptions for image generation
CHAPTER_DESCRIPTIONS = {
    "ch_1": "A Japanese student waking up early in the morning at 6am, eating breakfast with rice and miso soup at home, then walking to school on a sunny day through a residential neighborhood in Japan",
    "ch_2": "A Japanese classroom scene with students studying at their desks, a kind teacher at the blackboard teaching Japanese language and math, students raising hands to ask questions",
    "ch_3": "Japanese students eating lunch together in a bright school cafeteria, laughing and enjoying their bento boxes, then an afternoon music class with students playing instruments"
}


async def generate_images():
    """Generate all images for the school day story"""

    # Load the story
    with open(STORY_FILE, "r", encoding="utf-8") as f:
        story = json.load(f)

    print(f"Loaded story: {story['metadata']['title']}")
    print(f"Japanese title: {story['metadata']['titleJapanese']}")
    print()

    # Initialize image generator
    generator = ImageGenerator()

    if not generator.is_configured:
        print("ERROR: Google AI API key not configured!")
        print("Please set GOOGLE_AI_API_KEY environment variable")
        return

    print("Image generator configured successfully")
    print(f"Using model: {generator.model}")
    print()

    # Generate cover image (portrait)
    print("=" * 50)
    print("Generating cover image (portrait)...")
    print("=" * 50)

    cover_result = await generator.generate_cover(
        story_title=story["metadata"]["title"],
        story_summary=story["metadata"]["summary"],
        genre=story["metadata"]["genre"],
        jlpt_level=story["metadata"]["jlptLevel"],
        style="ghibli"  # Studio Ghibli style for school story
    )

    if cover_result:
        print(f"Cover image generated: {cover_result['url']}")
        story["metadata"]["coverImageURL"] = cover_result["url"]
        story["metadata"]["coverImageModel"] = cover_result["model"]
        story["metadata"]["coverImageModelName"] = cover_result["model_name"]
    else:
        print("Failed to generate cover image")

    print()

    # Brief wait between requests
    print("Waiting 1 second before next request...")
    await asyncio.sleep(1)

    # Generate chapter images (landscape)
    for i, chapter in enumerate(story["chapters"]):
        chapter_id = chapter["id"]
        chapter_title = chapter["title"]
        chapter_title_jp = chapter["titleJapanese"]

        print("=" * 50)
        print(f"Generating image for Chapter: {chapter_title} ({chapter_title_jp})")
        print("=" * 50)

        description = CHAPTER_DESCRIPTIONS.get(chapter_id, chapter_title)

        chapter_result = await generator.generate_chapter_image(
            chapter_title=f"{chapter_title} - {chapter_title_jp}",
            chapter_content=description,
            story_title=story["metadata"]["title"],
            genre=story["metadata"]["genre"],
            style="ghibli"
        )

        if chapter_result:
            print(f"Chapter image generated: {chapter_result['url']}")
            chapter["imageURL"] = chapter_result["url"]
            chapter["imageModel"] = chapter_result["model"]
            chapter["imageModelName"] = chapter_result["model_name"]
        else:
            print(f"Failed to generate image for chapter: {chapter_title}")

        print()

        # Wait between chapter requests (except after the last one)
        if i < len(story["chapters"]) - 1:
            print("Waiting 1 second before next request...")
            await asyncio.sleep(1)

    # Save updated story
    print("=" * 50)
    print("Saving updated story...")
    print("=" * 50)

    with open(STORY_FILE, "w", encoding="utf-8") as f:
        json.dump(story, f, ensure_ascii=False, indent=2)

    print(f"Story saved to: {STORY_FILE}")
    print()
    print("Done!")


if __name__ == "__main__":
    asyncio.run(generate_images())
