#!/usr/bin/env python3
"""
Generate audio for stories using Eleven Labs TTS API.

Usage:
    export ELEVEN_LABS_API_KEY=your_api_key
    python scripts/generate_audio.py [--level N5] [--story story_id] [--list]

Environment Variables:
    ELEVEN_LABS_API_KEY - Your Eleven Labs API key (required)
"""

import os
import json
import asyncio
import sys
from pathlib import Path
from typing import Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    import httpx
except ImportError:
    print("Error: httpx not installed. Run: pip install httpx")
    sys.exit(1)

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
ELEVEN_LABS_API_KEY = os.getenv("ELEVEN_LABS_API_KEY")
ELEVEN_LABS_BASE_URL = "https://api.elevenlabs.io/v1"

# Japanese voice - Makoto from Eleven Labs Voice Library
# Other Japanese voices: Eiko (female): GR4dBIFsYe57TxyrHKXz, Akari (female): EkK6wL8GaH8IgBZTTDGJ
VOICE_ID = "6wdSVG3CMjPfAthsnMv9"  # Makoto - Japanese male, narrative/story
VOICE_NAME = "Makoto"
MODEL_ID = "eleven_multilingual_v2"

# Paths
STORIES_DIR = Path(__file__).parent.parent / "app" / "data" / "stories"
AUDIO_DIR = Path(__file__).parent.parent / "app" / "static" / "audio"


def extract_text_from_tokens(tokens: list) -> str:
    """Extract plain text from token list by joining surface forms."""
    return "".join(token.get("surface", "") for token in tokens)


def load_story(story_path: Path) -> dict:
    """Load a story JSON file."""
    with open(story_path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_story(story_path: Path, story: dict) -> None:
    """Save a story JSON file."""
    with open(story_path, "w", encoding="utf-8") as f:
        json.dump(story, f, ensure_ascii=False, indent=2)


def get_segment_text(segment: dict) -> str:
    """Extract plain text from a segment."""
    if "tokens" in segment and segment["tokens"]:
        return "".join(token["surface"] for token in segment["tokens"])
    return segment.get("text", "")


def extract_story_text(story_data: dict) -> list[dict]:
    """
    Extract all text segments from a story.
    Returns list of {id, text} dicts for each segment.
    """
    segments = []

    # Handle chapter-based stories
    if "chapters" in story_data and story_data["chapters"]:
        for chapter in story_data["chapters"]:
            for segment in chapter.get("content", []):
                text = get_segment_text(segment)
                if text.strip():
                    segments.append({
                        "id": segment["id"],
                        "text": text
                    })

    # Handle non-chapter stories
    elif "content" in story_data:
        for segment in story_data["content"]:
            text = get_segment_text(segment)
            if text.strip():
                segments.append({
                    "id": segment["id"],
                    "text": text
                })

    return segments


def list_stories() -> None:
    """List all stories and their audio status."""
    print("\nStories in library:")
    print("-" * 60)

    for story_file in sorted(STORIES_DIR.glob("*.json")):
        story = load_story(story_file)
        story_id = story["id"]
        level = story["metadata"].get("jlptLevel", "?")
        title = story["metadata"].get("titleJapanese") or story["metadata"]["title"]
        has_audio = story["metadata"].get("audioURL") is not None

        status = "[AUDIO]" if has_audio else "[     ]"
        print(f"{status} [{level}] {story_id}: {title}")

    print("-" * 60)


async def generate_audio(text: str, output_path: Path) -> bool:
    """Generate audio using Eleven Labs API."""
    if not ELEVEN_LABS_API_KEY:
        print("Error: ELEVEN_LABS_API_KEY not set")
        return False

    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVEN_LABS_API_KEY
    }

    data = {
        "text": text,
        "model_id": MODEL_ID,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.0,
            "use_speaker_boost": True
        }
    }

    url = f"{ELEVEN_LABS_BASE_URL}/text-to-speech/{VOICE_ID}"

    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            print(f"  Calling Eleven Labs API...")
            response = await client.post(url, headers=headers, json=data)
            if response.status_code == 200:
                output_path.parent.mkdir(parents=True, exist_ok=True)
                with open(output_path, "wb") as f:
                    f.write(response.content)
                return True
            else:
                print(f"  Error generating audio: {response.status_code}")
                print(f"  Response: {response.text}")
                return False
        except Exception as e:
            print(f"  Error: {e}")
            return False


async def generate_story_audio(story_id: str) -> bool:
    """Generate audio for all segments in a story."""
    # Find the story file
    story_file = None
    for f in STORIES_DIR.glob("*.json"):
        data = load_story(f)
        if data.get("id") == story_id:
            story_file = f
            break

    if not story_file:
        print(f"Story not found: {story_id}")
        return False

    print(f"\nProcessing: {story_file.name}")
    story_data = load_story(story_file)

    segments = extract_story_text(story_data)
    if not segments:
        print("  No segments found")
        return False

    # Create combined text for full story audio
    full_text = "\n".join(seg["text"] for seg in segments)

    print(f"  Segments: {len(segments)}")
    print(f"  Total characters: {len(full_text)}")

    # Generate full story audio
    audio_filename = f"{story_id}.mp3"
    audio_path = AUDIO_DIR / audio_filename

    success = await generate_audio(full_text, audio_path)

    if success:
        # Update story JSON with audio URL and voice info
        story_data["metadata"]["audioURL"] = f"/cdn/audio/{audio_filename}"
        story_data["metadata"]["audioVoiceId"] = VOICE_ID
        story_data["metadata"]["audioVoiceName"] = VOICE_NAME
        save_story(story_file, story_data)

        print(f"  Audio saved: {audio_path}")
        print(f"  Story updated with audio URL and voice: {VOICE_NAME}")
        return True

    return False


async def generate_all_audio(level: Optional[str] = None):
    """Generate audio for all stories (optionally filtered by level)."""
    if not ELEVEN_LABS_API_KEY:
        print("Error: ELEVEN_LABS_API_KEY environment variable not set")
        print("Please set it with: export ELEVEN_LABS_API_KEY=your_key")
        return

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    for story_file in sorted(STORIES_DIR.glob("*.json")):
        story_data = load_story(story_file)

        # Filter by level if specified
        story_level = story_data["metadata"].get("jlptLevel", "").upper()
        if level and story_level != level.upper():
            continue

        story_id = story_data.get("id")
        if not story_id:
            continue

        # Skip if audio already exists
        if story_data["metadata"].get("audioURL"):
            print(f"Skipping {story_id} - audio already exists")
            continue

        await generate_story_audio(story_id)

        # Rate limit - wait between requests
        print("  Waiting 2 seconds before next request...")
        await asyncio.sleep(2)


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Generate audio for stories using Eleven Labs")
    parser.add_argument("--level", help="Filter by JLPT level (e.g., N5)")
    parser.add_argument("--story", help="Generate audio for specific story ID")
    parser.add_argument("--list", action="store_true", help="List stories and their audio status")
    args = parser.parse_args()

    if args.list:
        list_stories()
        return

    if not ELEVEN_LABS_API_KEY:
        print("=" * 60)
        print("ELEVEN_LABS_API_KEY not set!")
        print()
        print("To generate audio, set your API key:")
        print("  export ELEVEN_LABS_API_KEY=your_api_key_here")
        print()
        print("You can also add it to backend/.env file")
        print("=" * 60)
        print()
        list_stories()
        return

    if args.story:
        asyncio.run(generate_story_audio(args.story))
    else:
        asyncio.run(generate_all_audio(args.level))


if __name__ == "__main__":
    main()
