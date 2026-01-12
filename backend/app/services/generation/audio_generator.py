"""
Audio generation service using Eleven Labs TTS
Generates audio narration for Japanese graded reader stories.
"""
import os
import logging
from pathlib import Path
from typing import Optional, List
import httpx

logger = logging.getLogger(__name__)

# Directory for storing generated audio
AUDIO_DIR = Path(__file__).parent.parent.parent / "static" / "audio"

# Audio output format (Eleven Labs)
# Options: mp3_44100_128, mp3_44100_64, mp3_22050_32, pcm_16000, pcm_22050, pcm_24000, pcm_44100, ulaw_8000
AUDIO_FORMAT = "mp3_44100_64"  # 64kbps - good quality for speech, half the size of 128kbps

# Available Japanese voices on Eleven Labs
JAPANESE_VOICES = {
    "makoto": {
        "id": "6wdSVG3CMjPfAthsnMv9",
        "name": "Makoto",
        "gender": "male",
        "description": "Japanese male, narrative/story style"
    },
    "eiko": {
        "id": "GR4dBIFsYe57TxyrHKXz",
        "name": "Eiko",
        "gender": "female",
        "description": "Japanese female, clear pronunciation"
    },
    "akari": {
        "id": "EkK6wL8GaH8IgBZTTDGJ",
        "name": "Akari",
        "gender": "female",
        "description": "Japanese female, warm tone"
    }
}

DEFAULT_VOICE = "makoto"


class AudioGenerator:
    """Generates audio using Eleven Labs TTS"""

    def __init__(self):
        self.api_key = os.getenv("ELEVEN_LABS_API_KEY")
        self.base_url = "https://api.elevenlabs.io/v1"
        self.model_id = "eleven_multilingual_v2"

    @property
    def is_configured(self) -> bool:
        """Check if API key is configured"""
        return bool(self.api_key)

    async def generate_story_audio(
        self,
        story_id: str,
        chapters: List[dict],
        voice: str = DEFAULT_VOICE
    ) -> Optional[str]:
        """
        Generate audio for an entire story.

        Args:
            story_id: Unique story identifier
            chapters: List of chapter dicts with content
            voice: Voice name (makoto, eiko, akari)

        Returns:
            CDN path to the audio file, or None if generation failed
        """
        if not self.is_configured:
            logger.warning("Eleven Labs API key not configured")
            return None

        # Extract all text from chapters
        full_text = self._extract_story_text(chapters)

        if not full_text:
            logger.warning("No text to generate audio for")
            return None

        voice_config = JAPANESE_VOICES.get(voice.lower(), JAPANESE_VOICES[DEFAULT_VOICE])
        logger.info(f"Generating audio for {story_id} with voice {voice_config['name']}")

        audio_path = await self._generate_audio(
            text=full_text,
            voice_id=voice_config["id"],
            filename=f"{story_id}.mp3"
        )

        return audio_path

    async def generate_chapter_audio(
        self,
        story_id: str,
        chapter_number: int,
        content: List[dict],
        voice: str = DEFAULT_VOICE
    ) -> Optional[str]:
        """
        Generate audio for a single chapter.

        Args:
            story_id: Story identifier
            chapter_number: Chapter number
            content: List of segment dicts
            voice: Voice name

        Returns:
            CDN path to the audio file
        """
        if not self.is_configured:
            return None

        text = self._extract_text_from_segments(content)
        if not text:
            return None

        voice_config = JAPANESE_VOICES.get(voice.lower(), JAPANESE_VOICES[DEFAULT_VOICE])

        return await self._generate_audio(
            text=text,
            voice_id=voice_config["id"],
            filename=f"{story_id}_ch{chapter_number}.mp3"
        )

    async def generate_segment_audio(
        self,
        segment_id: str,
        text: str,
        voice: str = DEFAULT_VOICE
    ) -> Optional[str]:
        """
        Generate audio for a single segment/sentence.

        Args:
            segment_id: Segment identifier
            text: Japanese text to speak
            voice: Voice name

        Returns:
            CDN path to the audio file
        """
        if not self.is_configured or not text:
            return None

        voice_config = JAPANESE_VOICES.get(voice.lower(), JAPANESE_VOICES[DEFAULT_VOICE])

        return await self._generate_audio(
            text=text,
            voice_id=voice_config["id"],
            filename=f"{segment_id}.mp3"
        )

    async def _generate_audio(
        self,
        text: str,
        voice_id: str,
        filename: str
    ) -> Optional[str]:
        """
        Generate audio using Eleven Labs API.

        Args:
            text: Text to convert to speech
            voice_id: Eleven Labs voice ID
            filename: Output filename

        Returns:
            CDN path to the saved audio file
        """
        url = f"{self.base_url}/text-to-speech/{voice_id}?output_format={AUDIO_FORMAT}"

        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": self.api_key
        }

        data = {
            "text": text,
            "model_id": self.model_id,
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
                "style": 0.0,
                "use_speaker_boost": True
            }
        }

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(url, headers=headers, json=data)

                if response.status_code != 200:
                    logger.error(f"Eleven Labs API error: {response.status_code} - {response.text}")
                    return None

                # Save and compress audio file
                AUDIO_DIR.mkdir(parents=True, exist_ok=True)
                filepath = AUDIO_DIR / filename

                original_size = len(response.content)

                # Compress using pydub if available
                try:
                    import io
                    from pydub import AudioSegment

                    audio = AudioSegment.from_mp3(io.BytesIO(response.content))
                    # Export with lower bitrate for smaller file size
                    audio.export(filepath, format="mp3", bitrate="48k")
                    final_size = filepath.stat().st_size
                    logger.info(f"Audio compressed: {original_size/1024:.1f}KB -> {final_size/1024:.1f}KB")
                except ImportError:
                    # pydub not available, save as-is
                    with open(filepath, "wb") as f:
                        f.write(response.content)
                    logger.info(f"Audio saved: {original_size/1024:.1f}KB (no compression)")

                return f"/cdn/audio/{filename}"

        except Exception as e:
            logger.error(f"Audio generation failed: {e}")
            return None

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
        """Get list of available voices"""
        return JAPANESE_VOICES
