"""
Shared media compression utilities for audio and image generation.

This module provides centralized compression functions to ensure all
generation pipelines output optimized media files. New pipelines should
use these utilities instead of implementing compression directly.

Audio: PCM/WAV -> MP3 (64kbps)
Images: PNG/JPEG -> WebP (quality 80-85)
"""

import io
import logging
import subprocess
import tempfile
import wave
from pathlib import Path

logger = logging.getLogger(__name__)


# ============================================
# AUDIO COMPRESSION
# ============================================


def compress_audio_to_mp3(
    pcm_data: bytes,
    output_path: Path,
    bitrate: str = "64k",
    sample_rate: int = 24000,
    channels: int = 1,
    sample_width: int = 2,
) -> Path:
    """
    Convert PCM audio data to MP3 format.

    This is the canonical way to save audio in the backend. All audio
    generation should use this function to ensure consistent compression.

    Args:
        pcm_data: Raw PCM audio bytes
        output_path: Path to save the MP3 file (should end in .mp3)
        bitrate: MP3 bitrate (default 64k for voice)
        sample_rate: PCM sample rate in Hz (default 24000 for Gemini TTS)
        channels: Number of audio channels (default 1 for mono)
        sample_width: Bytes per sample (default 2 for 16-bit)

    Returns:
        Path to the saved MP3 file

    Raises:
        RuntimeError: If ffmpeg conversion fails
    """
    # Ensure output has .mp3 extension
    if output_path.suffix.lower() != ".mp3":
        output_path = output_path.with_suffix(".mp3")

    # Create parent directory if needed
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Save PCM as temporary WAV file (ffmpeg input)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_path = Path(tmp.name)
        with wave.open(tmp, "wb") as wf:
            wf.setnchannels(channels)
            wf.setsampwidth(sample_width)
            wf.setframerate(sample_rate)
            wf.writeframes(pcm_data)

    try:
        # Convert to MP3 using ffmpeg
        result = subprocess.run(
            ["ffmpeg", "-y", "-i", str(tmp_path), "-b:a", bitrate, str(output_path)],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg error: {result.stderr}")

        # Log compression stats
        original_size = len(pcm_data)
        final_size = output_path.stat().st_size
        savings = (1 - final_size / original_size) * 100
        logger.info(
            f"Audio compressed: {original_size / 1024:.1f}KB -> {final_size / 1024:.1f}KB ({savings:.0f}% savings)"
        )

        return output_path

    finally:
        # Clean up temp file
        tmp_path.unlink(missing_ok=True)


def get_audio_bytes_as_mp3(
    pcm_data: bytes,
    bitrate: str = "64k",
    sample_rate: int = 24000,
) -> bytes:
    """
    Convert PCM audio data to MP3 and return as bytes.

    Use this when you need MP3 bytes for upload to cloud storage
    rather than saving to local filesystem.

    Args:
        pcm_data: Raw PCM audio bytes
        bitrate: MP3 bitrate (default 64k)
        sample_rate: PCM sample rate in Hz

    Returns:
        MP3 audio as bytes
    """
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        tmp_path = Path(tmp.name)

    try:
        compress_audio_to_mp3(pcm_data, tmp_path, bitrate, sample_rate)
        return tmp_path.read_bytes()
    finally:
        tmp_path.unlink(missing_ok=True)


# ============================================
# IMAGE COMPRESSION
# ============================================


def compress_image_to_webp(
    image_data: bytes,
    output_path: Path,
    quality: int = 85,
    max_size: int | None = 800,
) -> Path:
    """
    Compress an image to WebP format.

    This is the canonical way to save images in the backend. All image
    generation should use this function to ensure consistent compression.

    Args:
        image_data: Raw image bytes (PNG, JPEG, etc.)
        output_path: Path to save the WebP file (should end in .webp)
        quality: WebP quality (0-100, default 85)
        max_size: Maximum dimension in pixels (default 800, None to disable)

    Returns:
        Path to the saved WebP file
    """
    from PIL import Image

    # Ensure output has .webp extension
    if output_path.suffix.lower() != ".webp":
        output_path = output_path.with_suffix(".webp")

    # Create parent directory if needed
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Open and process image
    img = Image.open(io.BytesIO(image_data))

    # Convert color mode if needed
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    # Resize if needed
    if max_size and max(img.size) > max_size:
        img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

    # Save as WebP
    img.save(output_path, "WEBP", quality=quality, method=6)

    # Log compression stats
    original_size = len(image_data)
    final_size = output_path.stat().st_size
    savings = (1 - final_size / original_size) * 100
    logger.info(
        f"Image compressed: {original_size / 1024:.1f}KB -> {final_size / 1024:.1f}KB ({savings:.0f}% savings)"
    )

    return output_path


def get_image_bytes_as_webp(
    image_data: bytes,
    quality: int = 85,
    max_size: int | None = 800,
) -> bytes:
    """
    Compress an image to WebP and return as bytes.

    Use this when you need WebP bytes for upload to cloud storage
    rather than saving to local filesystem.

    Args:
        image_data: Raw image bytes (PNG, JPEG, etc.)
        quality: WebP quality (0-100, default 85)
        max_size: Maximum dimension in pixels (default 800, None to disable)

    Returns:
        WebP image as bytes
    """
    from PIL import Image

    img = Image.open(io.BytesIO(image_data))

    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    if max_size and max(img.size) > max_size:
        img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

    buffer = io.BytesIO()
    img.save(buffer, "WEBP", quality=quality, method=6)

    return buffer.getvalue()


def save_with_original(
    image_data: bytes,
    output_dir: Path,
    filename_base: str,
    quality: int = 85,
    max_size: int | None = 800,
) -> tuple[Path, Path]:
    """
    Save both original PNG and optimized WebP versions of an image.

    Args:
        image_data: Raw image bytes
        output_dir: Base directory for images
        filename_base: Base filename (without extension)
        quality: WebP quality
        max_size: Maximum dimension for WebP

    Returns:
        Tuple of (original_path, optimized_path)
    """
    # Create directories
    originals_dir = output_dir / "originals"
    originals_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Save original
    original_path = originals_dir / f"{filename_base}.png"
    with open(original_path, "wb") as f:
        f.write(image_data)

    # Save optimized
    optimized_path = output_dir / f"{filename_base}.webp"
    compress_image_to_webp(image_data, optimized_path, quality, max_size)

    return original_path, optimized_path
