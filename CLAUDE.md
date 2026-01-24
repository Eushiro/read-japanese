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

**Always read `ROADMAP.md` before starting work.** It contains the full project vision, phased roadmap, and current implementation status.

When working on roadmap items:
1. **Starting work**: Update `ROADMAP.md` to mark the item as 🚧 **In Progress**
2. **Completing work**: Update `ROADMAP.md` to mark the item as ✅ **Complete**
3. **Blocked**: Note blockers in the roadmap with ❌ and explanation

---

## Important: Do Not Over-Engineer

**Only make changes that are explicitly requested.**

- Do NOT change button appearances, colors, or styling unless asked
- Do NOT refactor or "improve" code that isn't part of the task
- Do NOT add features, animations, or enhancements beyond what was asked
- Keep changes minimal and focused on the specific request

---

## Development Guidelines

See **`docs/DEVELOPMENT.md`** for detailed patterns on:
- Reusing existing components (shadcn/ui, feature components)
- i18n usage and standard terminology translations
- Shared backend abstractions (learner model, content library)
- Analytics integration (`web/src/lib/analytics.ts`)
- Learner model integration for assessments
- Centralized AI generation functions (`web/convex/lib/generation.ts`)

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

## Pre-commit Hooks

See **`docs/HOOKS.md`** for details on:
- What runs on commit (secret detection, Prettier, TypeScript, ESLint, i18n, Convex)
- Conventional commit message format
- How to fix common failures
- Manual validation commands

**Quick reference:**
```bash
cd web
bun run validate      # Run all checks
bun run lint:fix      # Auto-fix ESLint issues
bun run format        # Auto-fix Prettier issues
```

---

## Architecture

See **`docs/ARCHITECTURE.md`** for detailed information on:
- Web app structure (`web/src/`)
- Convex functions by domain (`web/convex/`)
- Key data models (learning, assessment, content, user)
- Admin panel routes and files
- Current implementation status

---

## Common Tasks

See **`docs/TASKS.md`** for step-by-step instructions on:
- Deploying Convex changes (dev + prod)
- Adding YouTube videos (CLI script or manual)
- Managing premade vocabulary decks
- Batch generating content (Python pipeline)

**Quick deploy reference:**
```bash
cd web && npx convex dev --once                                    # Deploy to dev
cd web && npx convex deploy --cmd-url-env-var-name VITE_CONVEX_URL --yes  # Deploy to prod
```

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
| `PRD.md` | Product requirements and feature documentation |
| `docs/DEVELOPMENT.md` | Coding patterns, i18n, analytics, AI integration |
| `docs/ARCHITECTURE.md` | System architecture and data models |
| `docs/TASKS.md` | Step-by-step admin and content tasks |
| `docs/HOOKS.md` | Pre-commit hooks and validation |
| `web/convex/schema.ts` | All Convex table definitions |
| `web/convex/learnerModel.ts` | Unified skill tracking |
| `web/convex/ai.ts` | AI model routing |
| `web/src/main.tsx` | App entry with providers |
| `web/src/router.tsx` | All routes |
| `web/src/lib/analytics.ts` | Analytics abstraction layer |
| `web/src/components/ui/` | Reusable UI components (shadcn/ui) |
