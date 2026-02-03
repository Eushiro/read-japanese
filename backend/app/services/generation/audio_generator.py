"""
Audio generation service using Google Gemini TTS
Generates audio narration for Japanese graded reader stories.

Audio is uploaded directly to R2 storage - no local files are saved.
"""

import logging
import os

from google import genai
from google.genai import types

from ..storage import upload_story_audio
from .media import get_audio_bytes_as_mp3

logger = logging.getLogger(__name__)

# Gemini TTS configuration
GEMINI_MODEL = "gemini-2.5-flash-preview-tts"

# Voice selection with weighted probabilities
# 30% Leda, 30% Aoede, 20% Alnilam, 20% Rasalgethi
VOICES = ["Leda", "Aoede", "Alnilam", "Rasalgethi"]
VOICE_WEIGHTS = [0.30, 0.30, 0.20, 0.20]

# Prompt for graded reader narration - kept simple to avoid text generation
NARRATION_PROMPT = "Read aloud clearly and slowly for language learners:\n\n"


def select_voice() -> str:
    """Select a random voice based on weighted probabilities."""
    import random

    return random.choices(VOICES, weights=VOICE_WEIGHTS, k=1)[0]


class AudioGenerator:
    """Generates audio using Google Gemini TTS"""

    def __init__(self):
        # Use GEMINI_API_KEY or fall back to GOOGLE_AI_API_KEY
        self.api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_AI_API_KEY")
        self.client = None
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)

    @property
    def is_configured(self) -> bool:
        """Check if API key is configured"""
        return self.client is not None

    async def generate_story_audio(
        self,
        story_id: str,
        chapters: list[dict],
        voice: str | None = None,
        language: str = "japanese",
    ) -> dict | None:
        """
        Generate audio for an entire story.
        Uploads directly to R2 - no local files saved.

        Args:
            story_id: Unique story identifier
            chapters: List of chapter dicts with content
            voice: Voice name (optional, randomly selected if not provided)
            language: Content language (for R2 path)

        Returns:
            Dict with audioURL and metadata, or None if generation failed
        """
        if not self.is_configured:
            logger.warning("Gemini API key not configured")
            return None

        # Extract all text from chapters
        full_text = self._extract_story_text(chapters)

        if not full_text:
            logger.warning("No text to generate audio for")
            return None

        # Select voice if not provided
        if voice is None:
            voice = select_voice()

        logger.info(f"Generating audio for {story_id} with voice {voice}")

        audio_url = await self._generate_and_upload_audio(
            text=full_text,
            voice=voice,
            story_id=story_id,
            language=language,
        )

        if audio_url:
            return {
                "audioURL": audio_url,
                "audioModel": GEMINI_MODEL,
                "audioPrompt": NARRATION_PROMPT.strip(),
                "audioVoice": voice,
            }
        return None

    async def generate_chapter_audio(
        self,
        story_id: str,
        chapter_number: int,
        content: list[dict],
        voice: str | None = None,
        language: str = "japanese",
    ) -> str | None:
        """
        Generate audio for a single chapter.
        Note: Currently not supported for R2 - story audio is generated as one file.

        Args:
            story_id: Story identifier
            chapter_number: Chapter number
            content: List of segment dicts
            voice: Voice name (optional, randomly selected if not provided)
            language: Content language

        Returns:
            R2 URL to the audio file, or None
        """
        if not self.is_configured:
            return None

        text = self._extract_text_from_segments(content)
        if not text:
            return None

        if voice is None:
            voice = select_voice()

        # For chapter audio, we'd need a different R2 path structure
        # For now, this returns the PCM bytes but doesn't upload
        logger.warning("Chapter-level audio upload not yet implemented for R2")
        return None

    async def generate_segment_audio(
        self,
        segment_id: str,
        text: str,
        voice: str | None = None,
    ) -> str | None:
        """
        Generate audio for a single segment/sentence.
        Note: Currently not supported for R2.

        Args:
            segment_id: Segment identifier
            text: Japanese text to speak
            voice: Voice name (optional, randomly selected if not provided)

        Returns:
            R2 URL to the audio file, or None
        """
        if not self.is_configured or not text:
            return None

        # Segment-level audio would need flashcard storage structure
        logger.warning("Segment-level audio upload not yet implemented for R2")
        return None

    async def _generate_and_upload_audio(
        self,
        text: str,
        voice: str,
        story_id: str,
        language: str,
    ) -> str | None:
        """
        Generate audio using Google Gemini TTS API and upload to R2.

        Args:
            text: Text to convert to speech
            voice: Voice name (e.g., Aoede)
            story_id: Story ID for R2 path
            language: Content language for R2 path

        Returns:
            R2 URL to the uploaded audio file
        """
        try:
            # Prepare the prompt with narration instructions
            prompt = NARRATION_PROMPT + text

            # Generate audio using Gemini TTS
            response = self.client.models.generate_content(
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
                ),
            )

            # Extract PCM audio data from response
            pcm_data = response.candidates[0].content.parts[0].inline_data.data

            # Convert PCM to MP3 in memory
            mp3_bytes = get_audio_bytes_as_mp3(pcm_data, bitrate="64k")

            # Upload to R2
            url = upload_story_audio(mp3_bytes, story_id, language)

            logger.info(f"Audio uploaded to R2: {len(mp3_bytes) / 1024:.1f}KB")
            return url

        except Exception as e:
            logger.error(f"Audio generation failed: {e}")
            return None

    def get_pcm_audio(self, text: str, voice: str) -> bytes | None:
        """
        Generate PCM audio without saving (for alignment or further processing).

        Args:
            text: Text to convert to speech
            voice: Voice name

        Returns:
            Raw PCM audio bytes (24kHz, 16-bit, mono) or None
        """
        try:
            prompt = NARRATION_PROMPT + text
            response = self.client.models.generate_content(
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
                ),
            )
            return response.candidates[0].content.parts[0].inline_data.data
        except Exception as e:
            logger.error(f"PCM audio generation failed: {e}")
            return None

    def _extract_story_text(self, chapters: list[dict]) -> str:
        """Extract all text from story chapters"""
        texts = []

        for chapter in chapters:
            # Add chapter title if available
            if chapter.get("titleJapanese"):
                texts.append(chapter["titleJapanese"])

            # Add content segments
            for segment in chapter.get("content", []):
                text = self._get_segment_text(segment)
                if text:
                    texts.append(text)

        return "\n".join(texts)

    def _extract_text_from_segments(self, segments: list[dict]) -> str:
        """Extract text from a list of segments"""
        return "\n".join(
            self._get_segment_text(seg) for seg in segments if self._get_segment_text(seg)
        )

    def _get_segment_text(self, segment: dict) -> str:
        """Get plain text from a segment, handling tokenized content"""
        # If segment has tokens, join surface forms
        if "tokens" in segment and segment["tokens"]:
            return "".join(token.get("surface", "") for token in segment["tokens"])
        return segment.get("text", "")

    @staticmethod
    def get_available_voices() -> dict:
        """Get list of available Gemini TTS voices with selection weights"""
        return {
            "Leda": {"weight": 0.30},
            "Aoede": {"weight": 0.30},
            "Alnilam": {"weight": 0.20},
            "Rasalgethi": {"weight": 0.20},
        }
