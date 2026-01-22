"""
Audio generation service using Google Gemini TTS
Generates audio narration for Japanese graded reader stories.
"""
import os
import io
import wave
import logging
from pathlib import Path
from typing import Optional, List

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

# Directory for storing generated audio
AUDIO_DIR = Path(__file__).parent.parent.parent / "static" / "audio"

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
        chapters: List[dict],
        voice: Optional[str] = None
    ) -> Optional[dict]:
        """
        Generate audio for an entire story.

        Args:
            story_id: Unique story identifier
            chapters: List of chapter dicts with content
            voice: Voice name (optional, randomly selected if not provided)

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

        audio_path = await self._generate_audio(
            text=full_text,
            voice=voice,
            filename=f"{story_id}.mp3"
        )

        if audio_path:
            return {
                "audioURL": audio_path,
                "audioModel": GEMINI_MODEL,
                "audioPrompt": NARRATION_PROMPT.strip(),
                "audioVoice": voice
            }
        return None

    async def generate_chapter_audio(
        self,
        story_id: str,
        chapter_number: int,
        content: List[dict],
        voice: Optional[str] = None
    ) -> Optional[str]:
        """
        Generate audio for a single chapter.

        Args:
            story_id: Story identifier
            chapter_number: Chapter number
            content: List of segment dicts
            voice: Voice name (optional, randomly selected if not provided)

        Returns:
            CDN path to the audio file
        """
        if not self.is_configured:
            return None

        text = self._extract_text_from_segments(content)
        if not text:
            return None

        if voice is None:
            voice = select_voice()

        return await self._generate_audio(
            text=text,
            voice=voice,
            filename=f"{story_id}_ch{chapter_number}.mp3"
        )

    async def generate_segment_audio(
        self,
        segment_id: str,
        text: str,
        voice: Optional[str] = None
    ) -> Optional[str]:
        """
        Generate audio for a single segment/sentence.

        Args:
            segment_id: Segment identifier
            text: Japanese text to speak
            voice: Voice name (optional, randomly selected if not provided)

        Returns:
            CDN path to the audio file
        """
        if not self.is_configured or not text:
            return None

        if voice is None:
            voice = select_voice()

        return await self._generate_audio(
            text=text,
            voice=voice,
            filename=f"{segment_id}.mp3"
        )

    async def _generate_audio(
        self,
        text: str,
        voice: str,
        filename: str
    ) -> Optional[str]:
        """
        Generate audio using Google Gemini TTS API.

        Args:
            text: Text to convert to speech
            voice: Voice name (e.g., Aoede)
            filename: Output filename

        Returns:
            CDN path to the saved audio file
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
                )
            )

            # Extract PCM audio data from response
            audio_data = response.candidates[0].content.parts[0].inline_data.data

            # Ensure output directory exists
            AUDIO_DIR.mkdir(parents=True, exist_ok=True)
            filepath = AUDIO_DIR / filename

            # Convert PCM to MP3
            await self._save_as_mp3(audio_data, filepath)

            logger.info(f"Audio saved: {filepath.stat().st_size / 1024:.1f}KB")
            return f"/cdn/audio/{filename}"

        except Exception as e:
            logger.error(f"Audio generation failed: {e}")
            return None

    async def _save_as_mp3(self, pcm_data: bytes, output_path: Path) -> None:
        """
        Convert PCM audio data to MP3 and save using ffmpeg.

        Args:
            pcm_data: Raw PCM audio (24kHz, 16-bit, mono)
            output_path: Path to save MP3 file
        """
        import subprocess
        import tempfile

        # Save PCM as temporary WAV file
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = tmp.name
            with wave.open(tmp, "wb") as wf:
                wf.setnchannels(1)  # mono
                wf.setsampwidth(2)  # 16-bit
                wf.setframerate(24000)  # 24kHz
                wf.writeframes(pcm_data)

        try:
            # Convert to MP3 using ffmpeg
            result = subprocess.run(
                ["ffmpeg", "-y", "-i", tmp_path, "-b:a", "64k", str(output_path)],
                capture_output=True,
                text=True
            )
            if result.returncode != 0:
                logger.error(f"ffmpeg error: {result.stderr}")
        finally:
            # Clean up temp file
            Path(tmp_path).unlink(missing_ok=True)

    def _extract_story_text(self, chapters: List[dict]) -> str:
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

    def _extract_text_from_segments(self, segments: List[dict]) -> str:
        """Extract text from a list of segments"""
        return "\n".join(
            self._get_segment_text(seg)
            for seg in segments
            if self._get_segment_text(seg)
        )

    def _get_segment_text(self, segment: dict) -> str:
        """Get plain text from a segment, handling tokenized content"""
        # If segment has tokens, join surface forms
        if "tokens" in segment and segment["tokens"]:
            return "".join(
                token.get("surface", "")
                for token in segment["tokens"]
            )
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
