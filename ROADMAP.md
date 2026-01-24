# SanLang - Vision & Roadmap

## Project Evolution

**From:** Read Japanese (JLPT graded reader for Japanese learners)
**To:** **SanLang** - Multi-language exam prep platform with AI-powered personalization

---

## Core Brand Promise

**"Personalized Exam Prep"** - AI generates content tailored to YOUR vocabulary and YOUR target exam. Not generic study materials, but a learning path built around what you need to learn.

---

## Key Differentiators

| What We Do | What Others Do |
|------------|----------------|
| **Active output** - Create sentences, write analyses | Passive recall - flashcards, multiple choice |
| **AI verification** - Instant feedback on your writing | Right/wrong answers only |
| **Personalized content** - Stories/tests from your vocab | Generic content for everyone |
| **Exam-aligned** - Real test formats and rubrics | Gamified but not exam-focused |
| **Multi-modal** - Text, audio, images, YouTube | Usually single-modal |

---

## Supported Languages & Exams

Each language is a **separate track** with culturally appropriate content:

| Language | Target Exams | Content Themes | Phase |
|----------|--------------|----------------|-------|
| **Japanese** | JLPT N5-N1 | Daily life, manga culture, news, travel | MVP |
| **English** | TOEFL, SAT, GRE | Academic reading, test strategies, vocabulary | MVP |
| **French** | DELF/DALF, TCF | Culture, literature, daily life, news | MVP |
| **Chinese** | HSK 1-6, 高考, 中考 | Modern China, classical literature, news | Future |

**Note:** Chinese support is deferred to a future phase. MVP focuses on Japanese, English, and French.

---

## The Learning Loop

```
┌──────────────────────────────────────────────────────────────────┐
│                         INPUT MODES                              │
├──────────────────────────────────────────────────────────────────┤
│  📖 Reading        🎧 Audio         🖼️ Images      🎬 YouTube     │
│  Graded stories    Narration        Describe &     Embedded      │
│  Exam passages     Dialogues        analyze        videos        │
│  News articles     Podcasts         scenes         + questions   │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    VOCABULARY CAPTURE                            │
├──────────────────────────────────────────────────────────────────┤
│  Automatic addition (reduce user effort):                        │
│  • Pre-populated most common word lists per level                │
│  • Auto-add words from mistakes in user's output                 │
│  • Auto-add unfamiliar words from content consumption            │
│                                                                  │
│  Manual addition:                                                │
│  • Tap words to save while reading/listening                     │
│  • Manual input for specific words                               │
│  • Import from external vocabulary lists                         │
│  • Extract from YouTube video transcripts                        │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    FLASHCARD SYSTEM (Anki-style SRS)             │
├──────────────────────────────────────────────────────────────────┤
│  Auto-generated cards with:                                      │
│  • Word + reading + definition                                   │
│  • AI-generated example sentence (at your level)                 │
│  • Translation of the sentence                                   │
│  • Audio narration of the sentence                               │
│  • Periodic sentence refresh (keep it fresh)                     │
│                                                                  │
│  SRS Algorithm (FSRS - Anki's algorithm):                        │
│  • Use ts-fsrs library (github.com/open-spaced-repetition/ts-fsrs│
│  • Mastered words still appear occasionally (prevents forgetting)│
│  • Algorithm adapts to individual learning patterns              │
│  • State: New → Learning → Review → Relearning                   │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    OUTPUT PRACTICE                               │
├──────────────────────────────────────────────────────────────────┤
│  Vocabulary-based output:                                        │
│  • Create a sentence using a target word                         │
│  • AI verifies grammar, usage, naturalness                       │
│  • Get feedback and corrections                                  │
│  • Words from mistakes auto-added to vocabulary                  │
│                                                                  │
│  Post-consumption output (after reading/watching/listening):     │
│  • Answer comprehension questions                                │
│  • Summarize what you consumed                                   │
│  • Predict what happens next                                     │
│  • Write analysis of content                                     │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    LISTENING PRACTICE                            │
├──────────────────────────────────────────────────────────────────┤
│  Multiple modes:                                                 │
│  • Audio + comprehension questions (JLPT/TOEFL listening style)  │
│  • Dictation - listen, type what you hear                        │
│  • Audio flashcards - hear word/sentence, recall meaning         │
│  • Shadowing with AI feedback - repeat after audio, AI evaluates │
│    pronunciation/fluency (requires speech recognition)           │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                  PERSONALIZED CONTENT                            │
├──────────────────────────────────────────────────────────────────┤
│  AI generates content from YOUR vocabulary:                      │
│  • Stories featuring words you're learning                       │
│  • Mock tests with your vocabulary                               │
│  • Comprehension passages using target words                     │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    MOCK EXAMS                                    │
├──────────────────────────────────────────────────────────────────┤
│  AI-generated tests in real exam formats:                        │
│  • JLPT: Reading + listening sections                            │
│  • TOEFL: Reading, listening, writing sections                   │
│  • SAT: Reading comprehension + essay                            │
│  • Scoring aligned with actual exam rubrics                      │
└──────────────────────────────────────────────────────────────────┘
```

---

## Monetization: Subscription Tiers with Usage Limits

No visible "credits" - just subscription tiers with different usage allowances.
Users upgrade to unlock more usage, simpler UX than tracking credits.

| Tier | Price | What's Included |
|------|-------|-----------------|
| **Free** | $0 | Limited vocab, basic flashcards, X stories/month, Y AI checks/month |
| **Basic** | $X/mo | More stories, more AI verification, all content |
| **Pro** | $Y/mo | Higher limits, personalized story generation, mock tests |
| **Unlimited** | $Z/mo | No limits on AI generation, priority support |

Usage limits (example):
- Free: 50 AI sentence checks/month, 5 stories
- Basic: 200 AI checks/month, 20 stories, 5 personalized stories
- Pro: 1000 AI checks/month, unlimited reading, 20 personalized stories, 10 mock tests
- Unlimited: No limits

---

## Phased Roadmap

### Active Phases

| Phase | Name | Status | Priority |
|-------|------|--------|----------|
| 3 | Compression Pipeline | ❌ Not Started | **TOP** |
| 4 | Personalization | 🚧 In Progress | High |
| 5 | Exam Digitization | ❌ Not Started | High |
| 6 | Anki Import | ❌ Not Started | High |
| 7 | Listening & Speaking | 🚧 Partial | Medium |
| 8 | Missing UI | ❌ Not Started | Low |
| 9 | Image Cost Visibility | ❌ Not Started | Low |
| 10 | Testing | ❌ Not Started | Low |
| 11 | Mobile App | ❌ Not Started | Low |

### Deferred

- **Image-Based Learning** - Describe images, vision questions (low priority)
- **Email Marketing** - Engagement campaigns (not urgent)

---

### Phase 3: Compression Pipeline
**Goal:** Fix storage costs with serve-first-compress-later pattern

**Status:** ❌ Not Started | **Priority:** TOP

| Feature | Status | Notes |
|---------|--------|-------|
| Compression utilities | ❌ Not Started | lamejs for MP3, sharp for WebP |
| Temp storage for immediate serve | ❌ Not Started | Convex temp storage |
| Background compression jobs | ❌ Not Started | Via scheduler |
| R2 upload after compression | ❌ Not Started | Update URLs after compress |

---

### Phase 4: Personalization
**Goal:** Use your vocabulary and learner profile to generate content tailored to YOU

**Status:** 🚧 In Progress | **Priority:** High

| Feature | Status | Notes |
|---------|--------|-------|
| Multi-language story generation | ✅ Complete | Japanese, English, French with JLPT/CEFR constraints |
| CEFR grammar constraints | ✅ Complete | `english_grammar_constraints.json`, `french_grammar_constraints.json` |
| Admin story generation UI | ✅ Complete | Detailed prompts, direct generation from admin panel |
| Content topology/gaps analysis | ✅ Complete | `/admin/stories/topology` endpoint + UI |
| AI story suggestions | ✅ Complete | On-demand suggestions based on gaps and interests |
| User interest analytics | ✅ Complete | Convex `getInterestAnalytics` query |
| Vocabulary coverage check | ❌ Not Started | Check user knows enough words before recommending |
| Story recommendation by known words | ❌ Not Started | Personalized ranking based on vocabulary |
| Stories from your words | ❌ Not Started | Generate stories featuring words user is learning |
| Questions from your weak areas | ❌ Not Started | Generate questions targeting learner profile gaps |
| i+1 comprehensible input | ❌ Not Started | Content at user's level + 1 new concept |
| Integration with flashcards | ❌ Not Started | Link stories to vocabulary learning |

---

### Phase 5: Exam Digitization & Q&A
**Goal:** Build question bank from real exams with AI explanations

**Status:** ❌ Not Started | **Priority:** High

| Feature | Status | Notes |
|---------|--------|-------|
| Source official practice tests | ❌ Not Started | JLPT, TOEFL, DELF official materials |
| Question bank schema | ❌ Not Started | question, options, answer, explanation, source, year |
| Exam parser/digitizer | ❌ Not Started | Parse PDF/images into structured questions |
| Question-level Q&A | ❌ Not Started | "Why is this wrong?" with AI explanation |
| Q&A conversation history | ❌ Not Started | Store follow-up questions per question |

**Data sources to acquire:**
- JLPT: Official JLPT practice workbooks, 日本語能力試験 past papers
- TOEFL: ETS official practice tests, TPO materials
- DELF/DALF: Official CIEP/France Éducation sample papers

---

### Phase 6: Anki Import
**Goal:** Import existing Anki decks to bootstrap vocabulary

**Status:** ❌ Not Started | **Priority:** High

| Feature | Status | Notes |
|---------|--------|-------|
| Parse .apkg files | ❌ Not Started | Anki export format (SQLite + media) |
| Map Anki fields to vocabulary | ❌ Not Started | Handle different note types |
| Import media (audio/images) | ❌ Not Started | Extract and store in content library |
| Duplicate detection | ❌ Not Started | Skip words already in user's vocabulary |
| Preview before import | ❌ Not Started | Let user review/select what to import |

**Tech notes:**
- .apkg files are ZIP archives containing SQLite database + media folder
- Need to handle various Anki note types (Basic, Cloze, Japanese-specific)
- Consider import limits for free tier

---

### Phase 7: Listening & Speaking
**Goal:** Dictation and shadowing as question types, not separate modes

**Status:** 🚧 Partial | **Priority:** Medium

| Feature | Status | Notes |
|---------|--------|-------|
| Shadowing backend | ✅ Complete | `shadowingPractices` table, submit mutation |
| Shadowing accuracy scoring | ✅ Complete | Accuracy score stored, learner model updated |
| Audio comprehension | ✅ Complete | Video quiz with listening questions |
| Dictation questions | ❌ Not Started | Listen, type what you hear, compare to transcript |
| Shadowing questions | ❌ Not Started | Repeat after audio, compare recording |
| AI conversation partner | ❌ Not Started | Future: AI teacher you can talk to |

**Tech notes:**
- Speech recognition: Web Speech API or Whisper API
- These are question types within the existing quiz system, not separate practice modes

---

### Phase 8: Missing UI for Existing Data
**Goal:** Surface data that's already being collected

**Status:** ❌ Not Started | **Priority:** Low

| Feature | Status | Notes |
|---------|--------|-------|
| Question history page | ❌ Not Started | All answered questions with review |
| Content preferences in onboarding | ❌ Not Started | Backend exists, need UI |
| Gradebook with all attempts | ❌ Not Started | Centralized view of exam/quiz attempts |

---

### Phase 9: Image Cost Visibility
**Goal:** Track and understand image generation costs

**Status:** ❌ Not Started | **Priority:** Low

| Feature | Status | Notes |
|---------|--------|-------|
| Image cost tracking in admin | ❌ Not Started | Per-deck cost breakdown |
| Content reuse metrics | ❌ Not Started | Images shared across words |

---

### Phase 10: Testing
**Goal:** Add unit and integration tests once features stabilize

**Status:** ❌ Not Started | **Priority:** Low (wait for stability)

| Feature | Status | Notes |
|---------|--------|-------|
| Unit tests for Convex functions | ❌ Not Started | Test learner model, flashcard logic, etc. |
| Component tests (React Testing Library) | ❌ Not Started | Key UI components |
| Integration tests | ❌ Not Started | Full user flows (review session, quiz, etc.) |
| E2E tests (Playwright) | ❌ Not Started | Critical paths: auth, payment, study session |
| CI pipeline | ❌ Not Started | Run tests on PR, block merge on failure |

**Tech notes:**
- Wait until core features are stable before investing in tests
- Start with Convex function unit tests (most bang for buck)
- Use Vitest for unit/component tests
- Playwright already in dependencies for E2E

---

### Phase 11: Mobile App
**Goal:** React Native app for iOS/Android with shared Convex backend

**Status:** ❌ Not Started | **Priority:** Low (post-MVP)

| Feature | Status | Notes |
|---------|--------|-------|
| React Native + Expo setup | ❌ Not Started | Monorepo structure with web |
| Shared Convex client | ❌ Not Started | Same backend, mobile UI |
| Core screens (Dashboard, Library, Flashcards) | ❌ Not Started | Mobile-optimized layouts |
| Offline support | ❌ Not Started | Cache flashcards for offline review |
| Push notifications | ❌ Not Started | Streak reminders, review nudges |
| App Store / Play Store submission | ❌ Not Started | Store listings, screenshots |

**Tech notes:**
- Web app is priority; mobile comes after web is polished
- Share Convex backend and business logic
- Use Expo for faster development and easier deployment

---

## Next Steps

### Immediate
| Task | Priority | Notes |
|------|----------|-------|
| Phase 3: Compression Pipeline | **TOP** | Fix storage costs |

### Short-term
| Task | Priority | Notes |
|------|----------|-------|
| Phase 4: Vocabulary coverage check | High | First step toward personalization |
| Phase 4: Questions from weak areas | High | Use learner profile for targeting |
| Phase 5: Source exam content | High | Find and digitize materials |

### Medium-term
| Task | Priority | Notes |
|------|----------|-------|
| Phase 4: i+1 content generation | High | Core differentiator |
| Phase 6: Anki import | High | Bootstrap user vocabulary |
| Phase 7: Add dictation question type | Medium | Backend shadowing exists |

---

## Platform Strategy

**Decision: React (Web) + React Native (Mobile)**

**Current approach:**
1. **Web app with React** - Current implementation in `/web`
2. **Future mobile with React Native** - Cross-platform iOS/Android
3. **Shared Convex backend** - Single source of truth for data
4. **Clerk for auth** - Unified authentication across platforms

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend (Web)** | React + Vite + TailwindCSS |
| **Frontend (Mobile)** | React Native + Expo (future) |
| **Backend** | Convex (database + functions) |
| **Auth** | Clerk |
| **AI** | OpenRouter (Claude/GPT), Gemini |
| **Audio** | ElevenLabs TTS |
| **Images** | DALL-E 3 |

---

## Ongoing Research

| Research Area | Purpose | Status |
|---------------|---------|--------|
| **Duolingo engagement study** | Understand gamification, streaks, XP, lesson structure | 📚 Ongoing |
| **Competitor analysis** | WaniKani, Bunpro, Anki, Lingodeer patterns | 📚 Ongoing |
| **Exam format research** | Deep dive into each exam's actual format/rubrics | 📚 Ongoing |

---

## Architecture Considerations

### Data Models (Implemented in Convex)

```
User
├── languages: [Language]           # Languages user is learning
├── targetExams: [Exam]             # Exams user is preparing for
└── emailPreferences                # Email marketing settings

VocabularyItem (enhanced)
├── language: Language
├── word, reading, definitions
├── sourceType: story | manual | import | youtube
├── masteryState: new | learning | tested | mastered
├── flashcards: [Flashcard]
├── userSentences: [UserSentence]
└── reviewHistory: [Review]

Flashcard
├── vocabularyItemId
├── sentence, translation, audioUrl
├── createdAt
├── nextRefreshAt
└── reviewData: SRS fields

UserSentence
├── vocabularyItemId
├── sentence
├── aiVerification: VerificationResult
├── createdAt
└── corrections

MockTest
├── language, examType
├── sections: [TestSection]
├── score, completedAt
└── vocabularyTargeted: [VocabularyItem]

YouTubeContent
├── videoId, title
├── language
├── transcript: tokenized
├── questions: [Question]
└── vocabularyExtracted: [VocabularyItem]
```

### Subscription & Usage Tracking

```
Subscription
├── userId
├── tier: free | basic | pro | unlimited
├── startDate, renewalDate
└── status: active | cancelled | expired

UsageRecord
├── userId
├── period: { month, year }
├── aiVerifications: Int
├── storiesRead: Int
├── personalizedStoriesGenerated: Int
├── mockTestsGenerated: Int
└── updatedAt

UsageLimits (per tier)
├── tier
├── aiVerificationsPerMonth
├── storiesPerMonth
├── personalizedStoriesPerMonth
└── mockTestsPerMonth
```

---

## Decisions Made

1. **Branding: SanLang**
   - 三 (san) = three in Japanese + Lang = language
   - Reflects trilingual founder (English, French, Japanese)
   - Domain to register: sanlang.app or sanlang.com

2. **User accounts: Freemium model**
   - Browse content without account
   - Account required to: save vocabulary, get tested, track progress
   - Reduces friction for new users while encouraging signup

3. **Content sources: Official sources**
   - JLPT vocabulary from official JLPT sources
   - TOEFL/SAT/GRE from official test prep materials
   - DELF/DALF from official French certification sources

4. **Auth: Clerk**
   - Replaces Firebase Auth
   - Better Convex integration
   - Built-in user management UI

5. **Database: Convex**
   - Real-time sync
   - TypeScript-first
   - Serverless functions

---

## Archived: Completed Work

<details>
<summary>Phase 0: Infrastructure ✅</summary>

| Task | Status |
|------|--------|
| Convex schema (all tables) | ✅ Complete |
| Convex functions (vocabulary, flashcards, subscriptions, etc.) | ✅ Complete |
| Clerk auth integration | ✅ Complete |
| Remove Firebase | ✅ Complete |
| Deploy schema to Convex | ✅ Complete |

</details>

<details>
<summary>Phase 0.25: Onboarding & Learning Loop ✅</summary>

| Feature | Status |
|---------|--------|
| Dashboard page | ✅ Complete |
| Simplified navigation | ✅ Complete |
| Combined Learn page | ✅ Complete |
| Sentence context saving | ✅ Complete |
| Onboarding loop explanation | ✅ Complete |

</details>

<details>
<summary>Phase 0.3: Guided Study Sessions ✅</summary>

| Feature | Status |
|---------|--------|
| Session infrastructure | ✅ Complete |
| Session page with activity flow | ✅ Complete |
| Embedded review/input/output components | ✅ Complete |
| Session completion screen | ✅ Complete |
| Streak tracking | ✅ Complete |
| Dashboard redesign | ✅ Complete |
| Navigation simplification (3 tabs) | ✅ Complete |

</details>

<details>
<summary>Phase 0.5: Analytics & Quick Wins ✅</summary>

| Feature | Status |
|---------|--------|
| PostHog integration | ✅ Complete |
| AI failure metrics | ✅ Complete |
| Manual vocab + AI enhance | ✅ Complete |
| Premade flashcard decks | ✅ Complete |
| Content library | ✅ Complete |

</details>

<details>
<summary>Phase 1: Flashcard Foundation ✅</summary>

| Feature | Status |
|---------|--------|
| Enhanced vocabulary input | ✅ Complete |
| Auto-generated flashcards | ✅ Complete |
| Sentence refresh | ✅ Complete |
| Content rotation | ✅ Complete |
| FSRS spaced repetition | ✅ Complete |
| Audio flashcards (schema) | ✅ Complete |

**Note:** ElevenLabs TTS integration pending.

</details>

<details>
<summary>Phase 2: Active Output Verification ✅</summary>

| Feature | Status |
|---------|--------|
| Sentence creation | ✅ Complete |
| AI verification | ✅ Complete |
| Mastery tracking | ✅ Complete |
| Feedback loop | ✅ Complete |
| Learner model integration | ✅ Complete |

</details>

<details>
<summary>Multi-Language Foundation ✅</summary>

| Feature | Status |
|---------|--------|
| Language selection | ✅ Complete |
| Exam-specific vocabulary | ✅ Complete |
| Per-language learner profiles | ✅ Complete |
| Separate content tracks | ✅ Complete |

</details>

<details>
<summary>Practice Exams ✅</summary>

| Feature | Status |
|---------|--------|
| Exam templates | ✅ Complete |
| Question bank | ✅ Complete |
| Exam attempts | ✅ Complete |
| Exam taking UI | ✅ Complete |
| Exam results UI | ✅ Complete |
| AI grading for essays | ✅ Complete |
| Learner model integration | ✅ Complete |

</details>

<details>
<summary>YouTube Integration ✅</summary>

| Feature | Status |
|---------|--------|
| Dashboard recommended stories | ✅ Complete |
| YouTube schema with level field | ✅ Complete |
| Stories/Videos toggle in Library | ✅ Complete |
| VideoPage with player | ✅ Complete |
| VideoQuizPage | ✅ Complete |
| Transcript fetch action | ✅ Complete |
| Video question generation | ✅ Complete |
| Video questions by difficulty | ✅ Complete |
| Admin video management | ✅ Complete |

</details>

<details>
<summary>AI Abstraction & Enforcement ✅</summary>

| Feature | Status |
|---------|--------|
| Centralized generation layer | ✅ Complete |
| Content reuse helpers | ✅ Complete |
| User content history (seen tracking) | ✅ Complete |
| Usage limit checking | ✅ Complete |
| Usage metering | ✅ Complete |
| Monthly usage display | ✅ Complete |

</details>

<details>
<summary>Unified Learner Model ✅</summary>

| Feature | Status |
|---------|--------|
| Learner profile schema | ✅ Complete |
| Question history | ✅ Complete |
| Daily progress | ✅ Complete |
| Update from all activities | ✅ Complete |
| Weak area detection | ✅ Complete |
| Readiness prediction | ✅ Complete |

</details>

<details>
<summary>Placement Testing ✅</summary>

| Feature | Status |
|---------|--------|
| Placement test schema | ✅ Complete |
| CAT algorithm (3-PL IRT) | ✅ Complete |
| Adaptive question selection | ✅ Complete |
| Ability estimation | ✅ Complete |
| Level determination | ✅ Complete |
| Placement test UI | ✅ Complete |

</details>

<details>
<summary>Progress Dashboard ✅</summary>

| Feature | Status |
|---------|--------|
| Progress page | ✅ Complete |
| Skill radar chart | ✅ Complete |
| Weak areas list | ✅ Complete |
| Daily progress charts | ✅ Complete |
| Readiness indicator | ✅ Complete |

</details>

<details>
<summary>Admin Panel ✅</summary>

| Feature | Status |
|---------|--------|
| Admin dashboard | ✅ Complete |
| Video management | ✅ Complete |
| Story management | ✅ Complete |
| Deck management | ✅ Complete |
| Batch job monitoring | ✅ Complete |
| Admin auth guard | ✅ Complete |

</details>

<details>
<summary>Premade Decks & Content Library ✅</summary>

| Feature | Status |
|---------|--------|
| Premade decks schema | ✅ Complete |
| Content library | ✅ Complete |
| Drip-feed subscriptions | ✅ Complete |
| Deck import scripts | ✅ Complete |
| Content generation pipeline | ✅ Complete |
| Deck publishing | ✅ Complete |

</details>

---

## Document Control

**Version**: 4.0
**Last Updated**: 2026-01-23
**Status**: Active development - Core complete, focusing on compression and personalization
