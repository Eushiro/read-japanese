# Shared Configuration

This directory contains configuration files shared between the frontend (web/) and backend (backend/).

## Files

### languages.json

Canonical source of truth for supported languages. Used by:
- Frontend: `web/src/lib/languages.ts`
- Backend: `backend/app/config/languages.py`

**Structure:**
```json
{
  "supported": [
    {
      "code": "japanese",      // Full language code (used internally)
      "isoCode": "ja",         // ISO 639-1 code (for translations keys)
      "name": "Japanese",      // English name
      "nativeName": "日本語",   // Native name
      "flag": "🇯🇵",            // Emoji flag
      "levels": ["N5", ...]    // Proficiency levels
    }
  ],
  "default": "japanese",
  "translationTargets": ["english", "japanese", "french"]  // Languages for translations (full codes)
}
```

**Key Fields:**
- `code`: Full language code used throughout the app (e.g., "japanese", "english", "french")
- `isoCode`: ISO 639-1 code used as keys in translation objects (e.g., "ja", "en", "fr")
- `translationTargets`: Languages to generate translations into (uses full codes)

## Adding a New Language

1. Add the language to `languages.json` with all required fields
2. Run `cd web && bun run typecheck` to verify TypeScript types
3. Run `cd backend && python -c "from app.config.languages import LANGUAGE_CODES; print(LANGUAGE_CODES)"` to verify Python loading
4. Add i18n locale files in `web/src/lib/i18n/locales/<isoCode>/`
5. Update `EXAMS_BY_LANGUAGE` in `web/src/lib/languages.ts` if the language has standardized exams
6. Update `LANGUAGE_COLORS` in `web/src/lib/languages.ts` for video thumbnail placeholders

## Backend Utilities

The Python backend provides helper functions in `backend/app/config/languages.py`:

```python
from app.config.languages import (
    LANGUAGE_CODES,              # ["japanese", "english", "french"]
    ISO_CODES,                   # ["ja", "en", "fr"]
    LANGUAGE_NAMES,              # {"japanese": "Japanese", ...}
    CODE_TO_ISO,                 # {"japanese": "ja", ...}
    ISO_TO_CODE,                 # {"ja": "japanese", ...}
    TRANSLATION_TARGETS,         # ["english", "japanese", "french"]
    get_translation_targets_for, # Returns languages to translate into (excludes source)
    get_levels_for_language,     # Returns proficiency levels for a language
    is_valid_language,           # Check if a language code is supported
)
```
