#!/usr/bin/env python3
"""
Generate audio files and timing data for Japanese Reader stories.

This script uses a TTS service to generate audio for each segment
and records timing information for sentence synchronization.

Usage:
    python scripts/generate_audio.py [story_id] [--all]

Options:
    story_id    Generate audio for a specific story
    --all       Generate audio for all stories without audio
    --list      List stories and their audio status
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

STORIES_DIR = Path(__file__).parent.parent / "app" / "data" / "stories"
AUDIO_DIR = Path(__file__).parent.parent / "app" / "static" / "audio"


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


def list_stories() -> None:
    """List all stories and their audio status."""
    print("\nStories in library:")
    print("-" * 60)

    for story_file in sorted(STORIES_DIR.glob("*.json")):
        story = load_story(story_file)
        story_id = story["id"]
        title = story["metadata"].get("titleJapanese") or story["metadata"]["title"]
        has_audio = story["metadata"].get("audioURL") is not None

        status = "[AUDIO]" if has_audio else "[NO AUDIO]"
        print(f"{status} {story_id}: {title}")

    print("-" * 60)


def generate_audio_for_story(story_path: Path, tts_engine: str = "macos") -> bool:
    """
    Generate audio for a story.

    Args:
        story_path: Path to the story JSON file
        tts_engine: Which TTS engine to use ('macos', 'google', 'azure')

    Returns:
        True if successful, False otherwise
    """
    story = load_story(story_path)
    story_id = story["id"]

    print(f"\nGenerating audio for: {story_id}")
    print(f"Title: {story['metadata'].get('titleJapanese') or story['metadata']['title']}")

    # Create audio directory
    story_audio_dir = AUDIO_DIR / story_id
    story_audio_dir.mkdir(parents=True, exist_ok=True)

    # Get all segments (handle both chapter-based and content-based stories)
    all_segments = []
    if story.get("chapters"):
        for chapter_idx, chapter in enumerate(story["chapters"]):
            segments = chapter.get("segments") or chapter.get("content", [])
            for seg in segments:
                all_segments.append((chapter_idx, seg))
    elif story.get("content"):
        for seg in story["content"]:
            all_segments.append((0, seg))

    if not all_segments:
        print(f"  No segments found in story")
        return False

    print(f"  Found {len(all_segments)} segments")

    # For now, just show what we would generate
    # Full TTS implementation would go here

    current_time = 0.0
    timing_data = []

    for chapter_idx, segment in all_segments:
        text = get_segment_text(segment)
        if not text.strip():
            continue

        # Estimate duration based on character count
        # Japanese speech is roughly 5-7 characters per second
        char_count = len(text)
        estimated_duration = char_count / 5.0

        segment_timing = {
            "segment_id": segment["id"],
            "chapter_index": chapter_idx,
            "text": text,
            "start_time": current_time,
            "end_time": current_time + estimated_duration
        }
        timing_data.append(segment_timing)

        print(f"  [{segment['id']}] {current_time:.2f}s - {current_time + estimated_duration:.2f}s: {text[:30]}...")

        current_time += estimated_duration + 0.3  # Add small pause between segments

    total_duration = current_time
    print(f"\n  Total estimated duration: {total_duration:.1f} seconds")

    # Save timing data
    timing_file = story_audio_dir / "timing.json"
    with open(timing_file, "w", encoding="utf-8") as f:
        json.dump(timing_data, f, ensure_ascii=False, indent=2)
    print(f"  Saved timing data to: {timing_file}")

    # Note: Actual audio generation would happen here
    # For demo purposes, we'll just create the timing data

    print("\n  NOTE: Audio file generation requires a TTS service.")
    print("  Supported options:")
    print("    - macOS 'say' command (Japanese voice required)")
    print("    - Google Cloud TTS (requires API key)")
    print("    - Azure Cognitive Services (requires API key)")

    return True


def main():
    parser = argparse.ArgumentParser(description="Generate audio for Japanese Reader stories")
    parser.add_argument("story_id", nargs="?", help="Story ID to generate audio for")
    parser.add_argument("--all", action="store_true", help="Generate audio for all stories")
    parser.add_argument("--list", action="store_true", help="List stories and their audio status")
    parser.add_argument("--engine", choices=["macos", "google", "azure"], default="macos",
                       help="TTS engine to use (default: macos)")

    args = parser.parse_args()

    if args.list:
        list_stories()
        return

    if args.all:
        print("Generating audio for all stories...")
        for story_file in sorted(STORIES_DIR.glob("*.json")):
            story = load_story(story_file)
            if not story["metadata"].get("audioURL"):
                generate_audio_for_story(story_file, args.engine)
        return

    if args.story_id:
        # Find the story file
        story_file = None
        for f in STORIES_DIR.glob("*.json"):
            story = load_story(f)
            if story["id"] == args.story_id:
                story_file = f
                break

        if not story_file:
            print(f"Error: Story '{args.story_id}' not found")
            sys.exit(1)

        generate_audio_for_story(story_file, args.engine)
        return

    # No arguments - show help
    parser.print_help()
    print("\n")
    list_stories()


if __name__ == "__main__":
    main()
