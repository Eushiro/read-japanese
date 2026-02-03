"""
Centralized model configuration for the story generation pipeline.
All AI model selections can be configured via environment variables.
"""

import os


class ModelConfig:
    """Configuration for AI models used throughout the pipeline."""

    # OpenRouter config
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
    OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

    # Text model (story generation + image descriptions)
    # Gemini 2.5 Flash via OpenRouter
    TEXT_MODEL = os.getenv("TEXT_MODEL", "qwen/qwen3-next-80b-a3b-instruct:free")

    # Image generation model via OpenRouter
    IMAGE_MODEL = os.getenv("IMAGE_MODEL", "google/gemini-2.5-flash-image")

    # Legacy: Gemini API key (for direct Gemini access if needed)
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_AI_API_KEY")

    @classmethod
    def is_openrouter_configured(cls) -> bool:
        """Check if OpenRouter is configured."""
        return bool(cls.OPENROUTER_API_KEY)

    @classmethod
    def is_gemini_configured(cls) -> bool:
        """Check if Gemini is configured."""
        return bool(cls.GEMINI_API_KEY)
