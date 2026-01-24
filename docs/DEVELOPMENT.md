# Development Guidelines

This document covers coding standards and patterns for the SanLang codebase.

## 1. Reuse Existing Components

**Always check for existing components before creating new ones.**

**UI Components (`web/src/components/ui/`):**
- `Button`, `Card`, `Tabs`, `Progress`, `Alert`, `Table`, `Label`, `Separator`
- `DropdownMenu`, `Collapsible`, `Textarea`, `Chart`, `Badge`, `Skeleton`, `Select`, `Input`
- These are shadcn/ui components - **ALWAYS use these instead of creating custom UI**

**IMPORTANT: Always Use shadcn/ui Components**
- Every form input, button, card, modal, dropdown, etc. MUST use shadcn/ui components
- Never create custom styled divs/buttons when a shadcn component exists
- Check https://ui.shadcn.com/docs/components for available components
- If a component doesn't exist, install it with `npx shadcn@latest add <component>`

**Feature Components:**
- `web/src/components/vocabulary/` - VocabularyCard, DeckPanel, word display
- `web/src/components/flashcards/` - FlashcardDisplay, review interface
- `web/src/components/progress/` - SkillRadar, ProgressChart, WeakAreasList
- `web/src/components/session/` - SessionProgress, SessionReview, SessionComplete
- `web/src/components/reader/` - ReaderView, WordPopup, ChapterNav
- `web/src/components/admin/` - AdminLayout, AdminSidebar

**Before creating a new component:**
1. Search `web/src/components/` for similar functionality
2. Check if an existing component can be extended with props
3. If truly new, place in appropriate subdirectory

---

## 2. Use i18n for All User-Facing Text

**NEVER hardcode user-facing strings in JSX.** All text must use the translation system.

**Import the translation function:**
```typescript
import { useT } from '@/lib/i18n';

function MyComponent() {
  const t = useT();
  return <button>{t('common.actions.save')}</button>;
}
```

**Translation key format:**
- Keys follow the pattern: `namespace.section.key`
- Common namespaces: `common`, `dashboard`, `settings`, `vocabulary`, `flashcards`, `library`, `landing`
- Example: `t('settings.appearance.dark')` → "Dark" / "Sombre" / "ダーク" / "深色"

**Adding new translations:**
1. Add the key to `web/src/lib/i18n/locales/en/*.json` first (source of truth)
2. Add translations to `ja/`, `fr/`, `zh/` files
3. **Use natural, colloquial translations** - not word-for-word literal. Each language should sound native and idiomatic to speakers of that language.

**What NOT to translate:**
- Technical values (e.g., `value="small"` in select options)
- Variable names, class names, IDs
- Admin-only sections (can stay English)

**ESLint will flag hardcoded strings** - fix them by adding translation keys.

**Standard terminology (use these exact terms, don't use synonyms):**

| English | Japanese | French | Chinese | Notes |
|---------|----------|--------|---------|-------|
| Flashcards | フラッシュカード | Flashcards | 闪卡 | Not "cards" or "study cards" |
| Vocabulary | 語彙 | Vocabulaire | 词汇 | Not "words" when referring to the feature |
| Review | 復習 | Révision | 复习 | For SRS review sessions |
| Mastery | マスター | Maîtrise | 掌握 | Vocabulary mastery levels |
| Learning | 学習中 | En cours | 学习中 | Mastery state |
| Mastered | マスター済み | Maîtrisé | 已掌握 | Mastery state |
| Story/Stories | ストーリー | Histoire(s) | 故事 | Graded reader content |
| Library | ライブラリ | Bibliothèque | 图书馆 | Content browsing section |
| Practice | 練習 | Pratique | 练习 | Output practice (writing sentences) |
| Exam/Exams | 試験 | Examen(s) | 考试 | Practice exams |
| Progress | 進捗 | Progrès | 进度 | Learning progress tracking |
| Readiness | 準備状況 | Préparation | 准备程度 | Exam readiness indicator |
| Again | もう一度 | Encore | 重来 | SRS rating - forgot |
| Hard | 難しい | Difficile | 困难 | SRS rating |
| Good | 良い | Bien | 良好 | SRS rating |
| Easy | 簡単 | Facile | 简单 | SRS rating |
| Sign in | ログイン | Se connecter | 登录 | Not "log in" |
| Upgrade | アップグレード | Mettre à niveau | 升级 | Subscription upgrade |
| Free/Basic/Pro/Power | 無料/ベーシック/プロ/パワー | Gratuit/Basique/Pro/Power | 免费/基础/专业/强力 | Subscription tiers |
| Deck | デッキ | Paquet | 卡组 | Vocabulary deck/card deck |
| Mock Test | 模擬テスト | Test blanc | 模拟考试 | Use 考试 not 测试 in Chinese |
| Shadowing | シャドーイング | Shadowing | 跟读 | Speaking practice feature |
| Quiz | クイズ | Quiz | 测验 | Comprehension quizzes |
| Dashboard | ダッシュボード | Tableau de bord | 仪表盘 | Main learning dashboard |
| Premium | プレミアム | Premium | 高级 | Premium content/features |

**Tone guidelines:**
- Friendly and encouraging, not formal or academic
- Use contractions in English ("You've" not "You have")
- Celebrate achievements ("Great job!" "Well done!")
- Be direct and concise, not verbose

---

## 3. Create Shared Abstractions

**Backend patterns to follow:**

```typescript
// Learner model integration - call after any learning activity
import { internal } from "./_generated/api";

// After flashcard reviews:
await ctx.scheduler.runAfter(0, internal.learnerModel.updateFromFlashcardsInternal, {...});

// After exams:
await ctx.scheduler.runAfter(0, internal.learnerModel.updateFromExamInternal, {...});

// After comprehension quizzes:
await ctx.scheduler.runAfter(0, internal.learnerModel.updateFromComprehensionInternal, {...});

// After sentence practice:
await ctx.scheduler.runAfter(0, internal.learnerModel.updateFromSentencePracticeInternal, {...});
```

**Content library pattern - use shared pools:**
```typescript
// Instead of storing content directly on flashcards/vocabulary:
// ❌ flashcard.sentence, flashcard.imageUrl, flashcard.audioUrl

// Use content library references:
// ✅ sentences table, images table, wordAudio table
// Link via sentenceId, imageId, wordAudioId
```

**Question patterns:**
- Use `storyQuestions` / `videoQuestions` for cached questions by difficulty (1-6)
- Use `examQuestions` for exam question bank
- Use `questionHistory` to record all answered questions

---

## 4. Add Analytics to New Features

**All analytics go through the shared abstraction in `web/src/lib/analytics.ts`.**

This allows us to swap providers (PostHog → Amplitude, etc.) without changing feature code.

```typescript
import { trackEvent, AnalyticsEvents } from '@/lib/analytics';

function MyNewFeature() {
  // Track feature usage
  trackEvent('feature_name_started', {
    language: 'japanese',
    level: 'N3',
  });

  // Track completion
  trackEvent('feature_name_completed', {
    duration_seconds: 120,
    score: 85,
  });

  // Use predefined event names when available
  trackEvent(AnalyticsEvents.FLASHCARD_RATED, { rating: 'good' });
}
```

**DO NOT use PostHog directly:**
```typescript
// ❌ Wrong - direct PostHog usage bypasses abstraction
import { usePostHog } from 'posthog-js/react';
posthog.capture('event', {...});

// ✅ Correct - use the abstraction
import { trackEvent } from '@/lib/analytics';
trackEvent('event', {...});
```

**Standard events to track:**
- `{feature}_started` - User begins the feature
- `{feature}_completed` - User finishes successfully
- `{feature}_abandoned` - User leaves without completing
- `{feature}_error` - Something went wrong

**AI action tracking - use `useAIAction` instead of `useAction`:**
```typescript
// ❌ Wrong - no analytics tracking
import { useAction } from "convex/react";
const verifySentence = useAction(api.ai.verifySentence);

// ✅ Correct - automatic analytics tracking (completely seamless!)
import { useAIAction } from '@/hooks/useAIAction';
const verifySentence = useAIAction(api.ai.verifySentence);

// Use exactly like useAction - tracking is automatic
const result = await verifySentence(args);
```

The `useAIAction` hook:
- Auto-detects operation name from the action reference (`api.ai.verifySentence` → `verify_sentence`)
- Tracks `ai_request_started` before the action
- Tracks `ai_request_completed` with latency on success
- Tracks `ai_request_failed` with error message on failure

**Optional overrides:**
```typescript
// Override auto-detected operation name or model
const verifySentence = useAIAction(api.ai.verifySentence, {
  operationName: "custom_name",  // Override auto-detection
  model: "gpt-4",                // Default: "gemini-2.0-flash"
});
```

**Manual tracking (for non-hook contexts):**
```typescript
import { trackAIRequest, trackAISuccess, trackAIError } from '@/lib/analytics';

trackAIRequest('sentence_generation', 'gemini-2.0-flash', { word_count: 5 });
trackAISuccess('sentence_generation', 'gemini-2.0-flash', 1500);
trackAIError('sentence_generation', 'gemini-2.0-flash', 'timeout');
```

**Adding new event types:** Add to `AnalyticsEvents` in `analytics.ts` to keep events consistent.

---

## 5. Integrate with Learner Model

**Any feature that assesses user knowledge should update the learner model.**

New quiz/assessment features must:
1. Record questions to `questionHistory` via `learnerModel.recordQuestion`
2. Update relevant skills via the appropriate `updateFrom*` function
3. Include skill weights if the question tests multiple skills

```typescript
// Example: New comprehension feature
await ctx.runMutation(internal.learnerModel.recordQuestion, {
  userId,
  language: "japanese",
  sourceType: "my_new_feature",
  sourceId: featureId,
  questionContent: { questionText, questionType, correctAnswer },
  userAnswer,
  skills: [
    { skill: "reading", weight: 0.7 },
    { skill: "vocabulary", weight: 0.3 },
  ],
  grading: { isCorrect, score, gradedAt: Date.now() },
});
```

---

## 6. Use Centralized Generation Functions

**All AI content generation MUST go through `web/convex/lib/generation.ts`.**

This ensures:
- **Paywall enforcement** - Usage limits are checked before generation
- **Usage metering** - All AI usage is tracked for billing
- **Content reuse** - Existing content is returned when available
- **Seen tracking** - Users don't see the same content twice

**DO NOT call AI APIs directly from features:**
```typescript
// ❌ Wrong - bypasses paywall and usage tracking
import { generateSentenceHelper } from "./ai";
const result = await generateSentenceHelper({...});

// ✅ Correct - uses gated generation layer
import { internal } from "./_generated/api";
const result = await ctx.runAction(internal.lib.generation.generateSentenceForWord, {
  userId,
  vocabularyId,
  word: "...",
  definitions: [...],
  language: "japanese",
  examLevel: "N3",
});
```

**Available generation functions:**
- `generateSentenceForWord` - Generate example sentences with auto content reuse
- `generateImageForWord` - Generate flashcard images with auto content reuse
- `generateAudioForText` - Generate TTS audio for sentences or words
- `verifySentenceWithGating` - AI-grade user sentences

**Content reuse flow:**
1. Check content library for existing content
2. Filter to content user hasn't seen
3. If found, return existing and mark as seen
4. If not, generate new, store in library, increment usage
5. Return result with `wasReused` flag for analytics

**Skip usage check for admin/batch operations:**
```typescript
// For batch generation or admin operations
await ctx.runAction(internal.lib.generation.generateSentenceForWord, {
  ...args,
  skipUsageCheck: true, // Bypasses paywall for batch ops
});
```

---

## 7. Use Shared Language Configuration

**All language support is defined in `shared/languages.json`** - the single source of truth for both frontend and backend.

**In the frontend (`web/src/lib/languages.ts`):**
```typescript
import { LANGUAGES, SUPPORTED_LANGUAGE_CODES, TRANSLATION_TARGETS } from "@/lib/languages";

// LANGUAGES = [{value: "japanese", label: "Japanese", flag: "🇯🇵", ...}, ...]
// SUPPORTED_LANGUAGE_CODES = ["japanese", "english", "french"]
// TRANSLATION_TARGETS = ["english", "japanese", "french"]
```

**In the Python backend (`backend/app/config/languages.py`):**
```python
from app.config.languages import (
    LANGUAGE_CODES,              # ["japanese", "english", "french"]
    LANGUAGE_NAMES,              # {"japanese": "Japanese", ...}
    TRANSLATION_TARGETS,         # Languages to generate translations for
    CODE_TO_ISO,                 # {"japanese": "ja", ...}
    get_translation_targets_for, # Get translation targets excluding source
    is_valid_language,           # Validate language codes
)

# When generating translations:
targets = get_translation_targets_for("japanese")  # Returns ["english", "french"]
iso_codes = [CODE_TO_ISO[lang] for lang in targets]  # Returns ["en", "fr"]
```

**DO NOT:**
- Hardcode language lists - always import from the shared config
- Add languages without updating `shared/languages.json`
- Define local `LANGUAGE_NAMES` or similar mappings that duplicate the config

**Adding a new language:**
1. Add to `shared/languages.json` with all required fields
2. Run `cd web && bun run typecheck` to verify TypeScript
3. Add i18n locale files in `web/src/lib/i18n/locales/<isoCode>/`
4. Update `EXAMS_BY_LANGUAGE` in `web/src/lib/languages.ts` if applicable

See `shared/README.md` for full documentation.

---

## 8. Media Compression Standards

**All generated media must be compressed before storage.**

| Media Type | Format | Settings | Savings |
|------------|--------|----------|---------|
| Audio | MP3 | 64kbps mono | ~90% vs WAV |
| Images | WebP | Quality 80-85, max 800px | ~70-95% vs PNG |

**Convex (frontend):**
- Audio: Gemini TTS outputs MP3 directly (configured in `ai.ts`)
- Images: Use `compressToWebp()` from `lib/imageCompression.ts` before upload

**Python backend:**
```python
from app.services.generation import (
    compress_audio_to_mp3,    # PCM/WAV -> MP3
    compress_image_to_webp,   # Any image -> WebP
)
```

**DO NOT:**
- Store audio as WAV
- Store images as PNG
- Store original uncompressed files
- Implement custom compression logic

---

## 9. Batch API for Bulk Generation (Backend)

**For 5+ items, always use Google Batch API** (50% cost savings).

```python
from app.services.generation import run_text_batch

results = await run_text_batch(
    prompts={"word_1": "prompt...", "word_2": "prompt..."},
    system_prompt="...",
    model="gemini-3-flash-preview",
)
```

The batch generation functions automatically use Batch API for 5+ items.

**DO NOT** make individual API calls in a loop for bulk generation.

---

## 10. JSON Schemas for AI Structured Output

**Always use JSON schemas when requesting structured data from AI models.**

```python
from pydantic import BaseModel

class OutputItem(BaseModel):
    word: str
    sentence: str
    translations: Dict[str, str]

response = client.models.generate_content(
    model=model,
    contents=prompt,
    config=types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=list[OutputItem],
    )
)
```

**Why:** Guarantees valid JSON, enforces types, reduces parsing errors.
