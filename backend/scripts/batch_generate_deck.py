#!/usr/bin/env python3
"""
Batch Generate Deck Content

Generates sentences, audio, and images for premade vocabulary decks.
Uses Google Batch API for cost-efficient text generation (50% discount).

All media is uploaded directly to R2 - no local files are saved.

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

import argparse
import asyncio
import csv
import json
import logging
import os
import sys
from dataclasses import dataclass
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load environment variables from web/.env.local (shared with frontend)
from dotenv import load_dotenv

env_path = Path(__file__).parent.parent.parent / "web" / ".env.local"
load_dotenv(env_path)

from google import genai
from google.genai import types
from pydantic import BaseModel

from app.config.languages import (
    CODE_TO_ISO,
    LANGUAGE_NAMES,
    get_translation_targets_for,
)
from app.services.generation.batch import BatchJobRunner

# Import shared utilities
from app.services.generation.media import get_audio_bytes_as_mp3, get_image_bytes_as_webp
from app.services.storage import (
    upload_sentence_audio,
    upload_word_audio,
    upload_word_image,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
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
    reading: str | None = None
    definitions: list[str] = None
    language: str = "japanese"
    level: str = "N5"

    # Generated content
    sentence: str | None = None
    sentence_translations: dict[str, str] | None = None  # {"en": "...", "ja": "...", "fr": "..."}
    audio_url: str | None = None  # R2 URL for sentence audio
    word_audio_url: str | None = None  # R2 URL for word audio
    image_url: str | None = None  # R2 URL for image


@dataclass
class GeneratedSentence:
    """Result from sentence generation (dataclass for internal use)"""

    word: str
    sentence: str
    translations: dict[str, str]  # {"en": "...", "ja": "...", "fr": "..."}


# Pydantic model for structured output from Gemini
class SentenceOutputItem(BaseModel):
    """Pydantic model for Gemini structured output"""

    word: str
    sentence: str
    translations: dict[str, str]  # {"en": "...", "ja": "...", "fr": "..."}


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


# ============================================
# SENTENCE GENERATION (BATCH)
# ============================================


def build_multi_word_prompt(words: list[VocabWord], level: str, language: str) -> str:
    """
    Build a prompt for generating sentences for multiple words at once.
    Includes level-appropriate difficulty context and multi-language translations.

    Uses shared language config to determine translation targets.
    """
    lang_name = LANGUAGE_NAMES.get(language, "Japanese")
    level_info = LEVEL_CONTEXT.get(level, LEVEL_CONTEXT["N5"])

    # Build word list
    word_entries = []
    for i, w in enumerate(words):
        reading_part = f" ({w.reading})" if w.reading else ""
        defs = ", ".join(w.definitions) if w.definitions else "(no definition)"
        word_entries.append(f'{i + 1}. "{w.word}"{reading_part} - {defs}')

    word_list = "\n".join(word_entries)

    # Determine which translations to generate using shared config
    # get_translation_targets_for() returns full codes (e.g., ["english", "french"])
    translation_targets = get_translation_targets_for(language)

    # Convert to ISO codes for JSON keys (e.g., "en", "fr")
    translation_iso_codes = [CODE_TO_ISO[lang] for lang in translation_targets]

    # Build human-readable description (e.g., "English, French")
    translation_desc = ", ".join(LANGUAGE_NAMES[lang] for lang in translation_targets)

    # Build example JSON keys string (e.g., '"en": "...", "fr": "..."')
    example_translations = ", ".join(f'"{code}": "..."' for code in translation_iso_codes)

    prompt = f"""Generate example sentences for these {len(words)} {lang_name} vocabulary words.

DIFFICULTY LEVEL: {level} ({level_info["description"]})
- Grammar to use: {level_info["grammar"]}
- Vocabulary style: {level_info["vocab_hint"]}
- Sentence length: {level_info["sentence_length"]}

WORDS TO PROCESS:
{word_list}

REQUIREMENTS:
1. Each sentence must naturally use the target word
2. Sentences must be appropriate for {level} level learners
3. Use ONLY grammar and vocabulary that {level} learners would know
4. Make sentences memorable and useful for language learning
5. Provide accurate translations in: {translation_desc}

Respond with a JSON array of objects, one per word, in the same order as the input.
Include translations for all requested languages in a "translations" object.
Use ISO language codes as keys: {", ".join(translation_iso_codes)}

[
  {{"word": "食べる", "sentence": "毎日朝ごはんを食べます。", "translations": {{{example_translations}}}}},
  ...
]"""

    return prompt


async def generate_sentences_batch(
    words: list[VocabWord],
    level: str,
    language: str,
    use_batch_api: bool = True,
) -> list[GeneratedSentence]:
    """
    Generate sentences for a batch of words using Gemini.

    Args:
        words: List of vocabulary words to generate sentences for
        level: Difficulty level (N5-N1, A1-C2)
        language: Target language (japanese, english, french)
        use_batch_api: If True, use Google Batch API (50% cost savings, async).
                       If False, use synchronous API (faster for small batches).

    Returns:
        List of GeneratedSentence objects
    """
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY not set")

    # For very small batches (< 5 words), use synchronous API for speed
    # For larger batches (5+ words), use Batch API for 50% cost savings
    if not use_batch_api or len(words) < 5:
        return await _generate_sentences_sync(words, level, language)
    else:
        return await _generate_sentences_batch_api(words, level, language)


async def _generate_sentences_sync(
    words: list[VocabWord],
    level: str,
    language: str,
) -> list[GeneratedSentence]:
    """
    Generate sentences using synchronous API calls.
    Better for small batches where speed matters more than cost.
    """
    client = genai.Client(api_key=GEMINI_API_KEY)
    results = []

    # Process in batches of WORDS_PER_PROMPT
    for i in range(0, len(words), WORDS_PER_PROMPT):
        batch = words[i : i + WORDS_PER_PROMPT]
        logger.info(f"Processing batch {i // WORDS_PER_PROMPT + 1}: {len(batch)} words")

        prompt = build_multi_word_prompt(batch, level, language)

        try:
            response = client.models.generate_content(
                model=TEXT_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=list[SentenceOutputItem],
                ),
            )

            sentences_data = json.loads(response.text)

            for item in sentences_data:
                results.append(
                    GeneratedSentence(
                        word=item["word"],
                        sentence=item["sentence"],
                        translations=item.get("translations", {}),
                    )
                )

            logger.info(f"  Generated {len(sentences_data)} sentences")

        except Exception as e:
            logger.error(f"  Batch failed: {e}")
            for w in batch:
                results.append(GeneratedSentence(word=w.word, sentence="", translations={}))

    return results


async def _generate_sentences_batch_api(
    words: list[VocabWord],
    level: str,
    language: str,
) -> list[GeneratedSentence]:
    """
    Generate sentences using Google Batch API.
    50% cost savings, but asynchronous (may take minutes to hours).
    """
    logger.info(f"Using Batch API for {len(words)} words (50% cost savings)")

    runner = BatchJobRunner(api_key=GEMINI_API_KEY)
    results = []

    # Build batch requests - one request per group of words
    batch_requests = []
    word_batches = []  # Track which words are in each batch

    for i in range(0, len(words), WORDS_PER_PROMPT):
        batch = words[i : i + WORDS_PER_PROMPT]
        word_batches.append(batch)

        prompt = build_multi_word_prompt(batch, level, language)

        batch_requests.append(
            {
                "key": f"batch_{i // WORDS_PER_PROMPT}",
                "prompt": prompt,
            }
        )

    logger.info(f"Created {len(batch_requests)} batch requests")

    # System prompt for consistent JSON output
    system_prompt = """You are a language teacher creating example sentences for vocabulary flashcards.
Always respond with a JSON array of objects with "word", "sentence", and "translation" fields.
Make sentences appropriate for the specified difficulty level."""

    try:
        # Run batch job
        def on_progress(status):
            logger.info(f"Batch job status: {status.state}")

        responses = await runner.run_batch(
            requests=batch_requests,
            system_prompt=system_prompt,
            model=TEXT_MODEL,
            display_name=f"sentences_{language}_{level}",
            response_mime_type="application/json",
            on_progress=on_progress,
        )

        # Parse responses
        for batch_key, response_text in responses.items():
            batch_idx = int(batch_key.split("_")[1])
            batch = word_batches[batch_idx]

            try:
                sentences_data = json.loads(response_text)
                for item in sentences_data:
                    results.append(
                        GeneratedSentence(
                            word=item["word"],
                            sentence=item["sentence"],
                            translations=item.get("translations", {}),
                        )
                    )
            except json.JSONDecodeError:
                logger.error(f"Failed to parse response for {batch_key}")
                for w in batch:
                    results.append(GeneratedSentence(word=w.word, sentence="", translations={}))

        logger.info(f"Batch API completed: {len(results)} sentences generated")

    except Exception as e:
        logger.error(f"Batch API failed: {e}")
        logger.info("Falling back to synchronous API...")
        return await _generate_sentences_sync(words, level, language)

    return results


# ============================================
# AUDIO GENERATION (uploads directly to R2)
# ============================================

TTS_VOICES = ["Leda", "Aoede", "Alnilam", "Rasalgethi"]


async def generate_sentence_audio(
    text: str,
    word: str,
    language: str,
    item_id: str,
    voice: str = "Aoede",
) -> str | None:
    """
    Generate audio for a sentence using Gemini TTS and upload to R2.

    Returns R2 URL or None if failed.
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
            ),
        )

        # Extract PCM audio data
        pcm_data = response.candidates[0].content.parts[0].inline_data.data

        # Convert to MP3 in memory
        mp3_bytes = get_audio_bytes_as_mp3(pcm_data, bitrate="64k")

        # Upload to R2
        url = upload_sentence_audio(mp3_bytes, word, language, item_id)
        return url

    except Exception as e:
        logger.error(f"Audio generation failed: {e}")
        return None


async def generate_word_audio(
    word: str,
    language: str,
    voice: str = "Aoede",
) -> str | None:
    """
    Generate audio for a single word using Gemini TTS and upload to R2.

    Returns R2 URL or None if failed.
    """
    if not GEMINI_API_KEY:
        return None

    client = genai.Client(api_key=GEMINI_API_KEY)

    try:
        prompt = f"Read aloud clearly and slowly for language learners:\n\n{word}"

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
            ),
        )

        # Extract PCM audio data
        pcm_data = response.candidates[0].content.parts[0].inline_data.data

        # Convert to MP3 in memory
        mp3_bytes = get_audio_bytes_as_mp3(pcm_data, bitrate="64k")

        # Upload to R2
        url = upload_word_audio(mp3_bytes, word, language)
        return url

    except Exception as e:
        logger.error(f"Word audio generation failed: {e}")
        return None


# ============================================
# IMAGE GENERATION (uploads directly to R2)
# ============================================


async def generate_image(
    word: str, sentence: str, language: str, image_id: str, max_size: int = 400, quality: int = 80
) -> str | None:
    """
    Generate a flashcard image using Gemini and upload to R2.

    Returns R2 URL or None if failed.
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
            ),
        )

        # Extract image data
        image_data = response.candidates[0].content.parts[0].inline_data.data

        # Compress to WebP in memory
        webp_bytes = get_image_bytes_as_webp(image_data, quality=quality, max_size=max_size)

        # Upload to R2
        url = upload_word_image(webp_bytes, word, language, image_id)
        return url

    except Exception as e:
        logger.error(f"Image generation failed: {e}")
        return None


# ============================================
# CSV IMPORT
# ============================================


def load_words_from_csv(csv_path: Path, language: str, level: str) -> list[VocabWord]:
    """Load vocabulary words from a CSV file"""
    words = []

    with open(csv_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)

        for i, row in enumerate(reader):
            # Flexible column names
            word = row.get("word") or row.get("expression") or row.get("kanji") or ""
            reading = row.get("reading") or row.get("kana") or row.get("hiragana")
            definition = row.get("definition") or row.get("meaning") or row.get("english") or ""

            if not word.strip():
                continue

            words.append(
                VocabWord(
                    id=f"csv_{i}",
                    word=word.strip(),
                    reading=reading.strip() if reading else None,
                    definitions=[definition.strip()] if definition else [],
                    language=language,
                    level=level,
                )
            )

    logger.info(f"Loaded {len(words)} words from {csv_path}")
    return words


# ============================================
# OUTPUT MANAGEMENT (optional, for debugging)
# ============================================

# Output directory for results JSON (if save_results is enabled)
OUTPUT_DIR = Path(__file__).parent.parent / "generated"


def save_results_json(words: list[VocabWord], output_path: Path):
    """
    Save generated content to JSON for reference/debugging.
    Note: Media is already uploaded to R2, this just saves metadata.
    """
    data = []
    for w in words:
        data.append(
            {
                "id": w.id,
                "word": w.word,
                "reading": w.reading,
                "definitions": w.definitions,
                "language": w.language,
                "level": w.level,
                "sentence": w.sentence,
                "translations": w.sentence_translations or {},
                "audioUrl": w.audio_url,
                "wordAudioUrl": w.word_audio_url,
                "imageUrl": w.image_url,
            }
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    logger.info(f"Results saved to {output_path}")


# ============================================
# MAIN PIPELINE
# ============================================


async def run_pipeline(
    words: list[VocabWord],
    generate_sentences: bool = True,
    generate_audio_flag: bool = False,
    generate_images_flag: bool = False,
    count: int | None = None,
    use_batch_api: bool = True,
    save_results: bool = True,
):
    """
    Run the generation pipeline.
    All media is uploaded directly to R2 during generation.
    """

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
        sentences = await generate_sentences_batch(
            words, level, language, use_batch_api=use_batch_api
        )

        # Match results back to words
        word_map = {w.word: w for w in words}
        for sent in sentences:
            if sent.word in word_map and sent.sentence:
                word_map[sent.word].sentence = sent.sentence
                word_map[sent.word].sentence_translations = sent.translations

        success = sum(1 for w in words if w.sentence)
        logger.info(f"Sentences generated: {success}/{len(words)}")

    # Step 2: Generate audio and upload to R2
    if generate_audio_flag:
        logger.info("=== Generating Audio (uploading to R2) ===")

        for i, w in enumerate(words):
            if not w.sentence:
                continue

            logger.info(f"[{i + 1}/{len(words)}] Audio for: {w.word}")

            # Sentence audio -> R2
            audio_url = await generate_sentence_audio(
                text=w.sentence,
                word=w.word,
                language=w.language,
                item_id=w.id,
            )
            if audio_url:
                w.audio_url = audio_url
                logger.info(f"  Sentence audio uploaded: {audio_url}")

            # Word-only audio -> R2
            word_audio_url = await generate_word_audio(
                word=w.word,
                language=w.language,
            )
            if word_audio_url:
                w.word_audio_url = word_audio_url
                logger.info(f"  Word audio uploaded: {word_audio_url}")

    # Step 3: Generate images and upload to R2
    if generate_images_flag:
        logger.info("=== Generating Images (uploading to R2) ===")

        for i, w in enumerate(words):
            if not w.sentence:
                continue

            logger.info(f"[{i + 1}/{len(words)}] Image for: {w.word}")

            image_url = await generate_image(
                word=w.word,
                sentence=w.sentence,
                language=w.language,
                image_id=w.id,
            )
            if image_url:
                w.image_url = image_url
                logger.info(f"  Image uploaded: {image_url}")

    # Save results (optional, for debugging)
    if save_results:
        save_results_json(words, OUTPUT_DIR / "results.json")

    return words


# ============================================
# CLI
# ============================================


def main():
    parser = argparse.ArgumentParser(description="Batch generate deck content (uploads to R2)")
    parser.add_argument("--import-csv", type=Path, help="Import words from CSV file")
    parser.add_argument("--deck", type=str, help="Deck ID (for Convex integration)")
    parser.add_argument(
        "--language", type=str, default="japanese", choices=["japanese", "english", "french"]
    )
    parser.add_argument("--level", type=str, default="N5", help="Difficulty level (N5-N1 or A1-C2)")
    parser.add_argument(
        "--type", type=str, default="sentences", choices=["sentences", "audio", "images", "all"]
    )
    parser.add_argument("--count", type=int, help="Limit number of words to process")
    parser.add_argument(
        "--no-batch-api",
        action="store_true",
        help="Disable Batch API (faster for small batches, but full price)",
    )
    parser.add_argument(
        "--no-save",
        action="store_true",
        help="Don't save results.json (all media goes directly to R2)",
    )

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
    asyncio.run(
        run_pipeline(
            words=words,
            generate_sentences=args.type in ["sentences", "all"],
            generate_audio_flag=args.type in ["audio", "all"],
            generate_images_flag=args.type in ["images", "all"],
            count=args.count,
            use_batch_api=not args.no_batch_api,
            save_results=not args.no_save,
        )
    )


if __name__ == "__main__":
    main()
