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

## i18n: Use Brand Name Variable

**Never hardcode "SanLang" in translation files.** Use the `{{brandName}}` interpolation variable instead.

```json
// Bad - hardcoded brand name
"tagline": "SanLang - Learn languages with AI"

// Good - uses interpolation variable
"tagline": "{{brandName}} - Learn languages with AI"
```

The brand name is configured in `shared/brand.json` and automatically available in all translations via `{{brandName}}`.

---

## i18n: Never Use Emoji Flags

**Never use emoji flags** (e.g., no country flag emojis like flags for Japan, France, USA, etc.). Use text language names instead.

This applies to:

- UI components displaying languages
- Translation files
- Any user-facing text

**Example:**

```typescript
// Bad - emoji flags
<span>🇯🇵 Japanese</span>

// Good - text only
<span>Japanese</span>
```

---

## Development Guidelines

See **`docs/DEVELOPMENT.md`** for detailed patterns on:

- Reusing existing components (shadcn/ui, feature components)
- i18n usage and standard terminology translations
- Shared backend abstractions (learner model, content library)
- Analytics integration (`web/src/lib/analytics.ts`)
- Learner model integration for assessments
- Centralized AI generation functions (`web/convex/lib/generation.ts`)
- Shared language configuration (`shared/contentLanguages.json`)
- Media compression standards (MP3/WebP)
- Batch API usage for bulk generation
- JSON schemas for AI structured output

See **`docs/DESIGN.md`** for visual design patterns:

- Glass morphism implementation
- Animated backgrounds usage
- Color palette and typography
- Button and card styling
- When to use which visual treatments

---

## Tech Stack

| Layer        | Technology                       |
| ------------ | -------------------------------- |
| **Frontend** | React 19 + Vite + TailwindCSS v4 |
| **Database** | Convex                           |
| **Auth**     | Clerk                            |
| **Routing**  | TanStack Router                  |
| **State**    | TanStack Query + Convex React    |
| **AI**       | OpenRouter (Claude/GPT), Gemini  |
| **Audio**    | ElevenLabs TTS                   |
| **Images**   | DALL-E 3                         |

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

- What runs on commit (secret detection, Prettier, TypeScript, ESLint, i18n, Convex, tests, Claude review)
- Conventional commit message format
- How to fix common failures
- Manual validation commands

**Quick reference:**

```bash
cd web
bun run validate      # Run all checks
bun run lint:fix      # Auto-fix ESLint issues
bun run format        # Auto-fix Prettier issues
bun test              # Run smoke tests
```

---

## Git Workflow for Agents

**After completing work, commit your changes but do NOT push.**

1. **Commit only files you modified** - Use `git add <specific-files>` not `git add -A` or `git add .`
2. **Create the commit** - Follow conventional commit format
3. **Do NOT push** - Let the human review and push when ready
4. **If commit fails with review feedback** - Follow the instructions to fix issues or update docs, then commit again

This allows:

- Multiple agents to work on separate branches
- Human oversight before code reaches remote
- Pre-commit hooks to catch issues early
- Documentation stays in sync with code changes

**Example:**

```bash
# Good - commit specific files
git add web/src/components/MyComponent.tsx web/src/hooks/useMyHook.ts
git commit -m "feat: add new component"

# If review says UPDATE_DOCS - add the doc changes too
git add docs/DEVELOPMENT.md
git commit -m "feat: add new component

- Added MyComponent for X functionality
- Updated DEVELOPMENT.md with new pattern"

# Bad - don't do these
git add -A                    # May include unrelated changes
git add .                     # May include unrelated changes
git push                      # Let human push
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

## Shared Type Definitions

Always import these types instead of redefining them:

| Type              | Frontend Import          | Backend Import      |
| ----------------- | ------------------------ | ------------------- |
| `ContentLanguage` | `@/lib/contentLanguages` | `./schema`          |
| `UILanguage`      | `@/lib/i18n/types`       | `./lib/translation` |
| `ExamType`        | `../../convex/schema`    | `./schema`          |

**Source of truth files:**

- `shared/contentLanguages.json` - Content language configuration
- `web/convex/schema.ts` - All Convex types and validators
- `web/src/lib/i18n/types.ts` - UI language types
- `web/src/lib/contentLanguages.ts` - Frontend language utilities and exam lists

**Never:**

- Redefine types locally that exist in shared locations
- Hardcode language lists - use exported arrays (`LANGUAGES`, `UI_LANGUAGES`, `EXAMS_BY_LANGUAGE`)

---

## Key Files

| File                           | Purpose                                               |
| ------------------------------ | ----------------------------------------------------- |
| `ROADMAP.md`                   | Project vision, phases, and progress tracking         |
| `PRD.md`                       | Product requirements and feature documentation        |
| `docs/DEVELOPMENT.md`          | Coding patterns, i18n, analytics, AI integration      |
| `docs/ARCHITECTURE.md`         | System architecture and data models                   |
| `docs/TASKS.md`                | Step-by-step admin and content tasks                  |
| `docs/HOOKS.md`                | Pre-commit hooks and validation                       |
| `docs/DESIGN.md`               | Visual design system, glass morphism, colors          |
| `shared/contentLanguages.json` | Supported languages (shared between frontend/backend) |
| `web/convex/schema.ts`         | All Convex table definitions                          |
| `web/convex/learnerModel.ts`   | Unified skill tracking                                |
| `web/convex/ai.ts`             | AI model routing                                      |
| `web/src/main.tsx`             | App entry with providers                              |
| `web/src/router.tsx`           | All routes                                            |
| `web/src/lib/analytics.ts`     | Analytics abstraction layer                           |
| `web/src/components/ui/`       | Reusable UI components (shadcn/ui)                    |

---

## Maintaining This Documentation

**When establishing new "always do" patterns**, update the documentation:

1. **Add to `docs/DEVELOPMENT.md`** for coding patterns (or create a new doc file if it's a distinct topic)
2. **Update this CLAUDE.md** to reference the doc file with a brief description of when to consult it
3. **Keep CLAUDE.md concise** - it should be a quick reference that points to detailed docs, not contain all details itself

**Subdirectory CLAUDE.md files** (`backend/CLAUDE.md`, `web/convex/CLAUDE.md`):

- Keep them focused on directory-specific essentials
- Reference `docs/DEVELOPMENT.md` for shared patterns
- Don't duplicate information that's already in the main docs
