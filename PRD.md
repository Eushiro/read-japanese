# Product Requirements Document: SanLang

## Executive Summary

**SanLang** is a multi-language exam prep platform with AI-powered personalization. The platform helps learners prepare for language proficiency exams (JLPT, TOEFL, DELF/DALF, and more) through a unified learning system that combines reading, listening, vocabulary building, active output practice, and timed practice exams.

The platform features a **unified learner model** that tracks understanding across all activities, identifies weak areas, and predicts exam readiness. AI powers sentence generation, answer verification, and essay grading to provide personalized feedback at scale.

---

## Vision

Create an intelligent, adaptive language learning platform where every activity contributes to a unified understanding of what the learner knows, enabling truly personalized exam preparation.

---

## Target Users

- **Primary**: Language learners preparing for proficiency exams (JLPT, TOEFL, DELF/DALF, TCF)
- **Secondary**: Self-studiers seeking structured vocabulary and reading practice
- **Tertiary**: Students wanting AI-powered writing feedback

---

## Supported Languages & Exams

| Language | Target Exams | Levels | Status |
|----------|--------------|--------|--------|
| **Japanese** | JLPT | N5, N4, N3, N2, N1 | ✅ Full Support |
| **English** | TOEFL, SAT, GRE | - | ✅ Schema Ready |
| **French** | DELF, DALF, TCF | A1-C2 | ✅ Schema Ready |

---

## Core Features

### 1. Unified Learner Model

**Description**: A single source of truth for user understanding, updated after every learning activity.

**Capabilities**:
- Per-language skill tracking (Vocabulary, Grammar, Reading, Listening, Writing, Speaking)
- Weak area detection from mistake patterns
- Exam readiness prediction (Not Ready → Almost Ready → Ready → Confident)
- Daily progress tracking for analytics and streaks
- Question history with full context for re-grading

**Data Model**:
```
learnerProfile
├── userId, language
├── abilityEstimate (-3 to +3 IRT scale)
├── skills: { vocabulary, grammar, reading, listening, writing, speaking } (0-100)
├── weakAreas: [{ skill, topic, score, lastTestedAt, questionCount }]
├── vocabCoverage: { targetLevel, totalWords, known, learning, unknown }
├── readiness: { level, predictedScore, confidence }
├── fsrsMetrics: { actualRetention, predictedRetention, reviewsPerDay }
└── streak, totalStudyMinutes, lastActivityAt
```

**Integration Points**:
- Flashcard reviews → update vocabulary skill
- Exam completion → update all skills + weak areas
- Comprehension quizzes → update reading/listening
- Sentence practice → update grammar/writing
- Shadowing → update speaking

---

### 2. FSRS Flashcard System

**Description**: Industry-standard spaced repetition using the FSRS algorithm (same as Anki).

**Features**:
- Full FSRS implementation with 17-weight parameter vector
- Card states: New → Learning → Review → Relearning
- Stability and difficulty calculations per card
- Content rotation (multiple sentences, images, audio per word)
- Customizable retention targets (80-97%)

**Content Sources**:
- AI-generated example sentences at user's level
- Pre-generated audio (word pronunciation + sentence)
- AI-generated context images
- Content library with shared pools for efficiency

---

### 3. Practice Exams

**Description**: Full exam simulation with timed sections and AI grading.

**Features**:
- Exam templates with configurable sections and time limits
- Question bank supporting multiple types:
  - Multiple choice
  - Short answer
  - Essay/composition
  - Translation
  - Fill-in-the-blank
  - Matching
- AI grading for essays with detailed feedback
- Section-by-section score breakdown
- Pass/fail determination based on exam-specific thresholds
- Per-question review with explanations

**Question Sources**:
- AI-generated questions from vocabulary
- Digitized questions from official practice materials (future)

---

### 4. Placement Testing

**Description**: CAT-style adaptive testing to determine user's initial level.

**Features**:
- Item Response Theory (IRT) with 3-Parameter Logistic model
- Adaptive question selection for maximum information gain
- Section-based scoring (Vocabulary, Grammar, Reading, Listening)
- Ability estimation with confidence intervals
- Automatic level determination (N5-N1 or A1-C2)

---

### 5. Vocabulary Management

**Description**: Personal vocabulary with multiple input methods and mastery tracking.

**Features**:
- Source tracking (story, manual, import, YouTube, mistake)
- Mastery states: New → Learning → Tested → Mastered
- Auto-generated flashcards with AI sentences
- Import from premade decks (JLPT N5-N1, CEFR levels)
- Drip-feed subscriptions for gradual vocabulary release

---

### 6. Active Output Practice

**Description**: Users produce sentences using target vocabulary with AI verification.

**Features**:
- Select a word, write a sentence using it
- AI verification scoring:
  - Grammar correctness (0-100)
  - Usage appropriateness (0-100)
  - Naturalness (0-100)
- Detailed corrections with explanations
- Suggested improved sentences
- Mistakes auto-added to vocabulary

---

### 7. Reading & Comprehension

**Description**: Graded stories with interactive reading and comprehension quizzes.

**Features**:
- Stories organized by proficiency level
- Tap-to-define for any word (dictionary lookup)
- Save words to vocabulary while reading
- Source sentence context preserved
- AI-generated comprehension questions at 6 difficulty levels
- Multiple question types with scoring

---

### 8. YouTube Integration

**Description**: Learn from real video content with transcripts and comprehension.

**Features**:
- Embedded YouTube player
- Synchronized transcript scrolling
- AI-generated comprehension questions
- Vocabulary extraction from transcripts
- Level-appropriate question variations

---

### 9. Shadowing Practice

**Description**: Pronunciation practice with AI feedback.

**Features**:
- Listen to target audio
- Record user's attempt
- AI accuracy scoring
- Feedback on pronunciation
- Updates speaking skill in learner model

---

### 10. Premade Vocabulary Decks

**Description**: Pre-generated content for common vocabulary lists.

**Features**:
- JLPT N5-N1 complete vocabulary sets
- Pre-generated sentences, audio, and images
- Drip-feed subscription model (X cards/day)
- Progress tracking per deck
- Content reuse across decks for efficiency

---

### 11. Progress Tracking

**Description**: Visual analytics of learning progress.

**Features**:
- Skill radar chart (6 dimensions)
- Daily activity graphs
- Streak tracking with calendar view
- Weak areas list with remediation suggestions
- Exam readiness indicators

---

### 12. Admin Panel

**Description**: Content management for platform administrators.

**Features**:
- Video management (add, edit, generate questions)
- Story management with difficulty-based questions
- Flashcard deck pipeline (sentence/audio/image generation)
- Batch job monitoring with cost tracking
- AI model configuration reference

---

## Implementation Status

### ✅ Completed Features

| Feature | Backend | UI | Notes |
|---------|---------|-----|-------|
| Unified Learner Model | ✅ | ✅ | Full schema, queries, mutations, integration |
| FSRS Flashcards | ✅ | ✅ | 17-weight algorithm, content rotation |
| Practice Exams | ✅ | ✅ | Templates, questions, attempts, AI grading |
| Placement Testing | ✅ | ✅ | IRT/CAT with level determination |
| Vocabulary Management | ✅ | ✅ | CRUD, mastery, import |
| Active Output Practice | ✅ | ✅ | AI verification with scores |
| Reading & Comprehension | ✅ | ✅ | Stories, tap-to-define, quizzes |
| YouTube Integration | ✅ | ✅ | Player, transcript, questions |
| Premade Decks | ✅ | ✅ | Drip-feed subscriptions |
| Progress Dashboard | ✅ | ✅ | Skill radar, daily progress |
| Guided Study Sessions | ✅ | ✅ | Review → Input → Output flow |
| Admin Panel | ✅ | ✅ | Videos, stories, decks, jobs |
| Clerk Auth | ✅ | ✅ | JWT integration with Convex |
| Multi-Language Schema | ✅ | ✅ | Japanese, English, French |
| Content Library | ✅ | - | Shared sentences, images, audio |

### 🚧 In Progress

| Feature | Status | Notes |
|---------|--------|-------|
| Audio Generation | Backend ready | ElevenLabs integration pending |
| FSRS Parameter Optimization | Schema ready | Optimizer not implemented |
| Topic Taxonomy | Schema exists | Needs seeding |

### ❌ Not Started

| Feature | Priority | Notes |
|---------|----------|-------|
| Personalized Story Generation | High | Stories from user's vocabulary |
| Shadowing with Speech Recognition | High | Currently accuracy scoring only |
| Email Marketing | Medium | Resend/Loops integration |
| Mobile App (React Native) | Medium | Web-first approach |
| PDF Exam Extraction | Low | Blocked on sourcing materials |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19 + Vite + TailwindCSS v4 |
| **Routing** | TanStack Router |
| **Backend** | Convex (database + serverless functions) |
| **Auth** | Clerk |
| **AI** | OpenRouter (Claude, GPT), Gemini |
| **Audio** | ElevenLabs TTS (planned) |
| **Images** | DALL-E 3, Gemini Image |
| **Algorithms** | FSRS (spaced repetition), IRT (adaptive testing) |

---

## Architecture

### Data Models (Convex Schema)

**Learning Core:**
- `users` - Profile, languages, target exams, streaks
- `vocabulary` - Words with mastery tracking
- `flashcards` - SRS cards with FSRS fields
- `flashcardReviews` - Review history
- `userSentences` - Output practice with AI scoring
- `shadowingPractices` - Pronunciation practice

**Content:**
- `stories` - Graded reading content
- `youtubeContent` - Videos with transcripts
- `storyQuestions` / `videoQuestions` - Comprehension questions
- `premadeDecks` / `premadeVocabulary` - Pre-built vocab sets
- `sentences` / `images` / `wordAudio` - Content libraries

**Assessment:**
- `placementTests` - CAT sessions
- `examTemplates` - Exam structures
- `examQuestions` - Question bank
- `examAttempts` - User exam sessions
- `mockTests` - AI-generated practice tests

**Analytics:**
- `learnerProfile` - Unified skill tracking
- `questionHistory` - All questions answered
- `dailyProgress` - Time-series metrics
- `readingProgress` - Story completion

**Settings:**
- `userSettings` - Preferences
- `subscriptions` - Tier management
- `usageRecords` - Monthly usage
- `fsrsSettings` - SRS customization
- `contentPreferences` - Interest personalization

---

## Future Direction

### ML Opportunities

The learner model collects rich data enabling:

1. **Adaptive Question Selection** - Extend CAT/IRT to all assessments
2. **Content Recommendation** - Suggest stories/videos based on vocabulary overlap
3. **Personalized FSRS** - User-specific forgetting curves
4. **Weak Area Detection** - Pattern recognition in mistakes
5. **Learning Path Optimization** - Prerequisite-aware curriculum

### Content Expansion

1. **PDF Exam Digitization** - Extract questions from official practice materials
2. **Personalized Stories** - AI-generated stories using user's vocabulary
3. **Listening Dictation** - Type what you hear exercises
4. **Writing Prompts** - Essay practice with AI grading

### Platform Expansion

1. **React Native Mobile App** - iOS and Android
2. **Offline Mode** - Download content for offline study
3. **Social Features** - Study groups, leaderboards

---

## Success Metrics

- Daily/Monthly active users (DAU/MAU)
- Day-7 and Day-30 retention
- Words mastered per user
- Exam readiness achievement rate
- Practice exam completion rate
- Subscription conversion rate

---

## Document Control

**Version**: 2.0
**Last Updated**: 2026-01-23
**Status**: Active development
