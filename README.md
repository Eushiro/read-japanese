# Read Japanese

An iPad application that helps Japanese language learners improve reading comprehension through AI-generated and curated graded stories tailored to JLPT proficiency levels (N5–N1).

## Features

- **JLPT-Graded Story Library** - Stories organized by proficiency levels (N5 through N1)
- **Interactive Reading** - Tap any word to see its definition via Jisho.org
- **Furigana Support** - Toggle ruby text above kanji for reading assistance
- **Audio Narration** - Native Japanese audio with synchronized text highlighting
- **Vocabulary Management** - Save words from stories and track your learning
- **Reading Progress** - Auto-save progress and resume from where you left off
- **Two Reading Modes** - Paged (chapter-by-chapter) or Continuous (scrollable)
- **Auto-Scroll** - Long-press to enable automatic scrolling at configurable speeds
- **Customization** - Multiple fonts, adjustable text size, light/dark themes
- **Story Recommendations** - Smart suggestions at end of each story

## Tech Stack

**iOS App (SwiftUI)**
- Swift 5.9+
- SwiftUI with MVVM architecture
- AVFoundation for audio playback
- Combine for reactive state management

**Backend (Python)**
- FastAPI 0.109+
- Uvicorn ASGI server
- Sudachipy for Japanese morphological analysis
- Pydantic for data validation

## Project Structure

```
Read Japanese/
├── app/                          # iOS SwiftUI Application
│   ├── Models/                   # Data models (Story, Vocabulary, etc.)
│   ├── State/                    # AppState for global state management
│   ├── Services/                 # API, Dictionary, Audio services
│   ├── Views/                    # SwiftUI views
│   │   ├── Library/              # Story library and browsing
│   │   ├── Reader/               # Reading interface
│   │   ├── Vocabulary/           # Saved words list
│   │   └── Settings/             # App settings
│   └── Resources/
│
├── backend/                      # Python FastAPI Backend
│   ├── app/
│   │   ├── routers/              # API endpoints
│   │   ├── services/             # Business logic
│   │   └── data/stories/         # JSON story files
│   ├── requirements.txt
│   └── run.py                    # Entry point
│
└── Read Japanese.xcodeproj       # Xcode project
```

## Getting Started

### Prerequisites

- Xcode 15+ (for iOS development)
- Python 3.13+
- iPad or iPad simulator

### Backend Setup

```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server
python run.py
```

The API will be available at `http://localhost:8000` with interactive docs at `http://localhost:8000/docs`.

### iOS App Setup

1. Open the project in Xcode:
   ```bash
   open "Read Japanese.xcodeproj"
   ```

2. Ensure the backend is running (the app connects to `http://localhost:8000`)

3. Select an iPad simulator or device

4. Build and run (Cmd+R)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/stories` | List all stories (optional `?level=N5` filter) |
| GET | `/api/stories/{id}` | Get a specific story |
| POST | `/api/stories/reload` | Reload stories from disk |
| POST | `/api/tokenize` | Tokenize Japanese text |

## Configuration

### App Settings (persisted via UserDefaults)

| Setting | Default | Options |
|---------|---------|---------|
| Font Size | 20pt | 14-32pt |
| Font | System | System, Hiragino Sans, Hiragino Mincho, Rounded |
| Show Furigana | true | true/false |
| Theme | System | Light, Dark, System |
| Auto-Scroll Speed | 300 | 200-600 pts/sec |
| Reading Mode | Paged | Paged, Continuous |

### Backend Configuration

CORS is currently open to all origins. For production, update `allow_origins` in `backend/app/main.py`.

## Story Data Format

Stories are stored as JSON files in `backend/app/data/stories/`. Each story includes:

- Metadata (title, author, JLPT level, word count, genre)
- Chapters with tokenized content
- Furigana annotations
- Audio URLs (when available)
- Chapter illustrations

## License

This project is private and not licensed for public distribution.
