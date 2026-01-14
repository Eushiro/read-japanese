# Read Japanese - Feature Roadmap

A prioritized list of features to implement, organized by category.

---

## Bug Fixes (High Priority)

### 1. Word Tap in Continuous Mode
**Problem**: Clicking on words in continuous scroll mode doesn't always register.

**Likely Cause**: Hit testing conflicts between `AutoScrollView` (UIViewRepresentable) and SwiftUI gesture handlers.

**Approach**:
- Debug gesture recognizer priority in `continuousScrollView`
- Ensure `FuriganaTextView` tap targets have correct frame calculations
- Consider using `UITapGestureRecognizer` directly on the scroll view

**Files**: `ReaderView.swift` (lines 600-700), `AutoScrollView.swift`, `FuriganaTextView.swift`

---

### 2. Furigana Accuracy
**Problem**: Some stories have incorrect furigana annotations.

**Approach**:
- Create a proofreading script that validates furigana against known dictionaries
- Build a rule-based checker for common errors (e.g., wrong readings for common kanji)
- Allow manual corrections in JSON with a "verified" flag

**Implementation**:
```python
# backend/app/services/proofreader.py
def validate_furigana(story: Story) -> List[FuriganaError]:
    """Check furigana against dictionary, return errors"""
    errors = []
    for chapter in story.chapters:
        for segment in chapter.segments:
            for token in segment.tokens:
                expected_reading = lookup_reading(token.surface)
                if token.reading != expected_reading:
                    errors.append(FuriganaError(token, expected_reading))
    return errors
```

**Files**: New `proofreader.py`, story JSON files

---

## Audio Features (High Priority)

### 3. Audio with Sentence Highlighting
**Description**: Highlight the currently spoken sentence and auto-scroll to keep it visible.

**Data Model** (already exists):
```swift
struct ContentSegment {
    var audioStartTime: Double?  // Already in model
    var audioEndTime: Double?
}
```

**Implementation**:
1. Add timing data to story JSONs (generate with forced alignment)
2. In `AudioPlayerService`, observe playback time
3. Publish `currentSegmentId` based on time ranges
4. In `ReaderView`, highlight matching segment and scroll to it

**Files**: `AudioPlayerService.swift`, `ReaderView.swift`, story JSONs

---

### 4. AI Voice Selection
**Description**: AI picks appropriate voice based on story content (gender, age, tone).

**Implementation**:
```python
# In audio_generator.py
def select_voice(story: Story) -> str:
    """Analyze story and return best voice ID"""
    prompt = f"""
    Story: {story.metadata.title}
    Genre: {story.metadata.genre}
    Summary: {story.metadata.summary}

    Select the most appropriate voice:
    - alloy: neutral, professional
    - echo: younger, energetic
    - fable: warm, storytelling
    - onyx: deep, authoritative
    - nova: bright, cheerful
    - shimmer: soft, gentle
    """
    # Call Claude to select voice
```

**Files**: `backend/app/services/generation/audio_generator.py`

---

### 5. Word-Level Highlighting
**Description**: Highlight the exact word being spoken, not just the sentence.

**Requires**: Forced alignment at word level (more complex than sentence timing)

**Tools**:
- OpenAI Whisper with word timestamps
- WhisperX for better alignment
- Custom alignment using TTS duration estimates

---

## Content Import (High Priority)

### 6. iOS Share Sheet Import
**Description**: Users can share any webpage to the app via iOS Share Sheet, and the app processes it into a readable story with furigana, vocabulary lookup, and generated images.

**User Flow**:
1. User finds Japanese article/story on web (Safari, Twitter, etc.)
2. Taps Share → "Read Japanese"
3. App opens with processing screen
4. Backend extracts text, tokenizes, adds furigana
5. AI estimates JLPT level
6. AI generates chapter images based on content
7. Story appears in "My Library" section

**Technical Implementation**:

**iOS Share Extension** (`ShareExtension/`):
```swift
// ShareViewController.swift
class ShareViewController: SLComposeServiceViewController {
    override func didSelectPost() {
        guard let item = extensionContext?.inputItems.first as? NSExtensionItem,
              let attachment = item.attachments?.first else { return }

        attachment.loadItem(forTypeIdentifier: UTType.url.identifier) { [weak self] url, error in
            if let url = url as? URL {
                // Send URL to main app via App Group or deep link
                self?.sendToMainApp(url: url)
            }
        }
    }
}
```

**Backend Endpoint**:
```python
# POST /api/import/url
@router.post("/import/url")
async def import_from_url(request: ImportURLRequest):
    # 1. Fetch webpage content
    html = await fetch_url(request.url)

    # 2. Extract Japanese text (remove nav, ads, etc.)
    text = extract_article_text(html)

    # 3. Tokenize with Sudachipy
    tokens = tokenizer.tokenize(text)

    # 4. Estimate JLPT level
    level = estimate_jlpt_level(tokens)

    # 5. Split into chapters (by headings or length)
    chapters = split_into_chapters(tokens)

    # 6. Generate chapter images with DALL-E
    for chapter in chapters:
        chapter.imageURL = await generate_image(chapter.summary)

    # 7. Return processed story
    return Story(
        id=f"import_{uuid4()}",
        metadata=StoryMetadata(
            title=extract_title(html),
            source_url=request.url,
            jlptLevel=level,
            isUserImported=True
        ),
        chapters=chapters
    )
```

**Processing Features**:
- Smart text extraction (skip navigation, ads, footers)
- Preserve paragraph structure
- Detect and handle dialogue vs. narration
- Extract images from original page (optional)
- Generate AI images for chapters without images
- Source URL saved for reference

**My Library Section**:
- New tab or filter: "My Imports"
- Shows source URL
- "Re-process" button to regenerate
- Delete imported stories
- Edit title/level manually

**Files**:
- New `ShareExtension/` target in Xcode
- New `app/Views/Import/ImportProgressView.swift`
- New `backend/app/routers/import_router.py`
- New `backend/app/services/web_extractor.py`
- Update `LibraryView.swift` with "My Library" filter

**Edge Cases**:
- Paywall/login-required pages → show error with suggestion
- Non-Japanese content → detect and warn
- Very long articles → split into multiple stories or chapters
- Mixed language content → filter to Japanese sections

---

### 7. Personalized Story Generation
**Description**: Generate stories tailored to user's interests, reading history, and vocabulary level.

**User Flow**:
1. User taps "Generate Story" in app
2. Fills optional preferences (or uses smart defaults):
   - Topic/theme (or "surprise me")
   - Length (short/medium/long)
   - Target level (auto-detected from history)
3. AI generates story using:
   - 80% known vocabulary (from user's reading history)
   - 20% new vocabulary at appropriate level
   - Themes matching user's interests
4. Story generated with images and audio
5. Appears in library with "Generated for you" badge

**Interest Detection**:
```python
def detect_user_interests(reading_history: List[Story]) -> List[str]:
    """Analyze completed stories to find patterns"""
    genres = Counter(s.metadata.genre for s in reading_history)
    tags = Counter(tag for s in reading_history for tag in s.metadata.tags)
    return {
        "preferred_genres": genres.most_common(3),
        "preferred_themes": tags.most_common(10),
        "avoided_genres": least_read_genres(reading_history)
    }
```

**Vocabulary-Aware Generation**:
```python
def generate_personalized_story(user_id: str, preferences: StoryPreferences):
    # Get user's known vocabulary
    known_words = get_user_vocabulary(user_id)

    # Get words they've looked up (likely unknown)
    looked_up_words = get_lookup_history(user_id)

    prompt = f"""
    Write a Japanese story with these constraints:
    - JLPT Level: {preferences.level}
    - Genre: {preferences.genre or 'any'}
    - Theme: {preferences.theme or detect_interests(user_id)}

    Vocabulary guidelines:
    - Use these words (user knows them): {known_words[:100]}
    - Introduce these words (user is learning): {target_vocabulary}
    - Avoid these words (too advanced): {advanced_words}

    The user has enjoyed stories about: {user_interests}
    """
```

**Feedback Loop**:
- "Too easy" / "Too hard" / "Not interesting" buttons
- Adjusts future generations
- Tracks which generated stories get completed

**Files**:
- New `app/Views/Generate/GenerateStoryView.swift`
- New `app/Views/Generate/GenerateProgressView.swift`
- Update `backend/app/services/generation/story_generator.py`
- New `backend/app/services/user_profile.py`

---

## Content Management (Medium Priority)

### 8. Backend GUI / Admin Panel
**Description**: Web interface to manage stories, generate new content, view analytics.

**Tech Stack**: FastAPI + React/Vue or FastAPI + HTMX

**Features**:
- Story list with edit/delete
- Generate story form (level, genre, topic)
- Image regeneration per chapter
- Audio generation controls
- Furigana proofreading interface

**Files**: New `backend/app/admin/` directory

---

### 7. Story Generation from Mobile
**Description**: Generate stories directly from the iOS app.

**Implementation**:
1. Add UI in app (form with level, genre, topic inputs)
2. Call existing `POST /api/generate/story` endpoint
3. Show progress (generation can take 1-2 minutes)
4. Refresh library when complete

**Files**: New `app/Views/Generate/StoryGeneratorView.swift`

---

### 8. Story Suggestions
**Description**: AI suggests story ideas based on user's vocabulary and completed stories.

**Implementation**:
```python
def suggest_stories(user_vocabulary: List[str], completed_stories: List[str]) -> List[StorySuggestion]:
    """Generate story ideas that use known vocabulary + some new words"""
    prompt = f"""
    User knows these words: {user_vocabulary[:50]}
    User has read: {completed_stories}

    Suggest 5 story ideas that:
    1. Use 80% known vocabulary
    2. Introduce 20% new vocabulary at appropriate level
    3. Are different genres from recently read
    """
```

---

### 9. More Stories
**Description**: Expand the story library.

**Current Count**: ~15-20 stories

**Target**: 20-50 stories per level (100-250 total)

**Generation Strategy**:
- Batch generate with varied genres
- Create story "series" with recurring characters
- Seasonal/topical content

---

### 10. User Content Upload
**Description**: Users can upload Japanese text to be tokenized and formatted for reading.

**Flow**:
1. User pastes text or uploads file
2. Backend tokenizes with Sudachipy
3. Estimates JLPT level based on vocabulary
4. User can edit chapter breaks
5. Saves to "My Stories" section

**Files**: New upload endpoint, new `MyStoriesView.swift`

---

## Premium & Monetization (High Priority)

### 11. Real Payment Integration
**Description**: Replace mock subscription with actual payments.

**Options**:
- StoreKit 2 for iOS
- RevenueCat for cross-platform

**Implementation**:
1. Set up App Store Connect subscription
2. Add StoreKit product loading
3. Replace mock toggle with real purchase flow
4. Implement receipt validation
5. Handle subscription status sync

**Files**: New `SubscriptionService.swift`, update `PaywallView.swift`

---

### 12. Regenerate/Redo Images
**Description**: Admin can regenerate images for stories with poor quality.

**Features**:
- "Regenerate" button per chapter in admin panel
- Batch regeneration for entire story
- Style presets (anime, watercolor, minimalist)
- A/B testing different styles

**Files**: `image_generator.py`, admin panel

---

## Export & Integration (High Priority)

### 15. Instant Sentence Mining & Anki Export
**Description**: One-tap sentence saving while reading, with automatic Anki deck generation.

**In-Reader Sentence Save**:
When user taps a word and sees the definition popup, add "Save Sentence" button:
```swift
struct WordActionTooltip: View {
    // ... existing code ...

    Button("Save Sentence") {
        saveSentenceToAnki(
            sentence: currentSegment,
            targetWord: selectedWord,
            audio: extractAudioClip(segment),
            context: storyTitle + " - " + chapterTitle
        )
    }
}
```

**What Gets Saved**:
- Full sentence with target word highlighted
- Audio clip of just that sentence (extracted from chapter audio)
- English translation (from AI or user-provided)
- Reading (furigana) for all words
- Source story and chapter
- Screenshot of context (optional)
- Grammar points in the sentence

**Anki Card Format**:
```
Front:
  [Sentence with target word blanked: 私は＿＿＿に行きました]
  [Audio plays automatically]

Back:
  [Full sentence: 私は学校に行きました]
  [Target word: 学校 (がっこう) - school]
  [Full translation: I went to school.]
  [Grammar: ～に行く (to go to ~)]
  [Source: "My Morning" - Chapter 1]
```

**Export Options**:
1. **Direct Sync**: AnkiConnect integration (desktop Anki running)
2. **File Export**: Generate .apkg file, share via iOS
3. **AnkiWeb Sync**: Upload directly to AnkiWeb (requires API)
4. **CSV Export**: For import into any flashcard app

**Backend Support**:
```python
# POST /api/export/anki
@router.post("/export/anki")
async def export_to_anki(request: AnkiExportRequest):
    sentences = request.saved_sentences

    # Generate audio clips for each sentence
    for sentence in sentences:
        sentence.audio_clip = extract_audio_segment(
            story_audio=sentence.story_audio_url,
            start=sentence.audio_start,
            end=sentence.audio_end
        )

    # Build Anki deck
    deck = build_anki_deck(
        name=f"Read Japanese - {date.today()}",
        sentences=sentences,
        card_type=request.card_type  # recognition, recall, or both
    )

    return FileResponse(deck.to_apkg())
```

**Smart Features**:
- Detect duplicate sentences (don't save same sentence twice)
- Suggest sentences with words user looked up but didn't save
- "Review Queue": sentences saved today, review before export
- Batch export: all sentences from a story

**Files**:
- New `app/Services/SentenceMiningService.swift`
- New `app/Views/Mining/SavedSentencesView.swift`
- Update `WordActionTooltip.swift` with save button
- New `backend/app/routers/export.py`
- New `backend/app/services/anki_generator.py`

---

### 16. GitHub as CDN
**Description**: Serve static assets (images, audio) from GitHub releases.

**Benefits**:
- Free hosting
- Version control for assets
- Easy deployment

**Implementation**:
1. Create GitHub releases with assets
2. Use raw.githubusercontent.com URLs or GitHub Pages
3. Update `APIConfig.swift` to point to GitHub CDN

---

## Social Features (Low Priority)

### 15. Like/Dislike Stories
**Description**: Users can rate stories to help surface popular content.

**Implementation**:
- Add `likes`/`dislikes` to story metadata
- Track per-user ratings
- Display rating in library
- Use for recommendations

**Files**: New rating endpoint, update `StoryCard.swift`

---

### 16. Sort by Popularity
**Description**: Sort library by engagement metrics.

**Metrics**:
- Like ratio
- Completion rate
- Time spent reading
- Times read

**Files**: Update `LibraryView.swift` sort options

---

### 17. Show All for Level
**Description**: When a level has many stories, show "See All" to expand.

**Current**: All stories shown in grouped list
**Proposed**: Show 3-5 per level with "See All N5 Stories (47)" button

**Files**: Update `LibraryView.swift`

---

## Animation & Polish (Low Priority)

### 18. Story Delivery Animation
**Description**: Fun animation when new story is generated or delivered.

**Ideas**:
- Book flying in from side
- Unwrapping animation
- Sparkle/confetti effect

**Files**: New animation components

---

## AI-Powered Features (Experimental)

### 19. AI Product Manager
**Description**: Use AI to analyze usage patterns and suggest features.

**Implementation**:
```python
def analyze_and_suggest():
    """AI reviews analytics and suggests improvements"""
    analytics_data = get_usage_analytics()
    prompt = f"""
    Analyze this usage data and suggest product improvements:
    {analytics_data}

    Consider:
    - Drop-off points
    - Most/least used features
    - User journey optimization
    """
```

---

### 20. Model-Proofread JSON
**Description**: Use AI to validate and fix story JSON issues.

**Rules to Check**:
1. Furigana matches kanji
2. Base forms are dictionary forms
3. Part of speech is accurate
4. Sentence structure is grammatically correct
5. JLPT level matches vocabulary used
6. No duplicate segment IDs

**Implementation**:
```python
def proofread_story(story: Story) -> List[Issue]:
    """AI reviews story JSON for issues"""
    issues = []
    issues.extend(check_furigana(story))
    issues.extend(check_grammar(story))
    issues.extend(check_level_appropriateness(story))
    return issues
```

---

## Backend Improvements

### Local Dictionary (JMdict)
**Description**: Replace Jisho API proxy with local SQLite dictionary for faster, more reliable lookups.

**Current State**: Using Jisho API proxy at `/api/dictionary/{word}` to avoid CORS issues.

**Proposed**:
- Download JMdict XML (~50MB compressed, same data Jisho uses)
- Parse and load into SQLite with indexes on word/reading
- Query by exact match or prefix
- Include JLPT level tags from standard vocab lists

**Benefits**:
- Instant lookups (no external API call)
- Works offline / no Jisho dependency
- Can customize for learners (add JLPT levels, filter results)

**Files**:
- New `backend/scripts/build_dictionary.py`
- New `backend/app/services/dictionary.py`
- Update `backend/app/routers/dictionary.py`

---

### Premium Content Protection (Server-Side)
**Description**: Backend should not return full story content for premium stories to non-premium users.

**Current State**: Premium enforcement only on frontend (users could bypass via API).

**Implementation**:
- Add user authentication check in `GET /api/stories/{id}`
- Return only metadata (title, summary, cover) for locked premium stories
- Require valid premium token to get full chapter content

---

## Priority Matrix

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| P0 | Fix word tap in continuous mode | Medium | High |
| P0 | Real payment integration | High | High |
| P1 | **iOS Share Sheet Import** | High | **Very High** |
| P1 | **Personalized Story Generation** | High | **Very High** |
| P1 | **Instant Sentence Mining + Anki** | Medium | **Very High** |
| P1 | Audio sentence highlighting | Medium | High |
| P1 | More stories | High | High |
| P2 | Backend GUI | High | Medium |
| P2 | AI voice selection | Low | Medium |
| P2 | Furigana proofreading | Medium | Medium |
| P3 | Story ratings | Low | Low |
| P3 | GitHub CDN | Low | Low |

---

## Next Steps

1. **Immediate**: Fix word tap bug in continuous mode
2. **Short-term**:
   - Implement Share Sheet import (game-changer for user content)
   - Add sentence mining with Anki export
   - Implement audio sentence highlighting
3. **Medium-term**:
   - Personalized story generation
   - Build admin panel
   - Add more curated stories
4. **Long-term**:
   - Real payments
   - Social features
   - Cross-platform expansion

---

## Feature Spotlight: The "Import Anything" Vision

The iOS Share Sheet import feature deserves special attention because it transforms the app from a **content library** into a **learning tool for any Japanese content**.

**The Magic**:
```
User reads interesting article on Twitter/Safari/News
     ↓
Taps Share → "Read Japanese"
     ↓
30 seconds later: Full story with furigana,
tap-to-define, chapter images, JLPT level estimate
     ↓
Can save sentences to Anki, track vocabulary,
measure comprehension
```

**Why This Matters**:
- Infinite content: Every Japanese website becomes a graded reader
- Personal relevance: Users read what *they* care about
- Real Japanese: Bridge from learner content to native content
- Habit formation: "I can share anything and learn from it"

This single feature could be the app's biggest differentiator.
