#!/usr/bin/env python3
"""
Generate audio for stories using Google Gemini TTS API.

Usage:
    export GEMINI_API_KEY=your_api_key
    python scripts/generate_audio.py [--level N5] [--story story_id] [--list]

Environment Variables:
    GEMINI_API_KEY - Your Google AI API key (required)
"""

import os
import io
import json
import wave
import asyncio
import sys
from pathlib import Path
from typing import Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv

# Load environment variables from web/.env.local (shared with frontend)
env_path = Path(__file__).parent.parent.parent / "web" / ".env.local"
load_dotenv(env_path)

# Import Google GenAI
try:
    from google import genai
    from google.genai import types
except ImportError:
    print("Error: google-genai not installed. Run: pip install google-genai")
    sys.exit(1)

import subprocess
import tempfile

# Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_AI_API_KEY")
GEMINI_MODEL = "gemini-2.5-flash-preview-tts"

# Voice selection with weighted probabilities
# 30% Leda, 30% Aoede, 20% Alnilam, 20% Rasalgethi
VOICES = ["Leda", "Aoede", "Alnilam", "Rasalgethi"]
VOICE_WEIGHTS = [0.30, 0.30, 0.20, 0.20]

# Prompt for expressive narration
NARRATION_PROMPT = "You are a skilled storyteller reading a story aloud. Use natural emotion and emphasis to bring the story to life while maintaining clear pronunciation. Pause briefly between sentences.\n\n"


def select_voice() -> str:
    """Select a random voice based on weighted probabilities."""
    import random
    return random.choices(VOICES, weights=VOICE_WEIGHTS, k=1)[0]

# Paths
STORIES_DIR = Path(__file__).parent.parent / "app" / "data" / "stories"
AUDIO_DIR = Path(__file__).parent.parent / "app" / "static" / "audio"
AUDIO_ORIGINALS_DIR = AUDIO_DIR / "originals"


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


def save_audio(pcm_data: bytes, output_path: Path) -> bool:
    """Save PCM audio as WAV original and MP3 for serving."""
    # Ensure directories exist
    output_path.parent.mkdir(parents=True, exist_ok=True)
    AUDIO_ORIGINALS_DIR.mkdir(parents=True, exist_ok=True)

    # Save WAV original
    wav_path = AUDIO_ORIGINALS_DIR / output_path.with_suffix(".wav").name
    with wave.open(str(wav_path), "wb") as wf:
        wf.setnchannels(1)  # mono
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(24000)  # 24kHz
        wf.writeframes(pcm_data)
    print(f"  WAV original saved: {wav_path.name}")

    try:
        # Convert to MP3 using ffmpeg
        result = subprocess.run(
            ["ffmpeg", "-y", "-i", str(wav_path), "-b:a", "64k", str(output_path)],
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            print(f"  ffmpeg error: {result.stderr}")
            return False
        return True
    except Exception as e:
        print(f"  Error saving audio: {e}")
        return False


def generate_audio(client: genai.Client, text: str, output_path: Path, voice: str) -> bool:
    """Generate audio using Gemini TTS API."""
    try:
        prompt = NARRATION_PROMPT + text

        print(f"  Calling Gemini TTS API with voice: {voice}...")
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=voice,
                        )
                    )
                ),
            )
        )

        # Extract PCM audio data from response
        audio_data = response.candidates[0].content.parts[0].inline_data.data

        # Save to file
        return save_audio(audio_data, output_path)

    except Exception as e:
        print(f"  Error generating audio: {e}")
        return False


def generate_story_audio(client: genai.Client, story_id: str) -> bool:
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

    # Select random voice
    voice = select_voice()

    # Generate full story audio
    audio_filename = f"{story_id}.mp3"
    audio_path = AUDIO_DIR / audio_filename

    success = generate_audio(client, full_text, audio_path, voice)

    if success:
        # Update story JSON with audio metadata
        story_data["metadata"]["audioURL"] = f"/cdn/audio/{audio_filename}"
        story_data["metadata"]["audioModel"] = GEMINI_MODEL
        story_data["metadata"]["audioPrompt"] = NARRATION_PROMPT.strip()
        story_data["metadata"]["audioVoice"] = voice
        save_story(story_file, story_data)

        file_size = audio_path.stat().st_size / 1024
        print(f"  Audio saved: {audio_path} ({file_size:.1f}KB)")
        print(f"  Model: {GEMINI_MODEL}")
        print(f"  Voice: {voice}")
        return True

    return False


def generate_all_audio(client: genai.Client, level: Optional[str] = None):
    """Generate audio for all stories (optionally filtered by level)."""
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

        generate_story_audio(client, story_id)

        # Rate limit - wait between requests
        print("  Waiting 1 second before next request...")
        import time
        time.sleep(1)


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Generate audio for stories using Gemini TTS")
    parser.add_argument("--level", help="Filter by JLPT level (e.g., N5)")
    parser.add_argument("--story", help="Generate audio for specific story ID")
    parser.add_argument("--list", action="store_true", help="List stories and their audio status")
    args = parser.parse_args()

    if args.list:
        list_stories()
        return

    if not GEMINI_API_KEY:
        print("=" * 60)
        print("GEMINI_API_KEY not set!")
        print()
        print("To generate audio, set your API key:")
        print("  export GEMINI_API_KEY=your_api_key_here")
        print()
        print("You can also add it to web/.env.local file")
        print("Get your key from: https://aistudio.google.com/app/apikey")
        print("=" * 60)
        print()
        list_stories()
        return

    # Initialize client
    client = genai.Client(api_key=GEMINI_API_KEY)

    if args.story:
        generate_story_audio(client, args.story)
    else:
        generate_all_audio(client, args.level)


if __name__ == "__main__":
    main()
