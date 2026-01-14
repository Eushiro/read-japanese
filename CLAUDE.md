# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Read Japanese** is an iPad app for Japanese language learners with graded reading content (JLPT N5-N1). It consists of:
- **iOS Frontend**: SwiftUI app in `app/`
- **Python Backend**: FastAPI server in `backend/` deployed on Render

## Important: Do Not Over-Engineer

**Only make changes that are explicitly requested.**

- Do NOT change button appearances, colors, or styling unless asked
- Do NOT make headers sticky or add UI behaviors that weren't requested
- Do NOT refactor or "improve" code that isn't part of the task
- Do NOT add features, animations, or enhancements beyond what was asked
- Keep changes minimal and focused on the specific request

## Build and Run Commands

### Backend

```bash
# Setup (first time)
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run locally
cd backend && source venv/bin/activate && python run.py
# API at http://localhost:8000, docs at http://localhost:8000/docs
```

### iOS App

```bash
# Open in Xcode
open "Read Japanese.xcodeproj"
# Build and run: Cmd+R (select iPad simulator)
```

### Tests

```bash
# Backend tests
cd backend && source venv/bin/activate && pytest tests/

# Run single test
pytest tests/test_tokenizer.py::test_specific_function -v
```

## Deployment

**Backend is deployed on Render, not localhost.**

- The iOS app connects to `https://read-japanese.onrender.com` (configured in `app/Config/APIConfig.swift`)
- Changes to backend code or story JSON files must be pushed to GitHub to take effect
- Render auto-deploys on push to main branch
- Do NOT start a local backend server unless explicitly asked for local testing

## Architecture

### iOS App (`app/`)
- **State**: Single `AppState` class as `@EnvironmentObject` (global source of truth)
- **Services**: Singleton pattern for API, audio, cache, dictionary services
- **Views**: SwiftUI views in `Views/` organized by feature (Library, Reader, Settings, etc.)
- **Settings**: `@AppStorage` (UserDefaults) for user preferences

### Backend (`backend/app/`)
- **Routers**: API endpoints in `routers/` (stories, tokenize, generate, health)
- **Services**: Business logic in `services/` (story loading, tokenization, AI generation)
- **Data**: Story JSON files in `data/stories/`, static assets in `static/`
- **Media**: Served from `/cdn` endpoint (audio, images)

### Key Data Flow
1. Stories stored as JSON in `backend/app/data/stories/{level}_{slug}.json`
2. Backend loads/caches stories at startup via `StoryService`
3. iOS app fetches from `/api/stories` and caches locally
4. Tokens contain `parts` array with kanji/reading pairs for furigana rendering

## Key Files

- `app/Config/APIConfig.swift` - Backend URL (Render URL, not localhost)
- `app/State/AppState.swift` - Global app state
- `app/Views/Reader/ReaderView.swift` - Main reading interface (750+ lines)
- `app/Models/Story/Story.swift` - Core data models
- `backend/app/services/tokenizer.py` - Japanese tokenization with Sudachipy
- `backend/app/data/stories/*.json` - Story content files
- `backend/app/static/` - Audio and image files served via CDN

## Common Gotchas

1. **Story changes not appearing**: Push to GitHub, wait for Render deploy, then pull-to-refresh in app
2. **Premium toggle not visible**: Only shows in DEBUG builds (run from Xcode, not TestFlight)
3. **Images not loading**: Check URL resolution in StoryCard.swift and ReaderView.swift
4. **Cache issues**: Pull-to-refresh clears cache after successful response

## Testing Premium

1. Push code with `isPremium: true` in story JSONs
2. Wait for Render deploy
3. Pull to refresh in app
4. 5 stories should show lock overlay (one per JLPT level)
5. Use Developer section in Settings to toggle premium (DEBUG only)

## Utility Scripts

Backend scripts in `backend/scripts/`:
- `generate_audio.py` - Generate TTS narration
- `generate_story_images.py` - Create chapter illustrations
- `retokenize_stories.py` - Re-tokenize story JSON files
- `align_audio.py` - Align audio with timestamps
