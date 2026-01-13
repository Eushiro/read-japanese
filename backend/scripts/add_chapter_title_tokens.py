#!/usr/bin/env python3
"""Add titleTokens to chapter titles that don't have them."""
import json
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.tokenizer import get_tokenizer_service


def add_title_tokens_to_story(story_path: Path) -> bool:
    """Add titleTokens to chapters in a story file. Returns True if modified."""
    with open(story_path, 'r', encoding='utf-8') as f:
        story = json.load(f)

    modified = False
    tokenizer = get_tokenizer_service()

    chapters = story.get('chapters', [])
    for chapter in chapters:
        title = chapter.get('title', '')

        # Skip if already has titleTokens
        if chapter.get('titleTokens'):
            continue

        # Skip if title is empty or only ASCII
        if not title or all(ord(c) < 128 for c in title):
            continue

        # Tokenize the title
        tokens = tokenizer.tokenize_text(title)

        # Convert to dict format
        title_tokens = []
        for token in tokens:
            token_dict = {
                'surface': token.surface,
                'parts': [{'text': p.text, 'reading': p.reading} if p.reading else {'text': p.text} for p in (token.parts or [])],
                'baseForm': token.baseForm,
                'partOfSpeech': token.partOfSpeech
            }
            title_tokens.append(token_dict)

        chapter['titleTokens'] = title_tokens
        modified = True
        print(f"  Added titleTokens for: {title}")

    if modified:
        with open(story_path, 'w', encoding='utf-8') as f:
            json.dump(story, f, ensure_ascii=False, indent=2)

    return modified


def main():
    stories_dir = Path(__file__).parent.parent / 'app' / 'data' / 'stories'

    if len(sys.argv) > 1:
        # Process specific story
        story_file = sys.argv[1]
        if not story_file.endswith('.json'):
            story_file += '.json'
        story_path = stories_dir / story_file
        if story_path.exists():
            print(f"Processing {story_path.name}...")
            if add_title_tokens_to_story(story_path):
                print(f"  Updated!")
            else:
                print(f"  No changes needed.")
        else:
            print(f"Story not found: {story_path}")
    else:
        # Process all stories
        for story_path in sorted(stories_dir.glob('*.json')):
            print(f"Processing {story_path.name}...")
            if add_title_tokens_to_story(story_path):
                print(f"  Updated!")
            else:
                print(f"  No changes needed.")


if __name__ == '__main__':
    main()
