#!/usr/bin/env python3
"""
Story Retokenization Script

Retokenize all story JSON files with the current tokenizer.
Use this when switching to a new tokenizer or dictionary.

Usage:
    python scripts/retokenize_stories.py [options]

Options:
    --stories-dir PATH   Path to stories directory (default: ../Japanese Reader/Resources/Stories)
    --dry-run            Show what would be changed without modifying files
    --verbose            Show detailed output
    --single FILE        Retokenize a single file only
"""

import argparse
import json
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, ".")

from app.services.tokenizer import get_tokenizer_service


def tokenize_segments(segments: list, tokenizer) -> list:
    """Retokenize all segments in a list."""
    tokenized_segments = []

    for segment in segments:
        # Get the text to tokenize
        if "tokens" in segment and segment["tokens"]:
            # Already tokenized - extract text from tokens
            text = "".join(t.get("surface", "") for t in segment["tokens"])
        elif "text" in segment:
            text = segment["text"]
        else:
            tokenized_segments.append(segment)
            continue

        # Tokenize the text
        tokens = tokenizer.tokenize_text(text)

        # Convert tokens to dict format
        token_dicts = []
        for token in tokens:
            token_dict = {
                "surface": token.surface,
                "parts": [
                    {"text": p.text, "reading": p.reading} if p.reading else {"text": p.text}
                    for p in token.parts
                ]
                if token.parts
                else None,
                "baseForm": token.baseForm,
                "partOfSpeech": token.partOfSpeech,
            }
            token_dicts.append(token_dict)

        # Create new segment with tokens
        new_segment = {
            "id": segment.get("id", f"segment_{len(tokenized_segments)}"),
            "segmentType": segment.get("segmentType", "paragraph"),
            "tokens": token_dicts,
        }

        tokenized_segments.append(new_segment)

    return tokenized_segments


def tokenize_title(title: str, tokenizer) -> list:
    """Tokenize a title string and return token dicts."""
    tokens = tokenizer.tokenize_text(title)
    return [
        {
            "surface": token.surface,
            "parts": [
                {"text": p.text, "reading": p.reading} if p.reading else {"text": p.text}
                for p in token.parts
            ]
            if token.parts
            else None,
            "baseForm": token.baseForm,
            "partOfSpeech": token.partOfSpeech,
        }
        for token in tokens
    ]


def retokenize_story(story_data: dict, tokenizer, verbose: bool = False) -> dict:
    """Retokenize a story's content."""
    # Update metadata tokenizer source
    if "metadata" in story_data:
        story_data["metadata"]["tokenizerSource"] = "fugashi-ipadic"

        # Tokenize Japanese title if present
        if story_data["metadata"].get("titleJapanese"):
            story_data["metadata"]["titleTokens"] = tokenize_title(
                story_data["metadata"]["titleJapanese"], tokenizer
            )

    # Retokenize content segments
    if "content" in story_data and story_data["content"]:
        if verbose:
            print(f"  Retokenizing {len(story_data['content'])} content segments...")
        story_data["content"] = tokenize_segments(story_data["content"], tokenizer)

    # Retokenize chapter segments
    if "chapters" in story_data and story_data["chapters"]:
        for i, chapter in enumerate(story_data["chapters"]):
            if verbose:
                print(f"  Retokenizing chapter {i + 1}: {chapter.get('title', 'Untitled')}...")

            # Tokenize chapter title if present
            if chapter.get("titleJapanese"):
                chapter["titleTokens"] = tokenize_title(chapter["titleJapanese"], tokenizer)

            if "segments" in chapter:
                chapter["segments"] = tokenize_segments(chapter["segments"], tokenizer)
            elif "content" in chapter:
                chapter["content"] = tokenize_segments(chapter["content"], tokenizer)

    return story_data


def find_story_files(stories_dir: Path) -> list:
    """Find all JSON story files in the stories directory."""
    story_files = []

    for json_file in stories_dir.rglob("*.json"):
        # Skip non-story files
        if json_file.name.startswith("."):
            continue
        story_files.append(json_file)

    return sorted(story_files)


def main():
    parser = argparse.ArgumentParser(description="Retokenize story JSON files")
    parser.add_argument(
        "--stories-dir",
        type=Path,
        default=Path("../Japanese Reader/Resources/Stories"),
        help="Path to stories directory",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Show what would be changed without modifying files"
    )
    parser.add_argument("--verbose", "-v", action="store_true", help="Show detailed output")
    parser.add_argument("--single", type=Path, help="Retokenize a single file only")

    args = parser.parse_args()

    # Initialize tokenizer
    print("Initializing tokenizer...")
    tokenizer = get_tokenizer_service()

    if not tokenizer.is_available:
        print("ERROR: Tokenizer is not available")
        sys.exit(1)

    print("Tokenizer ready: fugashi with IPADIC dictionary")

    # Find story files
    if args.single:
        if not args.single.exists():
            print(f"ERROR: File not found: {args.single}")
            sys.exit(1)
        story_files = [args.single]
    else:
        stories_dir = args.stories_dir.resolve()
        if not stories_dir.exists():
            # Try alternative paths
            alt_paths = [
                Path("../../Japanese Reader/Resources/Stories"),
                Path("../../../Japanese Reader/Resources/Stories"),
            ]
            for alt in alt_paths:
                if alt.resolve().exists():
                    stories_dir = alt.resolve()
                    break
            else:
                print(f"ERROR: Stories directory not found: {stories_dir}")
                print("Try specifying --stories-dir with the correct path")
                sys.exit(1)

        print(f"\nScanning for stories in: {stories_dir}")
        story_files = find_story_files(stories_dir)

    if not story_files:
        print("No story files found")
        sys.exit(0)

    print(f"Found {len(story_files)} story files")

    if args.dry_run:
        print("\n[DRY RUN - No files will be modified]")

    # Process each story
    success_count = 0
    error_count = 0

    for story_file in story_files:
        try:
            print(f"\nProcessing: {story_file.name}")

            # Load story
            with open(story_file, encoding="utf-8") as f:
                story_data = json.load(f)

            # Validate it's a story file
            if "metadata" not in story_data or "id" not in story_data:
                if args.verbose:
                    print("  Skipping: Not a valid story file")
                continue

            # Retokenize
            story_data = retokenize_story(story_data, tokenizer, args.verbose)

            # Save
            if not args.dry_run:
                with open(story_file, "w", encoding="utf-8") as f:
                    json.dump(story_data, f, ensure_ascii=False, indent=2)
                print("  ✓ Saved")
            else:
                print("  Would save")

            success_count += 1

        except json.JSONDecodeError as e:
            print(f"  ✗ JSON error: {e}")
            error_count += 1
        except Exception as e:
            print(f"  ✗ Error: {e}")
            error_count += 1

    # Summary
    print("\n" + "=" * 40)
    print("SUMMARY")
    print("=" * 40)
    print(f"Processed: {success_count} files")
    if error_count > 0:
        print(f"Errors: {error_count} files")
    if args.dry_run:
        print("\n[DRY RUN - No files were modified]")

    sys.exit(0 if error_count == 0 else 1)


if __name__ == "__main__":
    main()
