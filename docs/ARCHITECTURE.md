# Architecture

This document describes the system architecture and data models for SanLang.

## Web App (`web/`)

- **Entry**: `src/main.tsx` - ClerkProvider + ConvexProvider setup
- **Routing**: `src/router.tsx` - TanStack Router configuration
- **Auth**: `src/contexts/AuthContext.tsx` - Clerk wrapper for consistent API
- **Components**: `src/components/` - Reusable UI components
- **Pages**: `src/routes/` - Route components

---

## Convex (`web/convex/`)

- **Schema**: `schema.ts` - All table definitions with validators
- **Functions**: One file per domain:

**Core Learning:**
- `vocabulary.ts` - Word management with mastery tracking
- `flashcards.ts` - SRS with FSRS algorithm (17-weight vector)
- `userSentences.ts` - Output practice + AI verification
- `learnerModel.ts` - Unified skill tracking, weak areas, readiness

**Assessment:**
- `examTemplates.ts` - Exam structure definitions
- `examQuestions.ts` - Question bank CRUD
- `examAttempts.ts` - Exam sessions, AI grading, scoring
- `placementTest.ts` - CAT/IRT adaptive testing
- `mockTests.ts` - AI-generated practice tests

**Content:**
- `premadeDecks.ts` - Pre-built vocabulary decks
- `premadeVocabulary.ts` - Words in premade decks (deprecated, merged)
- `contentLibrary.ts` - Shared sentences, images, audio pools
- `youtubeContent.ts` - Video metadata and transcripts
- `storyQuestions.ts` / `videoQuestions.ts` - Questions by difficulty

**User & Settings:**
- `users.ts` - Profile, languages, streaks
- `settings.ts` - User preferences
- `subscriptions.ts` - Tier management + usage tracking

**AI:**
- `ai.ts` - AI model routing, sentence generation, verification, grading

- **Auth**: `auth.config.ts` - Clerk JWT configuration

---

## Key Data Models

### Learning

- `vocabulary` - Words with language, mastery state, source tracking
- `flashcards` - SRS cards with FSRS fields (stability, difficulty, due date)
- `userSentences` - User output with AI verification scores
- `learnerProfile` - Unified skills (0-100), weak areas, readiness per language
- `questionHistory` - All questions answered with full context for re-grading
- `dailyProgress` - Time-series daily metrics for charts

### Assessment

- `examTemplates` - Exam structures with sections and time limits
- `examQuestions` - Question bank with multiple types and rubrics
- `examAttempts` - User exam sessions with section scores
- `placementTests` - CAT sessions with ability estimates

### Content

- `premadeDecks` - Deck metadata (JLPT N5-N1, etc.)
- `sentences` / `images` / `wordAudio` - Content library pools
- `youtubeContent` - Videos with transcripts and questions

### User

- `users` - Profile, languages, target exams, streaks
- `subscriptions` - Tier (free/basic/pro/unlimited) + status
- `usageRecords` - Monthly usage counters per action type

---

## Admin Panel (`/admin/*`)

The admin panel is integrated into the main web app at `/admin/*` routes. Only users with admin email (hardcoded in `web/src/lib/admin.ts`) can access these pages.

### Routes

- `/admin` - Dashboard with stats overview (videos, decks, jobs, users)
- `/admin/videos` - Video management (list, add, edit YouTube videos)
- `/admin/videos/:id` - Video form with difficulty-based questions (1-6)
- `/admin/stories` - Story listing with question status per difficulty
- `/admin/stories/:storyId` - Story question editor
- `/admin/decks` - Flashcard deck pipeline (sentence/audio/image generation)
- `/admin/decks/:deckId` - Deck detail with generation controls
- `/admin/jobs` - Batch job monitoring
- `/admin/config` - AI models reference and CLI commands

### Key Files

- `web/src/lib/admin.ts` - Admin email check (`isAdmin()`)
- `web/src/components/admin/AdminLayout.tsx` - Layout with sidebar and auth guard
- `web/src/pages/admin/*.tsx` - Admin page components
- `web/convex/admin.ts` - Admin stats query
- `web/convex/videoQuestions.ts` - Video questions by difficulty
- `web/convex/storyQuestions.ts` - Story questions by difficulty

### Difficulty Levels (1-6)

Both videos and stories support questions at 6 difficulty levels:
- Level 1-2: N5-N4 / A1-A2 (beginner)
- Level 3-4: N3-N2 / B1-B2 (intermediate)
- Level 5-6: N1+ / C1-C2 (advanced)

### Local Batch Server

For triggering Python batch generation from the UI, run:
```bash
cd backend && python run_admin.py
# Server at http://localhost:8001
```

---

## Current Implementation Status

### ✅ Core Features Complete
- **Auth**: Clerk fully integrated with Convex JWT
- **Vocabulary**: Full CRUD, mastery tracking, source tracking
- **Flashcards**: FSRS algorithm (17-weight), content rotation, review UI
- **Practice Exams**: Templates, question bank, attempts, AI grading, results UI
- **Placement Testing**: CAT/IRT adaptive testing with level determination
- **Learner Model**: Unified skill tracking, weak areas, readiness prediction
- **Progress Dashboard**: Skill radar, daily progress, analytics
- **YouTube Integration**: Player, transcript sync, comprehension questions
- **Premade Decks**: JLPT decks, drip-feed subscriptions, content library
- **Admin Panel**: Video/story/deck management, batch job monitoring
- **Output Practice**: AI verification with grammar/usage/naturalness scoring

### 🚧 Partial / In Progress
- **Audio generation**: Schema ready, ElevenLabs not integrated
- **Shadowing**: Backend complete, UI not started
- **Topic taxonomy**: Schema exists, needs seeding

### ❌ Not Started
- Personalized story generation
- Email marketing
- Mobile app (React Native)
