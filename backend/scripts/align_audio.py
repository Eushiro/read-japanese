#!/usr/bin/env python3
"""
Align audio with story text using stable-ts for accurate timestamps.

Uses Whisper with stable-ts enhancements for better word-level timing.

Usage:
    python scripts/align_audio.py <story_file.json>
    python scripts/align_audio.py app/data/stories/n5_a_fun_weekend.json
    python scripts/align_audio.py --all          # Process all stories with audio
    python scripts/align_audio.py --level N5     # Process all N5 stories
"""

import argparse
import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

import stable_whisper

# Configuration
WHISPER_MODEL = "small"  # Options: tiny, base, small, medium, large
STORIES_DIR = Path(__file__).parent.parent / "app" / "data" / "stories"
AUDIO_DIR = Path(__file__).parent.parent / "app" / "static" / "audio"
AUDIO_ORIGINALS_DIR = AUDIO_DIR / "originals"


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


def find_audio_file(story_id: str) -> Path | None:
    """Find audio file for a story, preferring WAV originals."""
    # Check for WAV original first (better for alignment)
    wav_path = AUDIO_ORIGINALS_DIR / f"{story_id}.wav"
    if wav_path.exists():
        return wav_path

    # Fall back to MP3
    mp3_path = AUDIO_DIR / f"{story_id}.mp3"
    if mp3_path.exists():
        return mp3_path

    return None


def align_story(story_path: Path, model) -> bool:
    """
    Align audio with story segments using stable-ts.

    Returns True if alignment was successful.
    """
    print(f"\nProcessing: {story_path.name}")

    story = load_story(story_path)
    story_id = story.get("id")

    if not story_id:
        print("  Error: Story has no ID")
        return False

    # Find audio file
    audio_path = find_audio_file(story_id)
    if not audio_path:
        print(f"  Error: No audio file found for {story_id}")
        return False

    print(f"  Audio: {audio_path.name}")

    # Transcribe with stable-ts
    print(f"  Transcribing with Whisper {WHISPER_MODEL}...")
    result = model.transcribe(
        str(audio_path),
        language="ja",
        word_timestamps=True,
    )

    # Get all segments from story
    story_segments = []
    if story.get("chapters"):
        for ch_idx, chapter in enumerate(story["chapters"]):
            for seg_idx, segment in enumerate(chapter.get("content", [])):
                text = get_segment_text(segment)
                if text.strip():
                    story_segments.append({
                        "chapter_idx": ch_idx,
                        "segment_idx": seg_idx,
                        "id": segment["id"],
                        "text": text,
                        "segment_ref": segment
                    })
    elif story.get("content"):
        for seg_idx, segment in enumerate(story["content"]):
            text = get_segment_text(segment)
            if text.strip():
                story_segments.append({
                    "chapter_idx": None,
                    "segment_idx": seg_idx,
                    "id": segment["id"],
                    "text": text,
                    "segment_ref": segment
                })

    if not story_segments:
        print("  Error: No segments found in story")
        return False

    print(f"  Story segments: {len(story_segments)}")
    print(f"  Whisper segments: {len(result.segments)}")

    # Match story segments to whisper output
    # Strategy: For each story segment, find overlapping whisper words
    all_words = []
    for whisper_seg in result.segments:
        if hasattr(whisper_seg, 'words') and whisper_seg.words:
            for word in whisper_seg.words:
                all_words.append({
                    "text": word.word.strip(),
                    "start": round(word.start, 3),
                    "end": round(word.end, 3),
                })

    print(f"  Total words detected: {len(all_words)}")

    if not all_words:
        print("  Error: No words detected in audio")
        return False

    # Assign words to story segments based on text matching
    word_idx = 0
    matched_segments = 0

    for story_seg in story_segments:
        seg_text = story_seg["text"]
        seg_words = []
        seg_start = None
        seg_end = None

        # Collect words that match this segment's text
        remaining_text = seg_text
        start_word_idx = word_idx

        while word_idx < len(all_words) and remaining_text:
            word = all_words[word_idx]
            word_text = word["text"]

            # Check if this word is in the remaining text
            if word_text and word_text in remaining_text:
                if seg_start is None:
                    seg_start = word["start"]
                seg_end = word["end"]
                seg_words.append({
                    "text": word_text,
                    "start": word["start"],
                    "end": word["end"],
                })
                # Remove matched portion from remaining text
                idx = remaining_text.find(word_text)
                remaining_text = remaining_text[idx + len(word_text):]
                word_idx += 1
            elif not word_text.strip():
                # Skip empty words
                word_idx += 1
            else:
                # Word doesn't match - might be in next segment or misrecognized
                # Check if we've matched enough of the segment
                if len(remaining_text) < len(seg_text) * 0.3:
                    # We've matched most of the segment, move on
                    break
                else:
                    # Skip this word and try next
                    word_idx += 1

        # Update segment with timing data
        segment_ref = story_seg["segment_ref"]
        if seg_start is not None and seg_end is not None:
            segment_ref["audioStartTime"] = seg_start
            segment_ref["audioEndTime"] = seg_end
            segment_ref["audioWords"] = seg_words
            matched_segments += 1

    print(f"  Matched segments: {matched_segments}/{len(story_segments)}")

    # Save updated story
    save_story(story_path, story)
    print(f"  Saved timing data to {story_path.name}")

    return True


def main():
    parser = argparse.ArgumentParser(description="Align audio with story text using stable-ts")
    parser.add_argument("story_file", nargs="?", help="Path to story JSON file")
    parser.add_argument("--all", action="store_true", help="Process all stories with audio")
    parser.add_argument("--level", help="Process stories of specific JLPT level (e.g., N5)")
    parser.add_argument("--model", default=WHISPER_MODEL, help=f"Whisper model size (default: {WHISPER_MODEL})")
    args = parser.parse_args()

    # Load Whisper model
    print(f"Loading Whisper model: {args.model}")
    model = stable_whisper.load_model(args.model)
    print("Model loaded")

    if args.story_file:
        story_path = Path(args.story_file)
        if not story_path.exists():
            print(f"Error: File not found: {story_path}")
            sys.exit(1)
        align_story(story_path, model)

    elif args.all or args.level:
        for story_file in sorted(STORIES_DIR.glob("*.json")):
            story = load_story(story_file)

            # Filter by level if specified
            if args.level:
                story_level = story.get("metadata", {}).get("jlptLevel", "").upper()
                if story_level != args.level.upper():
                    continue

            # Skip if no audio
            if not story.get("metadata", {}).get("audioURL"):
                print(f"Skipping {story_file.name} - no audio")
                continue

            align_story(story_file, model)

    else:
        parser.print_help()
        print("\nExamples:")
        print("  python scripts/align_audio.py app/data/stories/n5_a_fun_weekend.json")
        print("  python scripts/align_audio.py --all")
        print("  python scripts/align_audio.py --level N5")


if __name__ == "__main__":
    main()
