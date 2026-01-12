"""
Script to optimize existing images by converting to WebP and resizing.
"""
import json
from pathlib import Path
from PIL import Image

IMAGES_DIR = Path(__file__).parent.parent / "app" / "static" / "images"
STORY_FILE = Path(__file__).parent.parent / "app" / "data" / "stories" / "n5_my_day_at_school.json"


def optimize_image(input_path: Path, max_size: int = 800, quality: int = 85) -> Path:
    """Convert image to optimized WebP"""
    output_path = input_path.with_suffix('.webp')

    img = Image.open(input_path)

    # Convert to RGB if necessary
    if img.mode in ('RGBA', 'P'):
        img = img.convert('RGB')

    original_size = input_path.stat().st_size

    # Resize if larger than max_size
    if max(img.size) > max_size:
        img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

    # Save as WebP
    img.save(output_path, 'WEBP', quality=quality, method=6)

    final_size = output_path.stat().st_size
    print(f"  {input_path.name}: {original_size/1024:.1f}KB -> {final_size/1024:.1f}KB ({100-final_size/original_size*100:.0f}% smaller)")

    return output_path


def main():
    print("Optimizing images...")
    print()

    # Find all PNG files
    png_files = list(IMAGES_DIR.glob("*.png"))

    if not png_files:
        print("No PNG files found to optimize")
        return

    # Track old -> new filename mapping
    filename_map = {}

    for png_path in png_files:
        webp_path = optimize_image(png_path)
        old_name = f"/cdn/images/{png_path.name}"
        new_name = f"/cdn/images/{webp_path.name}"
        filename_map[old_name] = new_name

        # Remove original PNG
        png_path.unlink()

    print()
    print("Updating story JSON...")

    # Update story JSON with new filenames
    with open(STORY_FILE, "r", encoding="utf-8") as f:
        story = json.load(f)

    # Update cover image URL
    if story["metadata"].get("coverImageURL") in filename_map:
        story["metadata"]["coverImageURL"] = filename_map[story["metadata"]["coverImageURL"]]

    # Update chapter image URLs
    for chapter in story.get("chapters", []):
        if chapter.get("imageURL") in filename_map:
            chapter["imageURL"] = filename_map[chapter["imageURL"]]

    with open(STORY_FILE, "w", encoding="utf-8") as f:
        json.dump(story, f, ensure_ascii=False, indent=2)

    print("Done!")


if __name__ == "__main__":
    main()
