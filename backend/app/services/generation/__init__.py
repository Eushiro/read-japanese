# Story generation services
from .story_generator import StoryGenerator
from .image_generator import ImageGenerator
from .audio_generator import AudioGenerator

# Shared media compression utilities
from .media import (
    compress_audio_to_mp3,
    compress_image_to_webp,
    get_audio_bytes_as_mp3,
    get_image_bytes_as_webp,
)

# Batch API utilities (50% cost savings for bulk generation)
from .batch import (
    BatchJobRunner,
    BatchJobStatus,
    BatchRequest,
    run_text_batch,
)

__all__ = [
    # Generators
    "StoryGenerator",
    "ImageGenerator",
    "AudioGenerator",
    # Media utilities - use these for all new pipelines
    "compress_audio_to_mp3",
    "compress_image_to_webp",
    "get_audio_bytes_as_mp3",
    "get_image_bytes_as_webp",
    # Batch API - use for bulk text generation (50% cost savings)
    "BatchJobRunner",
    "BatchJobStatus",
    "BatchRequest",
    "run_text_batch",
]
