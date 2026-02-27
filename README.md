# SanLang

AI-powered language learning platform for Japanese, English, and French. It personalizes to your goal (exam prep, travel, professional, media, or casual) and your interests (food, gaming, travel, etc.) — generating stories, practice questions, and exercises around what's actually relevant to you.

## What it does

**Personalization** — during onboarding you pick your language, level, goal, and interests. The app generates content (stories, practice questions, example sentences) from your own vocabulary and the topics you care about.

**The learning loop:**

- **Read & Watch** — graded stories and YouTube videos with tap-to-define, word saving, and furigana support (Japanese)
- **Flashcards** — spaced repetition (FSRS algorithm) with AI-generated example sentences at your level
- **Adaptive Practice** — questions adjust to your ability in real time using IRT; first session is diagnostic so no placement test required
- **Active Output** — write sentences using target vocabulary, get instant AI feedback on grammar, naturalness, and usage
- **Mock Exams** — full simulations for JLPT (N5–N1), TOEFL, SAT, GRE, DELF/DALF, and TCF with AI-graded essays

**Learner model** — a unified skill tracker (Vocabulary, Grammar, Reading, Listening, Writing, Speaking) that updates after every activity and predicts your exam readiness.

## Repo structure

```
├── web/          # React web app (active)
│   ├── src/      # Frontend (React + Vite)
│   └── convex/   # Backend (database, auth, AI functions)
├── pipeline/     # Content generation scripts (TypeScript)
├── app/          # Legacy iOS app (SwiftUI, not actively developed)
└── backend/      # Legacy Python API (FastAPI, being replaced by Convex)
```

## Tech stack

| Layer      | Technology                               |
| ---------- | ---------------------------------------- |
| Frontend   | React 19, Vite, TailwindCSS v4           |
| Backend    | Convex (database + serverless functions) |
| Auth       | Clerk                                    |
| Routing    | TanStack Router                          |
| AI         | OpenRouter (Claude/GPT), Gemini          |
| Audio      | ElevenLabs TTS                           |
| Images     | DALL-E 3                                 |
| Payments   | Stripe                                   |
| Algorithms | FSRS (spaced repetition), IRT (adaptive) |

## Running locally

```bash
cd web
bun install
bun dev          # Frontend at http://localhost:5173
npx convex dev   # Backend (separate terminal)
```
