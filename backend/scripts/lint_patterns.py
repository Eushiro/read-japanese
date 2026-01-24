#!/usr/bin/env python3
"""
Custom pattern checker for SanLang backend.

Enforces patterns documented in docs/DEVELOPMENT.md:
1. Use shared compression utilities (media.py)
2. Use shared language configuration (app.config.languages)
3. Don't save uncompressed media (PNG, WAV)

Run: python scripts/lint_patterns.py
"""

import re
import sys
from pathlib import Path

# Files that are allowed to have the patterns we're checking for
EXCLUDED_FILES = {
    "media.py",  # The compression utilities themselves
    "languages.py",  # The language config itself
    "lint_patterns.py",  # This script
}

# Directories to exclude
EXCLUDED_DIRS = {
    "venv",
    "__pycache__",
    ".git",
    "tests",  # Test files may have legitimate uses
}


def should_check_file(path: Path) -> bool:
    """Check if a file should be linted."""
    if path.name in EXCLUDED_FILES:
        return False
    if any(excluded in path.parts for excluded in EXCLUDED_DIRS):
        return False
    return path.suffix == ".py"


def check_file(path: Path) -> list[str]:
    """Check a single file for pattern violations."""
    violations = []

    try:
        content = path.read_text()
    except Exception as e:
        return [f"{path}: Could not read file: {e}"]

    lines = content.split("\n")

    for line_num, line in enumerate(lines, 1):
        # Skip comments and docstrings (basic heuristic)
        stripped = line.strip()
        if stripped.startswith("#") or stripped.startswith('"""') or stripped.startswith("'''"):
            continue

        # Check 1: Saving PNG without using compress_image_to_webp
        # Look for .save() calls with .png extension
        if re.search(r'\.save\([^)]*["\'].*\.png["\']', line, re.IGNORECASE):
            if "compress_image_to_webp" not in content:
                violations.append(
                    f"{path}:{line_num}: Saving PNG file directly. "
                    "Use compress_image_to_webp() from app.services.generation.media"
                )

        # Check 2: Creating WAV files without using compress_audio_to_mp3
        if re.search(r'["\'].*\.wav["\']', line, re.IGNORECASE):
            # Allow reading WAV (input), flag writing WAV (output)
            if any(write_pattern in line.lower() for write_pattern in [
                "open(", "write", "save", "export", "output"
            ]):
                if "compress_audio_to_mp3" not in content:
                    violations.append(
                        f"{path}:{line_num}: Writing WAV file. "
                        "Use compress_audio_to_mp3() from app.services.generation.media"
                    )

        # Check 3: Hardcoded language lists
        # Pattern: ["japanese", "english", "french"] or similar combinations
        # Skip Literal type definitions (they're a known pattern for type safety)
        is_literal_type = "Literal[" in line or "Literal [" in line

        if re.search(r'\[\s*["\']japanese["\']\s*,\s*["\']english["\']\s*,\s*["\']french["\']\s*\]', line, re.IGNORECASE):
            if is_literal_type:
                # Literal types are OK for now - they need the actual values
                # TODO: Consider exporting SupportedLanguage from languages.py
                pass
            else:
                violations.append(
                    f"{path}:{line_num}: Hardcoded language list. "
                    "Use LANGUAGE_CODES from app.config.languages"
                )

    return violations


def main():
    """Run pattern checks on all Python files in app/."""
    app_dir = Path(__file__).parent.parent / "app"

    if not app_dir.exists():
        print(f"Error: {app_dir} does not exist")
        sys.exit(1)

    all_violations = []
    files_checked = 0

    for py_file in app_dir.rglob("*.py"):
        if should_check_file(py_file):
            files_checked += 1
            violations = check_file(py_file)
            all_violations.extend(violations)

    # Summary
    print(f"Checked {files_checked} Python files")

    if all_violations:
        print(f"\n❌ Found {len(all_violations)} pattern violation(s):\n")
        for violation in all_violations:
            print(f"  {violation}")
        print("\nSee docs/DEVELOPMENT.md for correct patterns.")
        sys.exit(1)
    else:
        print("✅ No pattern violations found")
        sys.exit(0)


if __name__ == "__main__":
    main()
