# Product Requirements Document: Japanese Graded Reader iPad App

## Executive Summary

An iPad application that helps learners improve their Japanese reading comprehension through AI-generated and curated graded stories tailored to JLPT proficiency levels (N5–N1). Stories are presented as **chapter-based narratives** with **images, audio narration, thumbnails**, interactive word definitions, and integrated vocabulary review tools. The app supports **accounts, monetization**, and both **pre-generated and automatically generated long-form content**, including **anthologies**.

---

## Vision

Create an engaging, scalable, and sustainable Japanese reading platform that combines graded content, long-form storytelling, and modern AI capabilities to support learners from beginner to advanced levels.

---

## Target Users

- **Primary**: Japanese language learners (JLPT N5–N1)
- **Secondary**: Self-studiers seeking extensive reading practice
- **Tertiary**: JLPT exam candidates
- **Power users**: Advanced learners interested in long-form stories and anthologies

---

## Success Metrics

- Daily / Monthly active users (DAU / MAU)
- Day-7 and Day-30 retention
- Stories and chapters completed per user
- Time spent reading and listening
- Words saved and reviewed
- Subscription conversion rate
- Churn rate

---

## Core Features

### 1. JLPT-Leveled Story Library

**Description**: A library of graded stories organized by JLPT level, including short stories, long-form stories, and anthologies.

**Requirements**:

- Stories categorized by JLPT levels: N5, N4, N3, N2, N1
- Story types:

  - Short stories
  - Long-form stories (multi-chapter)
  - Anthologies (collections of thematically related stories)

- Each level contains:

  - 20–50 short stories at launch
  - 5–10 long-form stories (5–20 chapters each)

**Length Guidelines (per story, total)**:

- N5: 800–1,500 characters (2–4 chapters)
- N4: 1,500–2,500 characters (3–5 chapters)
- N3: 2,500–4,000 characters (5–8 chapters)
- N2: 4,000–5,000 characters (8–10 chapters)
- N1: 4,500–5,500 characters (8–12 chapters, ~10 minutes max)

**Chapter Length Guidelines**:

- N5: 200–300 characters
- N4: 300–400 characters
- N3: 400–500 characters
- N2: 450–550 characters
- N1: 500–600 characters

**Story Metadata**:

- Title (Japanese + English)
- JLPT level
- Story type (short / long / anthology)
- Chapter count
- Estimated reading time
- Grammar points covered
- Vocabulary count
- Topic / genre
- Thumbnail image

---

### 2. Chapter-Based Story Structure

**Description**: Stories are broken into chapters to support longer reading sessions and progressive learning.

**Requirements**:

- Every story consists of one or more chapters
- Each chapter:

  - Has a title
  - Includes at least one illustration
  - Has its own audio narration

- Chapter progress is saved automatically
- Users can resume reading from last completed chapter

---

### 3. Interactive Reading Interface

**Description**: A focused, customizable reading experience.

**Requirements**:

- Large, readable Japanese text
- Tap-to-define for any word
- Definition popup:

  - Dictionary form
  - Reading (hiragana)
  - English meaning
  - Part of speech
  - Example sentence (optional)
  - Add to review button

- Furigana toggle (N5–N3 default ON)
- Adjustable text size and line spacing
- **Dark mode** and light mode
- Chapter navigation
- Reading progress indicator (chapter + story)

---

### 4. Images, Thumbnails, and Visuals

**Description**: Visuals enhance comprehension and engagement.

**Requirements**:

- **Story thumbnail** used in library and discovery views
- **At least one image per chapter**
- Style-consistent illustrations across levels
- Images placed at natural narrative breaks

**Technical Notes**:

- Pre-generated and cached
- Optimized for iPad screen sizes

---

### 5. Audio Narration

**Description**: Native-quality Japanese audio for immersive listening that follows the text continuously.

**Requirements**:

- **One continuous audio narration per story** (not per chapter)
- Chapters act as logical markers within a single audio track
- Playback controls: play/pause, seek, speed (0.5×–1.5×)
- **Automatic scrolling synced to narration**
- Current sentence or paragraph is visually highlighted during playback
- **Currently spoken word is highlighted in real time**
- User can tap text to jump to that position in the audio
- When tapping a word, user can select **“Start reading from here”** to seek audio playback to that word
- Audio playback continues seamlessly across chapters

**Premium Features**:

- Offline audio download

---

### 6. Automatic Story Generation

**Description**: AI-powered system to generate new content dynamically.

**Capabilities**:

- Generate stories by:

  - JLPT level
  - Length (short / long)
  - Topic or genre

- Automatically:

  - Split into chapters
  - Generate chapter images
  - Generate audio narration
  - Attach metadata

**Constraints**:

- Generation may be:

  - Limited for free users
  - Unlimited or higher-quality for premium users

- Human-reviewed content may be marked as “Editor’s Pick”

---

### 7. Vocabulary Review System

_(Unchanged in core functionality, applies across chapters and long stories)_

- Word List
- SRS with spaced repetition
- Statistics and mastery tracking

---

### 8. Accounts & Sync

**Description**: Persistent user identity and cross-device support.

**Requirements**:

- Account required to use the app
- Account creation via:

  - Apple ID
  - Email/password

- Cloud sync for:

  - Reading progress
  - Word lists and SRS state
  - Purchased content

- No guest or local-only mode

---

### 9. Monetization

**Primary Model: Subscription (Freemium)**

**Free Tier**:

- Access to a small set of sample stories per JLPT level
- Limited number of chapters
- Limited daily SRS reviews
- No offline access
- No export features

**Premium Subscription**:

- Full story library
- All long-form stories and anthologies
- Unlimited SRS reviews
- Automatic story generation
- Offline access
- Export vocabulary to Anki / CSV
- Early access to new content

**Optional Add-ons**:

- One-time purchase anthologies
- Special themed story packs

---

### 10. Progress Tracking

**Enhancements**:

- Track chapter-level completion
- Long-story completion badges
- Anthology completion milestones
- **"End of story"**:

  - At the end of a story, have 3 recommended next stories to read as cards with thumbnails, title, level etc.
  - Story stats (time spent, words saved, comprehension score if applicable)
  - Recommendation logic (v1):
    - Same JLPT level
    - Similar length or slightly longer
    - Shared topic or genre
  - Recommendation logic (future):
    - Based on known / unknown word overlap
    - User reading history and preferences
    - Gradual difficulty progression

---

## MVP Scope (Updated)

**Must Have**:

- Chapter-based stories
- Images and audio for every chapter
- Story thumbnails
- Dark mode
- Accounts (Apple ID)
- Basic monetization infrastructure

**Should Have**:

- Long-form stories
- One anthology per level

**Future**:

- Fully dynamic story generation
- Community-curated anthologies

---

### 11. Story Import & Processing

**Description**: Allow users to upload Japanese text and automatically convert it to the app's tokenized format for reading.

**Requirements**:

- Upload interface:
  - Text input field (paste text)
  - File upload (.txt, .json)
  - URL input (web article)

- Processing pipeline:
  - Parse Japanese text
  - Tokenize into words/morphemes
  - Add furigana (reading annotations)
  - Identify base forms and parts of speech
  - Break into appropriate segments (paragraphs/dialogue)
  - Generate chapter structure if text is long enough
  - Estimate JLPT level based on vocabulary/grammar

- User controls:
  - Manual JLPT level selection
  - Chapter boundary editing
  - Metadata input (title, author, genre, tags)
  - Preview before saving

- Output:
  - Converts to app's JSON format
  - Saves to user's custom story library
  - Available in "My Stories" section

**Technical Notes**:

- Use morphological analysis (MeCab or similar) for tokenization
- API integration for furigana generation
- Validate JSON structure before saving
- Store in user's cloud storage/account

**Use Cases**:

- Teachers uploading custom content for students
- Advanced learners importing native materials
- Users wanting to read specific articles/stories
- Creating personalized reading material

---

## Open Questions

1. Pricing tiers and regional pricing
2. Limits on AI-generated content
3. Editorial vs fully automated content balance

---

---

## Implementation Status

### Completed Features ✅

| Feature | Status | Notes |
|---------|--------|-------|
| **JLPT-Leveled Story Library** | ✅ Complete | Stories organized by N5-N1 levels |
| **Chapter-Based Story Structure** | ✅ Complete | Multi-chapter stories with images |
| **Interactive Reading Interface** | ✅ Complete | Tap-to-define, definitions via Jisho.org |
| **Furigana Support** | ✅ Complete | Toggle on/off per user preference |
| **Dark Mode** | ✅ Complete | System/Light/Dark theme options |
| **Custom Fonts** | ✅ Complete | 4 Japanese fonts (System, Hiragino Sans, Mincho, Rounded) |
| **Adjustable Text Size** | ✅ Complete | 14-32pt range |
| **Two Reading Modes** | ✅ Complete | Paged (swipe) + Continuous (scroll) |
| **Auto-Scroll** | ✅ Complete | Long-press to activate, configurable speed |
| **Story Thumbnails** | ✅ Complete | Cover images in library view |
| **Chapter Images** | ✅ Complete | AI-generated images per chapter |
| **Reading Progress** | ✅ Complete | Auto-save, resume, completion tracking |
| **Story Recommendations** | ✅ Complete | 3 suggestions at end of story |
| **Vocabulary System** | ✅ Complete | Save words, view list, filter/sort |
| **Premium Subscription (Mock)** | ✅ Complete | Lock stories, paywall, toggle in debug |
| **Offline Caching** | ✅ Complete | Story data cached for offline reading |
| **Image Generation Pipeline** | ✅ Complete | DALL-E 3 integration for chapter art |
| **Romaji Search** | ✅ Complete | Search Japanese with romaji input |
| **Story Refresh** | ✅ Complete | Pull-to-refresh with cache management |

### In Progress 🚧

| Feature | Status | Notes |
|---------|--------|-------|
| **Audio Narration** | 🚧 Partial | Backend pipeline exists, not all stories have audio |
| **Audio Highlighting** | 🚧 Planned | Sentence sync stored in data model |
| **Account System** | 🚧 Partial | Google Sign-In UI exists, sync not implemented |

### Not Started ❌

| Feature | Priority | Notes |
|---------|----------|-------|
| **iOS Share Sheet Import** | High | Share any webpage → tokenized story with images |
| **Personalized Story Generation** | High | AI generates stories tailored to user's level & interests |
| **Instant Sentence Mining** | High | One-tap sentence save with Anki export |
| **Real Payment Integration** | High | Currently using mock subscription |
| **Audio Voice Selection** | Medium | AI-selected voices per story |
| **Story Generation UI** | Medium | Backend exists, needs mobile/web GUI |
| **Story Ratings** | Low | Like/dislike system |
| **Popularity Sorting** | Low | Sort by user engagement |

---

## Known Issues

| Issue | Severity | Description |
|-------|----------|-------------|
| Word tap in continuous mode | Medium | Tapping words doesn't always register in continuous scroll mode |
| Furigana accuracy | Low | Some stories have incorrect furigana annotations |
| Audio timing sync | Medium | Word-level highlighting not yet implemented |

---

## Document Control

**Version**: 1.2
**Last Updated**: 2026-01-12
**Status**: Updated with implementation status and known issues
