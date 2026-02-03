"""
Content language configuration - single source of truth

Reads from shared/contentLanguages.json to ensure consistency between
frontend and backend. To add a new language, update that file.

Note: This is separate from UI/display language (i18n).
Content language = what the user is learning (Japanese, English, French)
"""

import json
from pathlib import Path

# Path to shared config
SHARED_CONFIG_PATH = Path(__file__).parent.parent.parent.parent / "shared" / "contentLanguages.json"


def _load_config() -> dict:
    """Load the shared languages config"""
    if not SHARED_CONFIG_PATH.exists():
        raise FileNotFoundError(
            f"Shared content languages config not found at {SHARED_CONFIG_PATH}. "
            "Make sure shared/contentLanguages.json exists."
        )
    with open(SHARED_CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


# Load config at module import time
_config = _load_config()

# Supported languages list
SUPPORTED_LANGUAGES: list[dict] = _config["supported"]

# Language codes (e.g., ["japanese", "english", "french"])
LANGUAGE_CODES: list[str] = [lang["code"] for lang in SUPPORTED_LANGUAGES]

# ISO codes (e.g., ["ja", "en", "fr"])
ISO_CODES: list[str] = [lang["isoCode"] for lang in SUPPORTED_LANGUAGES]

# Default language
DEFAULT_LANGUAGE: str = _config["default"]

# Languages to generate translations for
TRANSLATION_TARGETS: list[str] = _config["translationTargets"]

# Mapping helpers
LANGUAGE_NAMES: dict[str, str] = {lang["code"]: lang["name"] for lang in SUPPORTED_LANGUAGES}
LANGUAGE_NATIVE_NAMES: dict[str, str] = {
    lang["code"]: lang["nativeName"] for lang in SUPPORTED_LANGUAGES
}
CODE_TO_ISO: dict[str, str] = {lang["code"]: lang["isoCode"] for lang in SUPPORTED_LANGUAGES}
ISO_TO_CODE: dict[str, str] = {lang["isoCode"]: lang["code"] for lang in SUPPORTED_LANGUAGES}


def get_language_by_code(code: str) -> dict | None:
    """Get full language config by code"""
    for lang in SUPPORTED_LANGUAGES:
        if lang["code"] == code:
            return lang
    return None


def get_language_name(code: str) -> str:
    """Get English name for a language code"""
    return LANGUAGE_NAMES.get(code, code)


def get_levels_for_language(code: str) -> list[str]:
    """Get proficiency levels for a language"""
    lang = get_language_by_code(code)
    return lang["levels"] if lang else []


def is_valid_language(code: str) -> bool:
    """Check if a language code is supported"""
    return code in LANGUAGE_CODES


def get_translation_targets_for(source_language: str) -> list[str]:
    """Get languages to translate into (excludes source language)"""
    return [lang for lang in TRANSLATION_TARGETS if lang != source_language]
