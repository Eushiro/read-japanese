"""
R2 Storage Service

Uploads media files to Cloudflare R2 with word-centric organization.

Structure:
    flashcards/{language}/{word}/
    ├── word.mp3              # Word pronunciation
    ├── sentence-{id}.mp3     # Sentence audio
    └── image-{id}.webp       # Images
"""

import logging
import os
from pathlib import Path
from urllib.parse import quote

import boto3
from botocore.config import Config

logger = logging.getLogger(__name__)

# ============================================
# CONFIGURATION
# ============================================

R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME", "sanlang-media")
R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL", "")


def get_r2_client():
    """Get configured R2 client"""
    if not all([R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY]):
        raise ValueError(
            "R2 credentials not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY"
        )

    return boto3.client(
        "s3",
        endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


# ============================================
# PATH HELPERS
# ============================================


def get_word_folder_path(word: str, language: str) -> str:
    """
    Get the folder path for a word's media files.
    Format: flashcards/{language}/{word}
    Word is URL-encoded to handle special characters safely.
    """
    safe_word = quote(word, safe="")
    return f"flashcards/{language}/{safe_word}"


def get_word_audio_key(word: str, language: str) -> str:
    """Get R2 key for word pronunciation audio"""
    folder = get_word_folder_path(word, language)
    return f"{folder}/word.mp3"


def get_sentence_audio_key(word: str, language: str, sentence_id: str) -> str:
    """Get R2 key for sentence audio"""
    folder = get_word_folder_path(word, language)
    return f"{folder}/sentence-{sentence_id}.mp3"


def get_image_key(word: str, language: str, image_id: str) -> str:
    """Get R2 key for word image"""
    folder = get_word_folder_path(word, language)
    return f"{folder}/image-{image_id}.webp"


# ============================================
# UPLOAD FUNCTIONS
# ============================================


def upload_to_r2(
    data: bytes,
    key: str,
    content_type: str,
    cache_control: str = "public, max-age=31536000, immutable",
) -> str:
    """
    Upload data to R2 and return the public URL.

    Args:
        data: File bytes
        key: R2 object key (path)
        content_type: MIME type
        cache_control: Cache-Control header

    Returns:
        Public URL of the uploaded file
    """
    client = get_r2_client()

    client.put_object(
        Bucket=R2_BUCKET_NAME,
        Key=key,
        Body=data,
        ContentType=content_type,
        CacheControl=cache_control,
    )

    # Build public URL
    base_url = R2_PUBLIC_URL.rstrip("/")
    url = f"{base_url}/{key}"

    logger.info(f"Uploaded to R2: {key}")
    return url


def upload_word_audio(
    data: bytes,
    word: str,
    language: str,
) -> str:
    """
    Upload word pronunciation audio to R2.
    Path: flashcards/{language}/{word}/word.mp3
    """
    key = get_word_audio_key(word, language)
    return upload_to_r2(data, key, "audio/mpeg")


def upload_sentence_audio(
    data: bytes,
    word: str,
    language: str,
    sentence_id: str,
) -> str:
    """
    Upload sentence audio to R2.
    Path: flashcards/{language}/{word}/sentence-{id}.mp3
    """
    key = get_sentence_audio_key(word, language, sentence_id)
    return upload_to_r2(data, key, "audio/mpeg")


def upload_word_image(
    data: bytes,
    word: str,
    language: str,
    image_id: str,
) -> str:
    """
    Upload word image to R2.
    Path: flashcards/{language}/{word}/image-{id}.webp
    """
    key = get_image_key(word, language, image_id)
    return upload_to_r2(data, key, "image/webp")


# ============================================
# STORY PATH HELPERS
# ============================================


def get_story_folder_path(story_id: str, language: str) -> str:
    """
    Get the folder path for a story's media files.
    Format: stories/{language}/{story_id}
    """
    return f"stories/{language}/{story_id}"


def get_story_json_key(story_id: str, language: str) -> str:
    """Get R2 key for story JSON content"""
    folder = get_story_folder_path(story_id, language)
    return f"{folder}/story.json"


def get_story_cover_key(story_id: str, language: str) -> str:
    """Get R2 key for story cover image"""
    folder = get_story_folder_path(story_id, language)
    return f"{folder}/cover.webp"


def get_story_chapter_image_key(story_id: str, language: str, chapter_num: int) -> str:
    """Get R2 key for chapter image"""
    folder = get_story_folder_path(story_id, language)
    return f"{folder}/chapter-{chapter_num}.webp"


def get_story_audio_key(story_id: str, language: str) -> str:
    """Get R2 key for story audio"""
    folder = get_story_folder_path(story_id, language)
    return f"{folder}/audio.mp3"


# ============================================
# STORY UPLOAD FUNCTIONS
# ============================================


def upload_story_json(
    data: bytes,
    story_id: str,
    language: str,
) -> str:
    """
    Upload story JSON content to R2.
    Path: stories/{language}/{story_id}/story.json
    """
    key = get_story_json_key(story_id, language)
    return upload_to_r2(data, key, "application/json")


def upload_story_cover(
    data: bytes,
    story_id: str,
    language: str,
) -> str:
    """
    Upload story cover image to R2.
    Path: stories/{language}/{story_id}/cover.webp
    """
    key = get_story_cover_key(story_id, language)
    return upload_to_r2(data, key, "image/webp")


def upload_story_chapter_image(
    data: bytes,
    story_id: str,
    language: str,
    chapter_num: int,
) -> str:
    """
    Upload chapter image to R2.
    Path: stories/{language}/{story_id}/chapter-{n}.webp
    """
    key = get_story_chapter_image_key(story_id, language, chapter_num)
    return upload_to_r2(data, key, "image/webp")


def upload_story_audio(
    data: bytes,
    story_id: str,
    language: str,
) -> str:
    """
    Upload story audio to R2.
    Path: stories/{language}/{story_id}/audio.mp3
    """
    key = get_story_audio_key(story_id, language)
    return upload_to_r2(data, key, "audio/mpeg")


# ============================================
# FILE-BASED UPLOAD (for existing local files)
# ============================================


def upload_file(
    file_path: Path,
    word: str,
    language: str,
    file_type: str,
    item_id: str,
) -> str | None:
    """
    Upload a local file to R2 with word-centric organization.

    Args:
        file_path: Path to local file
        word: The vocabulary word
        language: Content language (japanese, english, french)
        file_type: One of "word_audio", "sentence_audio", "image"
        item_id: Unique ID for the item (used in filename)

    Returns:
        Public URL of uploaded file, or None if file doesn't exist
    """
    if not file_path.exists():
        logger.warning(f"File not found: {file_path}")
        return None

    data = file_path.read_bytes()

    if file_type == "word_audio":
        return upload_word_audio(data, word, language)
    elif file_type == "sentence_audio":
        return upload_sentence_audio(data, word, language, item_id)
    elif file_type == "image":
        return upload_word_image(data, word, language, item_id)
    else:
        raise ValueError(f"Unknown file_type: {file_type}")
