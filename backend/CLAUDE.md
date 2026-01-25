# Backend CLAUDE.md

This file provides guidance for Claude Code when working on the Python backend.

## Project Overview

FastAPI backend for SanLang, handling:
- Story generation (text, images, audio)
- Batch content generation for vocabulary decks
- Audio alignment with stable-whisper
- Legacy iOS app support

## Essential Requirements

**See `docs/DEVELOPMENT.md` for detailed patterns.** Key points for backend:

### 1. Use Shared Compression Utilities

All media generation must use `app/services/generation/media.py`:

```python
from app.services.generation.media import get_audio_bytes_as_mp3, get_image_bytes_as_webp

# In-memory compression (preferred - for direct R2 upload)
mp3_bytes = get_audio_bytes_as_mp3(pcm_data, bitrate="64k")
webp_bytes = get_image_bytes_as_webp(image_data, quality=85, max_size=800)
```

### 2. Use Batch API for 5+ Items

```python
from app.services.generation import run_text_batch

results = await run_text_batch(prompts={...}, system_prompt="...", model="gemini-3-flash-preview")
```

### 3. Use Shared Language Configuration

```python
from app.config.languages import LANGUAGE_CODES, get_translation_targets_for, CODE_TO_ISO

targets = get_translation_targets_for("japanese")  # ["english", "french"]
```

### 4. Use JSON Schemas for Structured Output

```python
from pydantic import BaseModel

class OutputItem(BaseModel):
    word: str
    sentence: str

response = client.models.generate_content(
    model=model, contents=prompt,
    config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=list[OutputItem])
)
```

### 5. Use R2 Storage for Media Uploads

All media uploads go directly to R2 (no local files saved). Two structures:

**Flashcards:**
```
flashcards/{language}/{word}/
├── word.mp3              # Word pronunciation
├── sentence-{id}.mp3     # Sentence audio
└── image-{id}.webp       # Images
```

**Stories:**
```
stories/{language}/{storyId}/
├── story.json            # Full story content
├── cover.webp            # Cover image
├── chapter-{n}.webp      # Chapter images
└── audio.mp3             # Full story audio
```

```python
from app.services.storage import (
    # Flashcard uploads
    upload_word_audio, upload_sentence_audio, upload_word_image,
    # Story uploads
    upload_story_json, upload_story_cover, upload_story_chapter_image, upload_story_audio,
)

# Flashcard uploads
url = upload_word_audio(audio_bytes, word="食べる", language="japanese")
url = upload_sentence_audio(audio_bytes, word="食べる", language="japanese", sentence_id="abc123")
url = upload_word_image(image_bytes, word="食べる", language="japanese", image_id="xyz789")

# Story uploads
url = upload_story_json(json_bytes, story_id="abc123", language="japanese")
url = upload_story_cover(webp_bytes, story_id="abc123", language="japanese")
url = upload_story_chapter_image(webp_bytes, story_id="abc123", language="japanese", chapter_num=1)
url = upload_story_audio(mp3_bytes, story_id="abc123", language="japanese")
```

Required env vars (in `web/.env.local`): `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL`

### 6. Environment Variables

All Python scripts load environment from `web/.env.local` (shared with frontend):

```python
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).parent.parent.parent / "web" / ".env.local"
load_dotenv(env_path)
```

This ensures a single source of truth for all API keys and configuration

---

## Directory Structure

```
app/services/
├── storage.py            # R2 upload utilities (word-centric paths)
└── generation/
    ├── media.py          # Compression utilities (ALWAYS USE)
    ├── batch.py          # Google Batch API wrapper
    ├── audio_generator.py # TTS generation
    ├── image_generator.py # Image generation
    └── ...
```

---

## Development Commands

```bash
cd backend && source venv/bin/activate && python run.py  # Dev server
python scripts/batch_generate_deck.py --import-csv data/words.csv --type sentences  # Batch gen
```

---

## DO NOT

- Save files locally (upload directly to R2)
- Save audio as WAV or images as PNG (always compress to MP3/WebP)
- Store original/uncompressed files
- Make individual API calls for 5+ items (use Batch API)
- Hardcode language lists (use `app.config.languages`)
- Implement custom compression (use shared utilities)
