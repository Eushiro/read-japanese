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
from app.services.generation import compress_audio_to_mp3, compress_image_to_webp

compress_audio_to_mp3(pcm_data, output_path, bitrate="64k")  # Always MP3
compress_image_to_webp(image_data, output_path, quality=85)  # Always WebP
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

---

## Directory Structure

```
app/services/generation/
├── media.py              # Compression utilities (ALWAYS USE)
├── batch.py              # Google Batch API wrapper
├── audio_generator.py    # TTS generation
├── image_generator.py    # Image generation
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

- Save audio as WAV or images as PNG (always compress)
- Store original/uncompressed files
- Make individual API calls for 5+ items (use Batch API)
- Hardcode language lists (use `app.config.languages`)
- Implement custom compression (use shared utilities)
