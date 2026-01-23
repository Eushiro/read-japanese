#!/usr/bin/env python3
"""
Batch Generate Deck Content

Generates sentences, audio, and images for premade vocabulary decks.
Uses Google Batch API for cost-efficient text generation (50% discount).

Usage:
    python scripts/batch_generate_deck.py --deck jlpt_n5 --type sentences --count 100
    python scripts/batch_generate_deck.py --deck jlpt_n5 --type audio --count 50
    python scripts/batch_generate_deck.py --deck jlpt_n5 --type images --count 20
    python scripts/batch_generate_deck.py --import-csv data/jlpt_n5.csv --deck jlpt_n5

Models:
    - Sentences: gemini-3-flash-preview (via Batch API)
    - Audio: gemini-2.5-flash-preview-tts
    - Images: gemini-2.5-flash-image
"""

import os
import sys
import json
import csv
import argparse
import asyncio
import logging
import tempfile
import subprocess
import wave
import io
from pathlib import Path
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, asdict

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from google import genai
from google.genai import types
from PIL import Image
import httpx
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============================================
# CONFIGURATION
# ============================================

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_AI_API_KEY")
CONVEX_URL = os.getenv("CONVEX_URL") or os.getenv("VITE_CONVEX_URL")
CONVEX_DEPLOY_KEY = os.getenv("CONVEX_DEPLOY_KEY")  # For admin mutations

# Models
TEXT_MODEL = "gemini-3-flash-preview"
TTS_MODEL = "gemini-2.5-flash-preview-tts"
IMAGE_MODEL = "gemini-2.5-flash-image"

# Batch settings
WORDS_PER_PROMPT = 20  # Number of words to batch in one prompt
BATCH_API_URL = "https://generativelanguage.googleapis.com/v1beta"

# Output directory for generated media
OUTPUT_DIR = Path(__file__).parent.parent / "generated"

# ============================================
# DATA CLASSES
# ============================================

@dataclass
class VocabWord:
    """A vocabulary word to generate content for"""
    id: str  # Convex ID or local ID
    word: str
    reading: Optional[str] = None
    definitions: List[str] = None
    language: str = "japanese"
    level: str = "N5"

    # Generated content
    sentence: Optional[str] = None
    sentence_translation: Optional[str] = None
    audio_path: Optional[str] = None
    word_audio_path: Optional[str] = None
    image_path: Optional[str] = None


@dataclass
class GeneratedSentence:
    """Result from sentence generation (dataclass for internal use)"""
    word: str
    sentence: str
    translation: str


# Pydantic model for structured output from Gemini
class SentenceOutputItem(BaseModel):
    """Pydantic model for Gemini structured output"""
    word: str
    sentence: str
    translation: str


# ============================================
# LEVEL CONTEXT FOR SENTENCE DIFFICULTY
# ============================================

LEVEL_CONTEXT = {
    # JLPT levels
    "N5": {
        "description": "absolute beginner",
        "grammar": "basic です/ます forms, simple particles (は、が、を、に、で), present/past tense",
        "vocab_hint": "use only common everyday words",
        "sentence_length": "short (5-10 words)",
    },
    "N4": {
        "description": "elementary",
        "grammar": "て-form, たい form, potential form, basic conditionals",
        "vocab_hint": "everyday vocabulary with some compound words",
        "sentence_length": "short to medium (8-15 words)",
    },
    "N3": {
        "description": "intermediate",
        "grammar": "passive, causative, various conditionals, より comparisons",
        "vocab_hint": "broader vocabulary including some abstract concepts",
        "sentence_length": "medium (10-20 words)",
    },
    "N2": {
        "description": "upper intermediate",
        "grammar": "complex grammar patterns, formal expressions, ようにする/ことにする",
        "vocab_hint": "formal and informal registers, idiomatic expressions",
        "sentence_length": "medium to long (15-25 words)",
    },
    "N1": {
        "description": "advanced",
        "grammar": "literary forms, classical grammar, nuanced expressions",
        "vocab_hint": "sophisticated vocabulary, proverbs, literary expressions",
        "sentence_length": "can be complex (20+ words)",
    },
    # CEFR levels (for English/French)
    "A1": {
        "description": "beginner",
        "grammar": "simple present, basic articles, simple questions",
        "vocab_hint": "very common words only",
        "sentence_length": "very short (5-8 words)",
    },
    "A2": {
        "description": "elementary",
        "grammar": "past tense, future with 'going to', comparatives",
        "vocab_hint": "everyday vocabulary",
        "sentence_length": "short (8-12 words)",
    },
    "B1": {
        "description": "intermediate",
        "grammar": "perfect tenses, conditionals, passive voice",
        "vocab_hint": "broader vocabulary including opinions",
        "sentence_length": "medium (12-18 words)",
    },
    "B2": {
        "description": "upper intermediate",
        "grammar": "complex sentences, subjunctive, advanced tenses",
        "vocab_hint": "abstract concepts, idiomatic expressions",
        "sentence_length": "medium to long (15-22 words)",
    },
    "C1": {
        "description": "advanced",
        "grammar": "nuanced grammar, formal/informal registers",
        "vocab_hint": "sophisticated vocabulary, nuance",
        "sentence_length": "can be complex",
    },
    "C2": {
        "description": "mastery",
        "grammar": "native-like complexity",
        "vocab_hint": "any vocabulary appropriate to context",
        "sentence_length": "natural length",
    },
}

LANGUAGE_NAMES = {
    "japanese": "Japanese",
    "english": "English",
    "french": "French",
}


# ============================================
# SENTENCE GENERATION (BATCH)
# ============================================

def build_multi_word_prompt(words: List[VocabWord], level: str, language: str) -> str:
    """
    Build a prompt for generating sentences for multiple words at once.
    Includes level-appropriate difficulty context.
    """
    lang_name = LANGUAGE_NAMES.get(language, "Japanese")
    level_info = LEVEL_CONTEXT.get(level, LEVEL_CONTEXT["N5"])

    # Build word list
    word_entries = []
    for i, w in enumerate(words):
        reading_part = f" ({w.reading})" if w.reading else ""
        defs = ", ".join(w.definitions) if w.definitions else "(no definition)"
        word_entries.append(f'{i+1}. "{w.word}"{reading_part} - {defs}')

    word_list = "\n".join(word_entries)

    prompt = f"""Generate example sentences for these {len(words)} {lang_name} vocabulary words.

DIFFICULTY LEVEL: {level} ({level_info['description']})
- Grammar to use: {level_info['grammar']}
- Vocabulary style: {level_info['vocab_hint']}
- Sentence length: {level_info['sentence_length']}

WORDS TO PROCESS:
{word_list}

REQUIREMENTS:
1. Each sentence must naturally use the target word
2. Sentences must be appropriate for {level} level learners
3. Use ONLY grammar and vocabulary that {level} learners would know
4. Make sentences memorable and useful for language learning
5. Provide accurate English translations

Respond with a JSON array of objects, one per word, in the same order as the input:
[
  {{"word": "食べる", "sentence": "毎日朝ごはんを食べます。", "translation": "I eat breakfast every day."}},
  ...
]"""

    return prompt


async def generate_sentences_batch(
    words: List[VocabWord],
    level: str,
    language: str
) -> List[GeneratedSentence]:
    """
    Generate sentences for a batch of words using Gemini.
    Groups words into batches of WORDS_PER_PROMPT.
    Uses Pydantic models for structured JSON output.
    """
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY not set")

    client = genai.Client(api_key=GEMINI_API_KEY)
    results = []

    # Process in batches
    for i in range(0, len(words), WORDS_PER_PROMPT):
        batch = words[i:i + WORDS_PER_PROMPT]
        logger.info(f"Processing batch {i // WORDS_PER_PROMPT + 1}: {len(batch)} words")

        prompt = build_multi_word_prompt(batch, level, language)

        try:
            response = client.models.generate_content(
                model=TEXT_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=list[SentenceOutputItem],
                )
            )

            # Parse response - with Pydantic schema, response.text is valid JSON
            response_text = response.text
            sentences_data = json.loads(response_text)

            for item in sentences_data:
                results.append(GeneratedSentence(
                    word=item["word"],
                    sentence=item["sentence"],
                    translation=item["translation"]
                ))

            logger.info(f"  Generated {len(sentences_data)} sentences")

        except Exception as e:
            logger.error(f"  Batch failed: {e}")
            # Mark failed words
            for w in batch:
                results.append(GeneratedSentence(
                    word=w.word,
                    sentence="",
                    translation=""
                ))

    return results


# ============================================
# AUDIO GENERATION (with compression)
# ============================================

TTS_VOICES = ["Leda", "Aoede", "Alnilam", "Rasalgethi"]

async def generate_audio(
    text: str,
    output_path: Path,
    voice: str = "Aoede"
) -> Optional[Path]:
    """
    Generate audio using Gemini TTS and compress to MP3.
    """
    if not GEMINI_API_KEY:
        return None

    client = genai.Client(api_key=GEMINI_API_KEY)

    try:
        prompt = f"Read aloud clearly and slowly for language learners:\n\n{text}"

        response = client.models.generate_content(
            model=TTS_MODEL,
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

        # Extract PCM audio data
        audio_data = response.candidates[0].content.parts[0].inline_data.data

        # Convert to MP3 using ffmpeg
        output_path.parent.mkdir(parents=True, exist_ok=True)
        mp3_path = output_path.with_suffix(".mp3")

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = Path(tmp.name)
            with wave.open(tmp, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(24000)
                wf.writeframes(audio_data)

        try:
            result = subprocess.run(
                ["ffmpeg", "-y", "-i", str(tmp_path), "-b:a", "64k", str(mp3_path)],
                capture_output=True,
                text=True
            )
            if result.returncode != 0:
                logger.error(f"ffmpeg error: {result.stderr}")
                return None
        finally:
            tmp_path.unlink(missing_ok=True)

        logger.info(f"Audio saved: {mp3_path.stat().st_size / 1024:.1f}KB")
        return mp3_path

    except Exception as e:
        logger.error(f"Audio generation failed: {e}")
        return None


# ============================================
# IMAGE GENERATION (with compression)
# ============================================

async def generate_image(
    word: str,
    sentence: str,
    language: str,
    output_path: Path,
    max_size: int = 400,
    quality: int = 80
) -> Optional[Path]:
    """
    Generate a flashcard image using Gemini and compress to WebP.
    """
    if not GEMINI_API_KEY:
        return None

    client = genai.Client(api_key=GEMINI_API_KEY)
    lang_name = LANGUAGE_NAMES.get(language, "Japanese")

    prompt = f"""Generate a simple, memorable illustration for a {lang_name} vocabulary flashcard.

Word: {word}
Context: {sentence}

The image should:
- Clearly represent the meaning of the word
- Be simple and clean (not cluttered)
- Use a friendly, educational style
- Have no text or letters
- Be colorful but not overwhelming
- Be suitable for language learning flashcards

Style: Simple vector-like illustration with clean lines."""

    try:
        response = client.models.generate_content(
            model=IMAGE_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
            )
        )

        # Extract image data
        image_data = response.candidates[0].content.parts[0].inline_data.data

        # Compress to WebP
        output_path.parent.mkdir(parents=True, exist_ok=True)
        webp_path = output_path.with_suffix(".webp")

        img = Image.open(io.BytesIO(image_data))
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        if max(img.size) > max_size:
            img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

        img.save(webp_path, 'WEBP', quality=quality, method=6)

        original_size = len(image_data)
        final_size = webp_path.stat().st_size
        logger.info(f"Image saved: {original_size/1024:.1f}KB -> {final_size/1024:.1f}KB")

        return webp_path

    except Exception as e:
        logger.error(f"Image generation failed: {e}")
        return None


# ============================================
# CSV IMPORT
# ============================================

def load_words_from_csv(csv_path: Path, language: str, level: str) -> List[VocabWord]:
    """Load vocabulary words from a CSV file"""
    words = []

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for i, row in enumerate(reader):
            # Flexible column names
            word = row.get('word') or row.get('expression') or row.get('kanji') or ''
            reading = row.get('reading') or row.get('kana') or row.get('hiragana')
            definition = row.get('definition') or row.get('meaning') or row.get('english') or ''

            if not word.strip():
                continue

            words.append(VocabWord(
                id=f"csv_{i}",
                word=word.strip(),
                reading=reading.strip() if reading else None,
                definitions=[definition.strip()] if definition else [],
                language=language,
                level=level,
            ))

    logger.info(f"Loaded {len(words)} words from {csv_path}")
    return words


# ============================================
# OUTPUT MANAGEMENT
# ============================================

def save_results_json(words: List[VocabWord], output_path: Path):
    """Save generated content to JSON for later Convex upload"""
    data = []
    for w in words:
        data.append({
            "id": w.id,
            "word": w.word,
            "reading": w.reading,
            "definitions": w.definitions,
            "language": w.language,
            "level": w.level,
            "sentence": w.sentence,
            "sentence_translation": w.sentence_translation,
            "audio_path": str(w.audio_path) if w.audio_path else None,
            "word_audio_path": str(w.word_audio_path) if w.word_audio_path else None,
            "image_path": str(w.image_path) if w.image_path else None,
        })

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    logger.info(f"Results saved to {output_path}")


# ============================================
# MAIN PIPELINE
# ============================================

async def run_pipeline(
    words: List[VocabWord],
    generate_sentences: bool = True,
    generate_audio_flag: bool = False,
    generate_images_flag: bool = False,
    count: Optional[int] = None,
    output_dir: Path = OUTPUT_DIR,
):
    """Run the generation pipeline"""

    # Limit count if specified
    if count and count < len(words):
        words = words[:count]

    logger.info(f"Processing {len(words)} words")

    # Get level from first word (assuming all same level)
    level = words[0].level if words else "N5"
    language = words[0].language if words else "japanese"

    # Step 1: Generate sentences
    if generate_sentences:
        logger.info("=== Generating Sentences ===")
        sentences = await generate_sentences_batch(words, level, language)

        # Match results back to words
        word_map = {w.word: w for w in words}
        for sent in sentences:
            if sent.word in word_map and sent.sentence:
                word_map[sent.word].sentence = sent.sentence
                word_map[sent.word].sentence_translation = sent.translation

        success = sum(1 for w in words if w.sentence)
        logger.info(f"Sentences generated: {success}/{len(words)}")

    # Step 2: Generate audio
    if generate_audio_flag:
        logger.info("=== Generating Audio ===")
        audio_dir = output_dir / "audio"

        for i, w in enumerate(words):
            if not w.sentence:
                continue

            logger.info(f"[{i+1}/{len(words)}] Audio for: {w.word}")

            # Sentence audio
            audio_path = await generate_audio(
                w.sentence,
                audio_dir / f"{w.id}_sentence",
            )
            if audio_path:
                w.audio_path = audio_path

            # Word-only audio
            word_audio_path = await generate_audio(
                w.word,
                audio_dir / f"{w.id}_word",
            )
            if word_audio_path:
                w.word_audio_path = word_audio_path

    # Step 3: Generate images
    if generate_images_flag:
        logger.info("=== Generating Images ===")
        image_dir = output_dir / "images"

        for i, w in enumerate(words):
            if not w.sentence:
                continue

            logger.info(f"[{i+1}/{len(words)}] Image for: {w.word}")

            image_path = await generate_image(
                w.word,
                w.sentence,
                w.language,
                image_dir / f"{w.id}",
            )
            if image_path:
                w.image_path = image_path

    # Save results
    save_results_json(words, output_dir / "results.json")

    return words


# ============================================
# CLI
# ============================================

def main():
    parser = argparse.ArgumentParser(description="Batch generate deck content")
    parser.add_argument("--import-csv", type=Path, help="Import words from CSV file")
    parser.add_argument("--deck", type=str, help="Deck ID (for Convex integration)")
    parser.add_argument("--language", type=str, default="japanese", choices=["japanese", "english", "french"])
    parser.add_argument("--level", type=str, default="N5", help="Difficulty level (N5-N1 or A1-C2)")
    parser.add_argument("--type", type=str, default="sentences", choices=["sentences", "audio", "images", "all"])
    parser.add_argument("--count", type=int, help="Limit number of words to process")
    parser.add_argument("--output", type=Path, default=OUTPUT_DIR, help="Output directory")

    args = parser.parse_args()

    # Load words
    if args.import_csv:
        words = load_words_from_csv(args.import_csv, args.language, args.level)
    else:
        # TODO: Load from Convex
        logger.error("Either --import-csv or Convex integration required")
        return

    if not words:
        logger.error("No words to process")
        return

    # Run pipeline
    asyncio.run(run_pipeline(
        words=words,
        generate_sentences=args.type in ["sentences", "all"],
        generate_audio_flag=args.type in ["audio", "all"],
        generate_images_flag=args.type in ["images", "all"],
        count=args.count,
        output_dir=args.output,
    ))


if __name__ == "__main__":
    main()
