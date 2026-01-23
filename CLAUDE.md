# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SanLang** is a multi-language exam prep platform with AI-powered personalization. It evolved from "Read Japanese" (a JLPT graded reader) into a comprehensive learning platform supporting Japanese, English, and French.

### Current Components
- **Web Frontend**: React + Vite app in `web/`
- **Database & Backend**: Convex in `web/convex/`
- **Auth**: Clerk (migration from Firebase in progress)
- **Legacy iOS App**: SwiftUI app in `app/` (not actively developed)
- **Legacy Python Backend**: FastAPI server in `backend/` (being replaced by Convex)

---

## Roadmap & Task Management

### IMPORTANT: Work from ROADMAP.md

**Always read `ROADMAP.md` before starting work.** It contains:
- The full project vision and phased roadmap
- Current implementation status
- Tech stack decisions

### Tracking Progress

When working on roadmap items:
1. **Starting work**: Update `ROADMAP.md` to mark the item as 🚧 **In Progress**
2. **Completing work**: Update `ROADMAP.md` to mark the item as ✅ **Complete**
3. **Blocked**: Note blockers in the roadmap with ❌ and explanation

Use this format in the roadmap:
```markdown
### Phase 1: Flashcard Foundation (MVP)
**Status**: 🚧 In Progress

| Feature | Status | Notes |
|---------|--------|-------|
| Enhanced vocabulary input | ✅ Complete | Convex schema + functions done |
| Auto-generated flashcards | 🚧 In Progress | Schema done, UI pending |
| Sentence refresh | ❌ Blocked | Needs AI integration first |
```

---

## Important: Do Not Over-Engineer

**Only make changes that are explicitly requested.**

- Do NOT change button appearances, colors, or styling unless asked
- Do NOT refactor or "improve" code that isn't part of the task
- Do NOT add features, animations, or enhancements beyond what was asked
- Keep changes minimal and focused on the specific request

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19 + Vite + TailwindCSS v4 |
| **Database** | Convex |
| **Auth** | Clerk |
| **Routing** | TanStack Router |
| **State** | TanStack Query + Convex React |
| **AI** | OpenRouter (Claude/GPT), Gemini |
| **Audio** | ElevenLabs TTS |
| **Images** | DALL-E 3 |

---

## Build and Run Commands

### Web App

```bash
# Install dependencies
cd web && bun install

# Run dev server
cd web && bun dev
# App at http://localhost:5173

# Run Convex dev (in separate terminal)
cd web && npx convex dev

# Type check
cd web && bun run typecheck
```

### Legacy Backend (if needed)

```bash
cd backend && source venv/bin/activate && python run.py
# API at http://localhost:8000
```

---

## Architecture

### Web App (`web/`)
- **Entry**: `src/main.tsx` - ClerkProvider + ConvexProvider setup
- **Routing**: `src/router.tsx` - TanStack Router configuration
- **Auth**: `src/contexts/AuthContext.tsx` - Clerk wrapper for consistent API
- **Components**: `src/components/` - Reusable UI components
- **Pages**: `src/routes/` - Route components

### Convex (`web/convex/`)
- **Schema**: `schema.ts` - All table definitions with validators
- **Functions**: One file per domain:
  - `vocabulary.ts` - Word management with mastery tracking
  - `flashcards.ts` - SRS with FSRS algorithm
  - `subscriptions.ts` - Tier management + usage tracking
  - `userSentences.ts` - Output practice + AI verification
  - `mockTests.ts` - Exam generation + grading
  - `users.ts` - User profile management
  - `settings.ts` - User preferences
  - `progress.ts` - Reading progress
- **Auth**: `auth.config.ts` - Clerk JWT configuration

### Key Data Models
- `vocabulary` - Words with language, mastery state, source tracking
- `flashcards` - SRS cards with FSRS algorithm fields
- `userSentences` - User output with AI verification scores
- `subscriptions` - Tier (free/basic/pro/unlimited) + status
- `usageRecords` - Monthly usage counters per action type
- `mockTests` - Generated exams with sections and questions

---

## Environment Variables

### Required for Web (`web/.env.local`)
```
CONVEX_DEPLOYMENT=dev:your-deployment
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### Required for Convex (set via Convex dashboard)
```
CLERK_JWT_ISSUER_DOMAIN=https://your-clerk-domain.clerk.accounts.dev
```

---

## Current Implementation Status

### ✅ Completed
- Convex schema with all SanLang data models
- Convex functions for vocabulary, flashcards, subscriptions, mock tests
- FSRS-based spaced repetition algorithm
- Usage tracking with tier limits (mocked)
- Basic Clerk integration started

### 🚧 In Progress
- Clerk auth migration (replacing Firebase)

### ❌ Not Started
- Flashcard UI
- Vocabulary input UI
- AI sentence generation integration
- AI verification integration
- Email marketing setup

---

## Common Tasks

### Deploying Convex Changes

**IMPORTANT: Always deploy to BOTH dev and prod when making Convex changes.**

```bash
# Deploy to dev
cd web && npx convex dev --once

# Deploy to prod
cd web && npx convex deploy --cmd-url-env-var-name VITE_CONVEX_URL --yes
```

### Adding a new Convex function
1. Add to appropriate file in `web/convex/`
2. Export as `query` or `mutation`
3. Deploy to both dev and prod (see above)

### Adding a new table
1. Add table definition in `web/convex/schema.ts`
2. Create corresponding functions file
3. Deploy to both dev and prod (see above)

### Testing Convex functions
Use the Convex dashboard at https://dashboard.convex.dev to:
- View data in tables
- Run functions manually
- Check logs

### Adding YouTube Videos

Videos are stored in Convex with transcripts and comprehension questions. To add new videos:

1. **Edit the video data file**: `web/convex/videoData.ts`

2. **Add a new entry to the `VIDEOS` array**:
```typescript
{
  videoId: "your_video_id",     // YouTube ID (11 chars) or custom ID for demo content
  language: "japanese",          // "japanese" | "english" | "french"
  level: "N5",                   // JLPT (N5-N1) or CEFR (A1-C2)
  title: "Video Title",
  description: "Brief description.",
  duration: 180,                 // Seconds
  transcript: [
    { text: "First line", start: 0, duration: 3 },
    { text: "Second line", start: 3, duration: 4 },
    // ... more segments
  ],
  questions: [
    {
      question: "What is discussed?",
      type: "multiple_choice",
      options: ["Option A", "Option B", "Option C", "Option D"],
      correctAnswer: "Option A",
      timestamp: 0,              // Optional: seconds into video
    },
    // ... at least 3 questions per video
  ],
}
```

3. **Run the seed command**:
```bash
cd web && npx convex run youtubeContent:seedAllVideos
```

4. **Deploy to production**:
```bash
cd web && npx convex deploy --cmd-url-env-var-name VITE_CONVEX_URL --yes
```

**Video ID Types:**
- **Real YouTube videos**: Use the 11-character ID from the URL (e.g., `arj7oStGLkU`)
- **Demo content**: Use descriptive IDs (e.g., `jp_n5_intro`, `en_a1_greetings`)
  - Demo videos show a language-colored placeholder instead of embedded player
  - Good for testing or when you don't have actual YouTube content

**Validation:** The seed command validates all videos before saving. Common errors:
- Missing required fields (videoId, title, description, language, level, duration)
- Wrong level format (Japanese: N5-N1, others: A1-C2)
- Fewer than 3 questions
- correctAnswer not matching any option
- Empty transcript

---

## Legacy Systems (Reference Only)

### iOS App (`app/`)
- SwiftUI app connecting to legacy backend
- Not actively developed; web app is the focus

### Python Backend (`backend/`)
- FastAPI server on Render
- Still serves iOS app
- Being replaced by Convex for web app

---

## Key Files

| File | Purpose |
|------|---------|
| `ROADMAP.md` | Project vision, phases, and progress tracking |
| `PRD.md` | Original product requirements (legacy reference) |
| `web/convex/schema.ts` | All Convex table definitions |
| `web/src/main.tsx` | App entry with providers |
| `web/src/contexts/AuthContext.tsx` | Auth state wrapper |
