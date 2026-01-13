#!/usr/bin/env python3
"""
Generate precise audio timing using Whisper forced alignment.

Uses whisper-timestamped to align audio with transcript and extract
accurate segment timestamps.

Requirements:
    pip install whisper-timestamped torch

Usage:
    python scripts/align_audio_whisper.py [--story story_id] [--list] [--dry-run]
"""

import json
import sys
from pathlib import Path
from typing import Optional

# Paths
STORIES_DIR = Path(__file__).parent.parent / "app" / "data" / "stories"
AUDIO_DIR = Path(__file__).parent.parent / "app" / "static" / "audio"

# Whisper model to use (small is good balance of speed/accuracy for Japanese)
WHISPER_MODEL = "small"


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
        return "".join(token.get("surface", "") for token in segment["tokens"])
    return segment.get("text", "")


def get_audio_path(story_data: dict) -> Optional[Path]:
    """Get the local audio file path for a story."""
    audio_url = story_data["metadata"].get("audioURL")
    if not audio_url:
        return None

    # Extract filename from URL (e.g., "/cdn/audio/story.mp3" -> "story.mp3")
    filename = audio_url.split("/")[-1]
    audio_path = AUDIO_DIR / filename

    if audio_path.exists():
        return audio_path
    return None


def align_with_whisper(audio_path: Path, segments: list[dict]) -> tuple[list[dict], list[dict]]:
    """
    Use Whisper to align audio with transcript segments.

    Args:
        audio_path: Path to audio file
        segments: List of segment dicts with text

    Returns:
        Tuple of (aligned_segments, raw_whisper_data)
        - aligned_segments: Segments with audioStartTime, audioEndTime, and audioWords added
        - raw_whisper_data: Full Whisper output for reference
    """
    try:
        import whisper_timestamped as whisper
    except ImportError:
        print("Error: whisper-timestamped not installed")
        print("Install with: pip install whisper-timestamped torch")
        sys.exit(1)

    print(f"  Loading Whisper model '{WHISPER_MODEL}'...")
    model = whisper.load_model(WHISPER_MODEL)

    print(f"  Transcribing audio...")
    audio = whisper.load_audio(str(audio_path))
    result = whisper.transcribe(model, audio, language="ja")

    # Get all whisper segments with timing
    whisper_segments = result.get("segments", [])

    print(f"  Whisper found {len(whisper_segments)} segments")

    # Extract all words with timing for debugging/reference
    all_words = []
    for seg in whisper_segments:
        for word in seg.get("words", []):
            all_words.append({
                "text": word.get("text", ""),
                "start": round(word.get("start", 0), 2),
                "end": round(word.get("end", 0), 2),
                "confidence": round(word.get("confidence", 0), 2)
            })

    print(f"  Whisper found {len(all_words)} words")

    # Match story segments to whisper segments by text similarity
    aligned_segments = match_segments_with_words(segments, whisper_segments)

    return aligned_segments, all_words


def normalize_text(text: str) -> str:
    """Normalize text for comparison (remove spaces, punctuation variations)."""
    # Remove common whitespace and normalize punctuation
    text = text.replace(" ", "").replace("　", "")
    return text


def match_segments_with_words(story_segments: list[dict], whisper_segments: list[dict]) -> list[dict]:
    """
    Match story segments to Whisper segments by text content.
    Includes word-level timing data for each segment.

    Uses a sliding window approach to find the best match for each story segment.
    """
    aligned = []
    whisper_idx = 0

    for seg in story_segments:
        story_text = normalize_text(get_segment_text(seg))
        if not story_text:
            aligned.append(seg)
            continue

        # Find whisper segments that match this story segment
        best_start = None
        best_end = None
        accumulated_text = ""
        collected_words = []

        # Look through whisper segments to find matching text
        for i in range(whisper_idx, len(whisper_segments)):
            w_seg = whisper_segments[i]
            w_text = normalize_text(w_seg.get("text", ""))
            accumulated_text += w_text

            # Collect words from this whisper segment
            for word in w_seg.get("words", []):
                collected_words.append({
                    "text": word.get("text", ""),
                    "start": round(word.get("start", 0), 2),
                    "end": round(word.get("end", 0), 2),
                    "confidence": round(word.get("confidence", 0), 2)
                })

            if best_start is None:
                best_start = w_seg.get("start", 0)
            best_end = w_seg.get("end", 0)

            # Check if we've accumulated enough text to match
            if story_text in accumulated_text or accumulated_text in story_text:
                # Good match - check if we should continue
                if len(accumulated_text) >= len(story_text) * 0.8:
                    whisper_idx = i + 1
                    break

            # If accumulated text is much longer than story text, we've gone too far
            if len(accumulated_text) > len(story_text) * 1.5:
                whisper_idx = i
                break

        # Create aligned segment with word-level timing
        aligned_seg = seg.copy()
        if best_start is not None:
            aligned_seg["audioStartTime"] = round(best_start, 2)
            aligned_seg["audioEndTime"] = round(best_end, 2)
            aligned_seg["audioWords"] = collected_words
        aligned.append(aligned_seg)

    return aligned


def list_stories() -> None:
    """List all stories and their audio status."""
    print("\nStories with audio:")
    print("-" * 70)

    for story_file in sorted(STORIES_DIR.glob("*.json")):
        story = load_story(story_file)
        story_id = story["id"]
        level = story["metadata"].get("jlptLevel", "?")
        title = story["metadata"].get("titleJapanese") or story["metadata"]["title"]

        audio_path = get_audio_path(story)
        if audio_path:
            has_timing = False
            # Check for timing data
            if story.get("chapters"):
                for ch in story["chapters"]:
                    for seg in ch.get("content", []):
                        if seg.get("audioStartTime") is not None:
                            has_timing = True
                            break
            elif story.get("content"):
                for seg in story["content"]:
                    if seg.get("audioStartTime") is not None:
                        has_timing = True
                        break

            timing_status = "TIMED" if has_timing else "     "
            print(f"[AUDIO] [{timing_status}] [{level}] {story_id}: {title[:30]}")

    print("-" * 70)


def process_story(story_id: str, dry_run: bool = False) -> bool:
    """Align audio for a specific story using Whisper."""
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

    story_data = load_story(story_file)

    # Check if story has audio
    audio_path = get_audio_path(story_data)
    if not audio_path:
        print(f"No audio file found for: {story_id}")
        return False

    print(f"Processing: {story_id}")
    print(f"  Audio: {audio_path.name}")

    # Collect all segments
    all_segments = []
    if story_data.get("chapters"):
        for chapter in story_data["chapters"]:
            all_segments.extend(chapter.get("content", []))
    elif story_data.get("content"):
        all_segments = story_data["content"]

    print(f"  Story segments: {len(all_segments)}")

    if dry_run:
        print("  [DRY RUN] Would process with Whisper")
        return True

    # Run Whisper alignment
    aligned_segments, all_words = align_with_whisper(audio_path, all_segments)

    # Update story data with aligned segments
    seg_idx = 0
    if story_data.get("chapters"):
        for chapter in story_data["chapters"]:
            content = chapter.get("content", [])
            for i in range(len(content)):
                if seg_idx < len(aligned_segments):
                    content[i] = aligned_segments[seg_idx]
                    seg_idx += 1
    elif story_data.get("content"):
        story_data["content"] = aligned_segments

    # Show sample of aligned timing
    print("\n  Sample alignment:")
    for seg in aligned_segments[:3]:
        text = get_segment_text(seg)[:40]
        start = seg.get("audioStartTime", "?")
        end = seg.get("audioEndTime", "?")
        word_count = len(seg.get("audioWords", []))
        print(f"    {start}s - {end}s ({word_count} words): {text}...")

    # Show sample words from first segment
    if aligned_segments and aligned_segments[0].get("audioWords"):
        print("\n  Sample words from first segment:")
        for word in aligned_segments[0]["audioWords"][:5]:
            print(f"    {word['start']}s - {word['end']}s: {word['text']}")

    # Save story
    save_story(story_file, story_data)
    print(f"\n  Timing data saved with word-level timestamps!")

    return True


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Align audio timing using Whisper")
    parser.add_argument("--story", help="Process specific story ID")
    parser.add_argument("--list", action="store_true", help="List stories with audio")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done")
    args = parser.parse_args()

    if args.list:
        list_stories()
        return

    if args.story:
        process_story(args.story, args.dry_run)
    else:
        print("Please specify --story <story_id> or --list")
        print("Example: python scripts/align_audio_whisper.py --story n5_weekend_trip_001")


if __name__ == "__main__":
    main()
