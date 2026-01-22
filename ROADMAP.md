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

---

## Implementation Status Overview

| Phase | Name | Status | Progress |
|-------|------|--------|----------|
| 0 | Infrastructure | ✅ Complete | Clerk auth, Convex deployed |
| 1 | Flashcard Foundation | 🚧 In Progress | UI complete, Stripe setup + audio pending |
| 2 | Active Output Verification | ✅ UI Complete | Practice page with AI feedback |
| 3 | Personalized Story Generation | ❌ Not Started | - |
| 4 | Multi-Language Foundation | ✅ UI Complete | Language/exam settings in UI |
| 5 | Mock Test Generation | ✅ Backend Ready | Schema + functions done |
| 6 | YouTube Integration | ❌ Not Started | Schema placeholder only |
| 7 | Image-Based Learning | ❌ Not Started | - |
| 8 | Email Marketing | ❌ Not Started | - |

---

### Phase 0: Infrastructure
**Goal:** Set up core platform infrastructure

**Status:** ✅ Complete

| Task | Status | Notes |
|------|--------|-------|
| Convex schema (all tables) | ✅ Complete | `web/convex/schema.ts` |
| Convex functions (vocabulary) | ✅ Complete | `web/convex/vocabulary.ts` |
| Convex functions (flashcards) | ✅ Complete | `web/convex/flashcards.ts` with FSRS |
| Convex functions (subscriptions) | ✅ Complete | `web/convex/subscriptions.ts` |
| Convex functions (user sentences) | ✅ Complete | `web/convex/userSentences.ts` |
| Convex functions (mock tests) | ✅ Complete | `web/convex/mockTests.ts` |
| Convex functions (users) | ✅ Complete | `web/convex/users.ts` |
| Convex functions (settings) | ✅ Complete | `web/convex/settings.ts` |
| Convex functions (progress) | ✅ Complete | `web/convex/progress.ts` |
| Clerk auth integration | ✅ Complete | Clerk provider + Convex JWT auth configured |
| Remove Firebase | ✅ Complete | Firebase package and config removed |
| Deploy schema to Convex | ✅ Complete | Schema deployed with all indexes |

---

### Phase 1: Flashcard Foundation (MVP)
**Goal:** Transform vocabulary saving into active learning

**Status:** 🚧 In Progress

| Feature | Status | Notes |
|---------|--------|-------|
| Enhanced vocabulary input (backend) | ✅ Complete | Convex functions support manual, import, bulk add |
| Enhanced vocabulary input (UI) | ✅ Complete | VocabularyPage with add/filter/search |
| Auto-generated flashcards (backend) | ✅ Complete | Schema + create function done |
| Auto-generated flashcards (AI integration) | ✅ Complete | OpenRouter integration in `convex/ai.ts` |
| Auto-generated flashcards (UI) | ✅ Complete | Generate button on vocabulary cards |
| Sentence refresh (backend) | ✅ Complete | `nextRefreshAt` field + `updateSentence` mutation |
| Sentence refresh (scheduled job) | ❌ Not Started | Need Convex cron job |
| Basic spaced repetition (backend) | ✅ Complete | FSRS algorithm in `flashcards.ts` |
| Basic spaced repetition (UI) | ✅ Complete | FlashcardsPage with review interface |
| Audio flashcards (backend) | ✅ Complete | `audioUrl` field on flashcards |
| Audio flashcards (TTS integration) | ❌ Not Started | Need ElevenLabs integration |
| Audio flashcards (UI) | ✅ Complete | Audio play button on flashcard display |

**Tech notes:**
- Leverage existing OpenRouter/Gemini for sentence generation
- Leverage existing ElevenLabs for audio
- New vocabulary input UI (React)
- New flashcard review UI

---

### Phase 2: Active Output Verification
**Goal:** Users must produce, not just recognize

**Status:** ✅ UI Complete

| Feature | Status | Notes |
|---------|--------|-------|
| Sentence creation (backend) | ✅ Complete | `userSentences.ts` with submit mutation |
| Sentence creation (UI) | ✅ Complete | `PracticePage.tsx` with word selection and input |
| AI verification (backend schema) | ✅ Complete | Scores + corrections in schema |
| AI verification (AI integration) | ✅ Complete | `verifySentence` action in `convex/ai.ts` |
| Mastery tracking (backend) | ✅ Complete | `masteryState` field + `updateMastery` mutation |
| Mastery tracking (UI) | ❌ Not Started | Need progress visualization |
| Feedback loop (backend) | ✅ Complete | `corrections`, `feedback`, `improvedSentence` fields |
| Feedback loop (UI) | ✅ Complete | Score bars, corrections, improved sentence display |

**Tech notes:**
- Use Claude/GPT for verification (more nuanced than rule-based)
- Store user sentences and AI feedback
- New UI for sentence input and feedback display

---

### Phase 3: Personalized Story Generation
**Goal:** Content that reinforces YOUR vocabulary

**Status:** ❌ Not Started

| Feature | Status | Notes |
|---------|--------|-------|
| Stories from your words | ❌ Not Started | Need AI generation pipeline |
| Comprehension questions | ❌ Not Started | Need question generation |
| Integration with flashcards | ❌ Not Started | Need linking logic |

**Tech notes:**
- Extend existing story generation pipeline
- Add vocabulary seeding to generation prompts
- New question generation component

---

### Phase 4: Multi-Language Foundation
**Goal:** Language-agnostic architecture

**Status:** ✅ UI Complete

| Feature | Status | Notes |
|---------|--------|-------|
| Language selection (backend) | ✅ Complete | `users.languages`, `users.primaryLanguage` |
| Language selection (UI) | ✅ Complete | Settings page with language/exam picker |
| Exam-specific vocabulary (schema) | ✅ Complete | `examTypeValidator` with all exams |
| Exam-specific vocabulary (data) | ❌ Not Started | Need to import word lists |
| Language-specific tokenization | ❌ Not Started | Japanese exists in legacy backend |
| Separate content tracks (backend) | ✅ Complete | `language` field on all models |
| Separate content tracks (UI) | ✅ Complete | Vocabulary page filters by language |

**Supported exams in schema:**
- Japanese: JLPT N5-N1
- English: TOEFL, SAT, GRE
- French: DELF A1-B2, DALF C1-C2, TCF

**Tech notes:**
- Abstract tokenization behind interface
- Language field on all content models
- Separate vocabulary list sources per language

---

### Phase 5: Mock Test Generation
**Goal:** AI-generated exams in real formats

**Status:** ✅ Backend Ready

| Feature | Status | Notes |
|---------|--------|-------|
| Exam format templates (schema) | ✅ Complete | `mockTests` table with sections/questions |
| Exam format templates (AI generation) | ❌ Not Started | Need AI integration |
| Personalized test generation | ❌ Not Started | Need AI + vocabulary integration |
| Scoring and analytics (backend) | ✅ Complete | `grade` mutation, score fields |
| Scoring and analytics (UI) | ❌ Not Started | Need results visualization |
| Timed practice (backend) | ✅ Complete | `timeLimitMinutes`, `startedAt`, `completedAt` |
| Timed practice (UI) | ❌ Not Started | Need timer component |
| Listening comprehension (backend) | ✅ Complete | `audioUrl` on sections |
| Listening comprehension (audio gen) | ❌ Not Started | Need TTS integration |
| Dictation exercises | ❌ Not Started | Need speech-to-text comparison |

---

### Phase 6: YouTube Integration
**Goal:** Learn from real video content

**Status:** ❌ Not Started (schema placeholder only)

| Feature | Status | Notes |
|---------|--------|-------|
| YouTube embeds | ❌ Not Started | `youtubeContent` table exists |
| Transcript extraction | ❌ Not Started | Need YouTube API integration |
| Comprehension layer | ❌ Not Started | Need AI question generation |
| Listening practice | ❌ Not Started | Need UI components |

---

### Phase 7: Image-Based Learning
**Goal:** Multi-modal comprehension

**Status:** ❌ Not Started

| Feature | Status | Notes |
|---------|--------|-------|
| Image description practice | ❌ Not Started | Need image + input UI |
| Image comprehension questions | ❌ Not Started | Need AI vision integration |
| AI image generation for prompts | ❌ Not Started | DALL-E 3 exists in legacy |

---

### Phase 8: Email Marketing & User Engagement
**Goal:** Drive retention and re-engagement through personalized email campaigns

**Status:** ❌ Not Started

| Feature | Status | Notes |
|---------|--------|-------|
| Transactional emails | ❌ Not Started | Need email provider setup |
| Engagement campaigns | ❌ Not Started | Need automation platform |
| Re-engagement campaigns | ❌ Not Started | Need user activity tracking |
| Educational drip campaigns | ❌ Not Started | Need content creation |
| User preferences (backend) | ❌ Not Started | Need to add to schema |
| User preferences (UI) | ❌ Not Started | Need settings UI |

**Features:**
1. **Transactional emails**
   - Welcome email on signup
   - Password reset
   - Subscription confirmation/changes
   - Weekly progress summary

2. **Engagement campaigns**
   - "You have X cards due for review" reminders
   - Streak maintenance reminders
   - "New content in your language" announcements
   - Personalized study tips based on performance

3. **Re-engagement campaigns**
   - "We miss you" for inactive users (7, 14, 30 days)
   - "Your vocabulary is fading" with data on words needing review
   - Special offers for churned users

4. **Educational drip campaigns**
   - Onboarding series (how to use SRS effectively)
   - Exam prep tips leading up to test dates
   - Weekly vocabulary spotlights

5. **User preferences**
   - Email frequency settings (daily/weekly/monthly/none)
   - Content type preferences
   - Unsubscribe management

**Tech notes:**
- Use Resend, SendGrid, or Postmark for transactional emails
- Consider Loops, Customer.io, or Mailchimp for marketing automation
- Store email preferences in user settings
- Convex scheduled functions for automated sends
- Track open rates, click rates for optimization

**Potential providers:**
| Provider | Use Case | Notes |
|----------|----------|-------|
| **Resend** | Transactional | Developer-friendly, React Email support |
| **Loops** | Marketing automation | Built for SaaS, good drip campaigns |
| **Customer.io** | Both | Powerful segmentation, event-based |
| **Postmark** | Transactional | Excellent deliverability |

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

EmailCampaign
├── userId
├── campaignType
├── sentAt
├── openedAt
├── clickedAt
└── metadata
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
| **Email** | Resend or Loops (TBD) |

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

## Next Steps

### Immediate (Phase 1 - Payments & Core UI)
| Task | Status | Blocked By |
|------|--------|------------|
| Add Stripe integration for subscriptions | ✅ Complete | - |
| Build vocabulary input UI | ✅ Complete | - |
| Build flashcard review UI | ✅ Complete | - |
| Integrate OpenRouter for sentence generation | ✅ Complete | - |
| Create Convex action for AI calls | ✅ Complete | - |

### Short-term (Phase 1 - Audio & Polish)
| Task | Status | Blocked By |
|------|--------|------------|
| Integrate ElevenLabs for audio | ❌ Not Started | Sentence generation working |
| Test full flashcard flow end-to-end | ❌ Not Started | UI + AI integration |

### Medium-term
| Task | Status | Notes |
|------|--------|-------|
| Import JLPT vocabulary lists | ❌ Not Started | Need data source |
| Import TOEFL/SAT/GRE vocabulary | ❌ Not Started | Need data source |
| Build AI verification UI (Phase 2) | ❌ Not Started | After Phase 1 |

### Later
| Task | Status | Notes |
|------|--------|-------|
| Register domain (sanlang.app) | ❌ Not Started | Before public launch |
| Set up email provider | ❌ Not Started | Phase 8 |

---

## Document Control

**Version**: 2.3
**Last Updated**: 2026-01-21
**Status**: Active development - Phase 1 (Flashcard Foundation)
