# Read Japanese - Architecture Guide

A comprehensive guide for AI agents and developers to understand and navigate the codebase.

## Project Overview

**Read Japanese** is a Japanese graded reader iPad app with:
- **iOS Frontend**: SwiftUI app targeting iPad
- **Python Backend**: FastAPI server serving stories, audio, and images

## Directory Structure

```
Read Japanese/
├── app/                              # iOS SwiftUI Application
│   ├── AppMain.swift                 # App entry point (@main)
│   ├── ContentView.swift             # Root view wrapper
│   ├── Config/
│   │   └── APIConfig.swift           # Backend URL configuration
│   ├── Models/
│   │   ├── Story/
│   │   │   ├── Story.swift           # Core data models (Story, StoryMetadata, Chapter, Token, etc.)
│   │   │   └── JLPTLevel.swift       # JLPT level enum (N5-N1) with colors
│   │   ├── Vocabulary/
│   │   │   └── WordDefinition.swift  # Dictionary lookup models (Jisho API)
│   │   └── JapaneseFont.swift        # Font options enum
│   ├── State/
│   │   └── AppState.swift            # Global state container (@EnvironmentObject)
│   ├── Services/
│   │   ├── StoryService.swift        # Story fetching from backend
│   │   ├── StoryCacheService.swift   # Offline caching
│   │   ├── DictionaryService.swift   # Jisho.org word lookup
│   │   ├── AudioPlayerService.swift  # Audio playback management
│   │   ├── AudioCacheService.swift   # Audio file caching
│   │   ├── AuthService.swift         # Google Sign-In (partial)
│   │   └── AnalyticsService.swift    # Event tracking (stub)
│   ├── Views/
│   │   ├── Root/
│   │   │   └── MainTabView.swift     # Tab bar (Library, Vocabulary)
│   │   ├── Library/
│   │   │   ├── LibraryView.swift     # Story list with filtering
│   │   │   ├── StoryCard.swift       # Story preview card component
│   │   │   ├── PremiumLockOverlay.swift  # Lock icon for premium stories
│   │   │   └── BookFlipAnimation.swift   # Page turn animation
│   │   ├── Reader/
│   │   │   ├── ReaderView.swift      # Main reading interface (750+ lines)
│   │   │   ├── FuriganaTextView.swift    # Ruby text rendering
│   │   │   ├── AutoScrollView.swift      # Long-press auto-scroll
│   │   │   ├── WordActionTooltip.swift   # Tap word actions
│   │   │   ├── WordDefinitionPopup.swift # Dictionary popup
│   │   │   ├── AudioPlayerBar.swift      # Audio controls
│   │   │   └── ReaderSettingsSheet.swift # In-reader settings
│   │   ├── Vocabulary/
│   │   │   └── VocabularyListView.swift  # Saved words list
│   │   ├── Settings/
│   │   │   └── SettingsView.swift    # App settings (fonts, theme, etc.)
│   │   ├── Subscription/
│   │   │   └── PaywallView.swift     # Premium subscription paywall
│   │   ├── Auth/
│   │   │   └── LoginView.swift       # Sign-in screen
│   │   └── Theme/
│   │       └── Colors.swift          # Color definitions
│   ├── Utils/
│   │   └── RomajiConverter.swift     # Romaji → Hiragana conversion
│   └── Resources/                    # Assets, fonts, etc.
│
├── backend/                          # Python FastAPI Backend
│   ├── app/
│   │   ├── main.py                   # FastAPI app setup, CORS, routers
│   │   ├── routers/
│   │   │   ├── health.py             # GET /health
│   │   │   ├── stories.py            # GET /api/stories, /api/stories/{id}
│   │   │   ├── tokenize.py           # POST /api/tokenize
│   │   │   └── generate.py           # POST /api/generate (story generation)
│   │   ├── models/
│   │   │   └── story.py              # Pydantic models (Story, Chapter, Token, etc.)
│   │   ├── services/
│   │   │   ├── story_service.py      # Load/cache stories from JSON files
│   │   │   ├── tokenizer.py          # Sudachipy Japanese tokenization
│   │   │   └── generation/
│   │   │       ├── pipeline.py       # Full story generation pipeline
│   │   │       ├── story_generator.py    # Claude AI story writing
│   │   │       ├── image_generator.py    # DALL-E 3 chapter images
│   │   │       └── audio_generator.py    # TTS audio generation
│   │   ├── data/
│   │   │   └── stories/              # JSON story files (n5_*.json, n4_*.json, etc.)
│   │   └── static/
│   │       ├── audio/                # MP3 narration files
│   │       └── images/               # PNG chapter images
│   ├── requirements.txt
│   └── run.py                        # Server entry point
│
├── PRD.md                            # Product requirements document
├── README.md                         # Project readme
└── docs/
    ├── ARCHITECTURE.md               # This file
    └── ROADMAP.md                    # Feature roadmap
```

---

## iOS App Architecture

### State Management

The app uses SwiftUI's `@EnvironmentObject` pattern for global state:

```swift
// AppState is the single source of truth
@MainActor
class AppState: ObservableObject {
    @Published var stories: [Story] = []           // All loaded stories
    @Published var readingProgress: [String: ReadingProgress] = [:]
    @Published var vocabularyItems: [VocabularyItem] = []
    @Published var isPremiumUser: Bool = false
}
```

**Access pattern**: Views inject `@EnvironmentObject var appState: AppState`

### Key Data Models

Located in `app/Models/Story/Story.swift`:

| Model | Purpose |
|-------|---------|
| `Story` | Complete story with metadata, chapters, vocabulary |
| `StoryMetadata` | Title, author, JLPT level, word count, genre, cover image, isPremium |
| `Chapter` | Chapter content with title, segments, image URL |
| `ContentSegment` | Paragraph or dialogue with tokenized text |
| `Token` | Single word with surface form, reading, base form, POS |
| `TokenPart` | Kanji/reading pairs for furigana |

### View Hierarchy

```
AppMain
└── ContentView
    └── MainTabView (TabView)
        ├── Tab 0: LibraryView
        │   └── StoryCard (for each story)
        │       └── PremiumLockOverlay (if locked)
        └── Tab 1: VocabularyListView

        (Sheet) SettingsView
        (Sheet) PaywallView

        (NavigationDestination) ReaderView
            ├── FuriganaTextView (text with ruby)
            ├── AutoScrollView (scrollable content)
            ├── WordActionTooltip (on word tap)
            ├── WordDefinitionPopup / CompactDefinitionView
            ├── AudioPlayerBar (if story has audio)
            └── ReaderSettingsSheet
```

### Reading Modes

`ReaderView.swift` supports two modes (controlled by `@AppStorage("chapterViewMode")`):

1. **Paged Mode** (`"paged"`): Swipe left/right between chapters
2. **Continuous Mode** (`"continuous"`): Scroll through all chapters vertically

Key functions:
- `pagedTabView` - TabView-based chapter navigation
- `continuousScrollView` - ScrollView with all chapters
- `calculateChapterOffset` - Compute scroll position for chapter jump

### Services

| Service | Purpose |
|---------|---------|
| `StoryService` | Fetches stories from backend, handles caching |
| `StoryCacheService` | Persists story JSON to disk for offline access |
| `DictionaryService` | Looks up words via Jisho.org API |
| `AudioPlayerService` | AVPlayer wrapper for audio playback |
| `AuthService` | Google Sign-In integration (partial) |
| `AnalyticsService` | Event tracking stub |

### Settings Storage

User preferences are stored via `@AppStorage` (UserDefaults):

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `fontSize` | Double | 20.0 | Text size in points |
| `fontName` | String | "System" | Selected Japanese font |
| `showFurigana` | Bool | true | Show/hide ruby text |
| `colorScheme` | String | "system" | Theme preference |
| `chapterViewMode` | String | "paged" | Reading mode |
| `autoScrollSpeed` | Double | 300.0 | Points per second |
| `showEnglishTitles` | Bool | false | Show English below Japanese |

---

## Backend Architecture

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/stories` | List all stories (optional `?level=N5` filter) |
| GET | `/api/stories/{id}` | Get full story by ID |
| POST | `/api/stories/reload` | Reload stories from disk |
| POST | `/api/tokenize` | Tokenize Japanese text |
| POST | `/api/generate/story` | Generate new story with AI |

### Story Data Flow

1. Stories stored as JSON in `backend/app/data/stories/`
2. `StoryService` loads and caches all stories at startup
3. iOS app fetches via `/api/stories` endpoint
4. Stories cached locally via `StoryCacheService`

### Story JSON Format

```json
{
  "id": "n5_my_morning",
  "metadata": {
    "title": "My Morning",
    "titleJapanese": "わたしの朝",
    "author": "claude-3.5-sonnet",
    "jlptLevel": "N5",
    "wordCount": 85,
    "characterCount": 180,
    "genre": "Daily Life",
    "tags": ["morning", "routine"],
    "summary": "A student describes their morning.",
    "coverImageURL": "/cdn/images/n5_my_morning_cover.png",
    "isPremium": false
  },
  "chapters": [
    {
      "id": "chapter_1",
      "title": "起きる時間",
      "titleEnglish": "Wake-up Time",
      "imageURL": "/cdn/images/n5_my_morning_ch1.png",
      "segments": [
        {
          "id": "p1",
          "segmentType": "paragraph",
          "tokens": [
            {
              "surface": "毎朝",
              "parts": [
                {"text": "毎", "reading": "まい"},
                {"text": "朝", "reading": "あさ"}
              ],
              "baseForm": "毎朝",
              "partOfSpeech": "noun"
            }
          ]
        }
      ]
    }
  ]
}
```

### Generation Pipeline

Located in `backend/app/services/generation/`:

1. **story_generator.py**: Claude AI writes the story text
2. **tokenizer.py**: Sudachipy tokenizes Japanese with furigana
3. **image_generator.py**: DALL-E 3 creates chapter illustrations
4. **audio_generator.py**: TTS generates narration audio

---

## Common Tasks

### Adding a New Story

1. Create JSON file in `backend/app/data/stories/` following naming: `{level}_{slug}.json`
2. Follow the JSON format above
3. Generate images: `python -m app.services.generation.image_generator --story-id your_story_id`
4. Restart backend or call `POST /api/stories/reload`

### Modifying the Reader View

The reader is in `app/Views/Reader/ReaderView.swift` (750+ lines). Key sections:

- Lines 1-100: Properties and state
- Lines 100-300: Body and overlays
- Lines 300-500: Chapter navigation
- Lines 500-700: Continuous scroll view
- Lines 700+: Helper functions

### Adding a New Setting

1. Add `@AppStorage` property to `SettingsView.swift`
2. Add UI control in the appropriate section
3. Read the setting in views that need it via `@AppStorage`

### Debugging Premium Flow

1. In DEBUG builds, Settings shows "Premium User (Mock)" toggle
2. Stories with `isPremium: true` in JSON show lock overlay
3. Tapping locked story shows `PaywallView`
4. "Subscribe (Mock)" button sets `appState.isPremiumUser = true`

---

## File Quick Reference

| To work on... | Look at... |
|---------------|------------|
| Story list/filtering | `LibraryView.swift` |
| Reading experience | `ReaderView.swift` |
| Word definitions | `DictionaryService.swift`, `WordDefinitionPopup.swift` |
| Furigana rendering | `FuriganaTextView.swift` |
| Vocabulary list | `VocabularyListView.swift` |
| App settings | `SettingsView.swift` |
| Premium/paywall | `PaywallView.swift`, `PremiumLockOverlay.swift` |
| Audio playback | `AudioPlayerService.swift`, `AudioPlayerBar.swift` |
| Story data models | `app/Models/Story/Story.swift` |
| Backend story loading | `backend/app/services/story_service.py` |
| Story generation | `backend/app/services/generation/` |
| API endpoints | `backend/app/routers/` |

---

## Testing

### Running the Backend

```bash
cd backend
source venv/bin/activate
python run.py
# API at http://localhost:8000, docs at /docs
```

### Running the iOS App

1. Start backend first
2. Open `Read Japanese.xcodeproj` in Xcode
3. Select iPad simulator
4. Build and run (Cmd+R)

### Verifying Premium Feature

1. Check 5 stories show lock overlay (one per level)
2. Tap locked story → paywall appears
3. Subscribe → stories unlock
4. Toggle in Settings (DEBUG) to reset
