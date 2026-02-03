# SanLang Product Evolution Plan

## Vision

Transform SanLang from an exam-prep platform into a **goal-based language mastery platform** where AI personalizes every aspect of learning - from content difficulty to story themes to practice targeting.

**North Star:** One smart session that knows exactly what you need to learn next, generates content at your level, and handles repetition invisibly.

---

## Phase 1: Beginner Experience & Goal Paths

**Goal:** Give complete beginners a clear starting point and let all users choose their learning path.

### 1.1 Enhanced Onboarding Flow

Update onboarding modal to collect:

1. **Language selection** (existing)
2. **Learning goal** (new)
   - Pass an exam (JLPT, TOEFL, DELF, etc.)
   - Travel/Conversation
   - Professional/Business use
   - Media consumption (anime, films, books)
   - Just exploring
3. **Interests** (new) - pick 3-5 topics
   - Food & cooking, Sports, Technology, Nature, Relationships, Business, Pop culture, History, Travel, Music, etc.
4. **Target exam** (conditional - only if goal is exam)
5. **Current level assessment** (optional placement test prompt)

**Files to modify:**

- `web/src/components/onboarding/OnboardingModal.tsx`
- `web/convex/schema.ts` - add `goal` and `interests` to user profile
- `web/convex/users.ts` - update profile mutation

### 1.2 Goal-Based Vocabulary Sourcing (Hybrid)

**For exam-focused users:**

- Use curated frequency lists (existing premade decks infrastructure)
- Map to exam levels (N5 vocab, N4 vocab, etc.)
- Drip-feed based on target exam timeline

**For goal-specific users (travel, media, professional):**

- AI generates relevant vocabulary based on goal + interests
- Example: "Travel to Japan" + "Food" → restaurant vocab, ordering phrases, food names
- Store as personalized "starter deck" in `vocabularyDecks` table

**Files to modify:**

- `web/convex/vocabularyDecks.ts` - add goal-based deck generation
- `web/convex/lib/generation.ts` - add vocabulary list generation function
- New: `web/convex/onboarding.ts` - orchestrate beginner setup

### 1.3 "Foundations" Track for Beginners

Create a structured beginner experience:

```
Foundations Track (First 100 Words)
├── Daily unlocks: 5-10 new words
├── Each word includes:
│   ├── Flashcard with audio + image
│   ├── Example sentence at beginner level
│   └── Practice: use word in context
├── After every 10-20 words:
│   └── AI-generated micro-story using only learned words
└── Completion → Unlock full app experience
```

**Interest-embedded stories:**

- Story generation prompt includes user's interests
- Even with 20-word vocabulary, stories feel personally relevant
- Example: User interested in cooking → story about preparing a simple meal

**Files to modify:**

- New: `web/src/pages/FoundationsPage.tsx` - beginner track UI
- New: `web/convex/foundations.ts` - track progress, unlock logic
- `web/convex/lib/generation.ts` - add beginner story generation with vocabulary constraints
- `web/src/router.tsx` - add `/foundations` route

### 1.4 Goal-Aware Dashboard

Dashboard adapts messaging based on user's goal:

| Goal   | Dashboard Focus                                            |
| ------ | ---------------------------------------------------------- |
| Exam   | "82% ready for N3" + mock test CTA                         |
| Travel | "45 conversation phrases mastered" + practice dialogue CTA |
| Media  | "You can understand 60% of anime dialogue" + listening CTA |
| Casual | "15-day streak!" + story recommendation                    |

**Files to modify:**

- `web/src/pages/DashboardPage.tsx` - conditional messaging
- `web/src/components/dashboard/` - goal-specific widgets

---

## Phase 2: Adaptive Content Engine

**Goal:** Make the learner model actually drive content selection with i+1 targeting.

### 2.1 Content Difficulty Matching

When selecting content (stories, videos, sentences), filter by user's ability:

```typescript
// In session building / content selection
const userAbility = learnerProfile.abilityEstimate; // -3 to +3 IRT scale
const targetLevel = abilityToProficiency(userAbility + 0.3); // i+1
const content = await filterContentByDifficulty(targetLevel, (buffer = 1));
```

**Files to modify:**

- `web/convex/studySessions.ts` - add difficulty filtering to `buildSessionPlan`
- `web/convex/stories.ts` - add ability-filtered queries
- `web/convex/videos.ts` - add ability-filtered queries
- `web/convex/learnerModel.ts` - add `getRecommendedDifficulty` helper

### 2.2 Vocabulary Coverage Check

Before showing content, verify user knows enough words:

```typescript
async function checkReadiness(userId, contentId) {
  const knownWords = await getKnownVocabulary(userId, language);
  const contentWords = await extractVocabulary(contentId);
  const coverage = intersection(knownWords, contentWords) / contentWords.length;

  if (coverage < 0.85) {
    // Option A: Pre-teach unknown words first
    // Option B: Select different content
    // Option C: Warn user but allow
  }
  return { ready: coverage >= 0.85, coverage, unknownWords };
}
```

**Files to modify:**

- New: `web/convex/contentReadiness.ts` - coverage checking logic
- `web/convex/stories.ts` - integrate readiness check
- `web/src/pages/ReaderPage.tsx` - show "pre-teach" flow if needed

### 2.3 Weak Area Targeting

Use `learnerProfile.weakAreas` to select practice content:

```typescript
const weakAreas = learnerProfile.weakAreas; // ["passive voice", "N3 kanji", "listening"]
const questions = await generateQuestions({
  targetSkills: weakAreas,
  userId,
  language,
});
```

**Files to modify:**

- `web/convex/studySessions.ts` - target weak areas in practice activities
- `web/convex/lib/generation.ts` - add weak-area-targeted question generation
- `web/convex/learnerModel.ts` - improve weak area detection

### 2.4 Adaptive Story Generation

Generate stories that use the user's actual vocabulary:

```typescript
async function generatePersonalizedStory(userId, language) {
  const vocab = await getUserVocabulary(userId, language);
  const knownWords = vocab.filter((v) => v.mastery >= "tested");
  const learningWords = vocab.filter((v) => v.mastery === "learning");
  const interests = await getUserInterests(userId);

  return generateStory({
    mustUseWords: learningWords.slice(0, 5), // Reinforce these
    preferWords: knownWords, // 90% from known
    newWordBudget: 3, // i+1: only 3 new words
    topics: interests,
    difficulty: userLevel,
  });
}
```

**Files to modify:**

- `web/convex/stories.ts` - add personalized generation endpoint
- `web/convex/lib/generation.ts` - add vocabulary-constrained story generation
- `web/src/components/library/GenerateStoryModal.tsx` - option for "personalized for me"

---

## Phase 3: UI Simplification & Embedded Repetition

**Goal:** Make sessions the primary experience; embed flashcard repetition into natural learning flow.

### 3.1 Sessions as Primary Experience

Restructure navigation:

```
Dashboard
├── "Start Learning" (primary CTA) → /study-session
├── Quick stats + streak
└── Recommendations

/study-session (enhanced)
├── AI builds personalized plan
├── Activities flow naturally
└── Review embedded, not separate

/learn (secondary - "Free Study")
├── Vocabulary browser
├── Dedicated flashcard review
└── Writing practice
```

**Changes:**

- Dashboard CTA becomes session-focused
- `/learn` tabs remain but are de-emphasized
- New users guided to sessions by default

**Files to modify:**

- `web/src/pages/DashboardPage.tsx` - primary CTA to sessions
- `web/src/components/navigation/` - adjust nav emphasis
- `web/src/pages/LearnPage.tsx` - frame as "Free Study" / advanced

### 3.2 Smarter Session Building

Sessions adapt to:

- Time available (5/15/30 min)
- User's current state (cards due, weak areas, streak)
- Goal (exam users get test-format questions, travel users get conversation)

```typescript
function buildSessionPlan(userId, duration, goal) {
  const cards = getDueCards(userId);
  const weakAreas = getWeakAreas(userId);
  const goalActivities = getGoalSpecificActivities(goal);

  return optimizePlan({
    reviewCards: Math.min(cards.length, duration * 2),
    inputActivity: selectContent(userAbility, goal),
    outputActivity: selectPractice(weakAreas, goal),
    duration,
  });
}
```

**Session Breadcrumb UI:**
Show progress at top of session so users know what's ahead:

```
┌─────────────────────────────────────────────────────────────┐
│  [●] Review    →    [ ] Read Story    →    [ ] Practice    │
│      12 cards         "A Day Out"           2 sentences    │
└─────────────────────────────────────────────────────────────┘
```

- Current activity highlighted/filled
- Upcoming activities shown with previews (story title, card count)
- Clickable to see details but not skip ahead
- Collapses to minimal bar during activity focus

**Files to modify:**

- `web/convex/studySessions.ts` - enhance `buildSessionPlan`
- `web/src/pages/StudySessionPage.tsx` - goal-aware UI
- New: `web/src/components/session/SessionBreadcrumbs.tsx` - progress breadcrumb component

### 3.3 Embedded Repetition

Instead of dedicated "Review" activity, weave repetition into activities:

**During reading:**

- Stories include recently-learned words
- Tap-to-translate reinforces recognition

**During practice:**

- Sentence prompts use words needing review
- AI feedback includes spaced repetition signals

**After content:**

- Quick "Did you remember these?" micro-quiz
- 3-5 words, takes 30 seconds

**Explicit flashcard review becomes optional** - power users can still access via Free Study.

**Files to modify:**

- `web/convex/studySessions.ts` - embed review words in other activities
- `web/src/components/session/SessionInput.tsx` - weave in vocab reinforcement
- `web/src/components/session/SessionOutput.tsx` - use review words in prompts
- New: `web/src/components/session/MicroReview.tsx` - quick post-activity quiz

### 3.4 Smart Flashcard Management

For users who do use explicit flashcards:

- **Cap reviews per session** (e.g., max 30) - prevent overwhelm
- **Forgiveness mode** - long-overdue cards restart instead of punish
- **Priority sorting** - "most at risk" cards first
- **Smart nudges** - "2-minute review before bed?" notification
- **Vacation mode** - pause scheduling

**Files to modify:**

- `web/convex/flashcards.ts` - add capping, forgiveness, priority
- `web/src/pages/FlashcardsPage.tsx` - show "most important" first
- `web/convex/userPreferences.ts` - vacation mode setting

---

## Implementation Order

### Milestone 1: Beginner Foundation (Phase 1.1-1.3)

1. Enhanced onboarding with goals + interests
2. Goal-based vocabulary generation (hybrid approach)
3. Foundations track for beginners
4. Interest-embedded beginner stories

### Milestone 2: Goal-Aware Experience (Phase 1.4 + 3.1)

1. Goal-specific dashboard messaging
2. Sessions as primary CTA
3. Free Study as secondary option

### Milestone 3: Adaptive Engine (Phase 2.1-2.3)

1. Content difficulty matching
2. Vocabulary coverage checks
3. Weak area targeting

### Milestone 4: Personalized Content (Phase 2.4)

1. Adaptive story generation using user's vocabulary

### Milestone 5: Embedded Repetition (Phase 3.2-3.4)

1. Smarter session building
2. Repetition woven into activities
3. Smart flashcard management

---

## Verification

After implementation, verify:

1. **Beginner flow:** Create new account → complete onboarding with interests → see Foundations track → learn first 20 words → read personalized micro-story
2. **Goal paths:** Select "Travel" goal → dashboard shows travel-relevant metrics → sessions prioritize conversation content
3. **Adaptive content:** User at N4 level → recommended content is N4/N3 → N1 content not shown unless requested
4. **Coverage check:** Try to read story with 50% unknown vocab → system suggests pre-teaching or alternative
5. **Session flow:** Start 15-min session → activities feel cohesive → review happens naturally within activities
6. **Flashcard sanity:** Miss reviews for a week → returning shows manageable queue, not 200 overdue cards

---

## Technical Architecture

### Schema Changes Required

**1. Users table additions:**

```typescript
users: defineTable({
  // ... existing fields

  // NEW: Primary learning goal
  learningGoal: v.optional(
    v.union(
      v.literal("exam"),
      v.literal("travel"),
      v.literal("professional"),
      v.literal("media"),
      v.literal("casual"),
    ),
  ),

  // NEW: User interests (moves from userPreferences.content to main profile)
  interests: v.optional(v.array(v.string())),

  // NEW: Foundations track progress
  foundationsProgress: v.optional(
    v.object({
      wordsUnlocked: v.number(),
      wordsLearned: v.number(),
      storiesUnlocked: v.number(),
      completedAt: v.optional(v.number()),
    }),
  ),
});
```

**2. New table for concept/grammar practice tracking:**

```typescript
// Track when concepts (not just vocab) were last practiced for spaced review
conceptPracticeHistory: defineTable({
  userId: v.string(),
  language: languageValidator,
  conceptType: v.union(v.literal("grammar"), v.literal("pattern")),
  conceptId: v.string(), // "passive_voice", "te_form", "counters", etc.

  // Practice history
  lastPracticedAt: v.number(),
  practiceCount: v.number(),
  correctCount: v.number(),
  currentScore: v.number(), // 0-100

  // SRS-like scheduling for concepts
  nextReviewAt: v.optional(v.number()),
  intervalDays: v.optional(v.number()),
})
  .index("by_user_language", ["userId", "language"])
  .index("by_user_due", ["userId", "nextReviewAt"]);
```

**3. learnerProfile enhancements:**

```typescript
learnerProfile: defineTable({
  // ... existing fields

  // NEW: Track concept mastery separately from vocabulary
  conceptMastery: v.optional(
    v.array(
      v.object({
        conceptId: v.string(),
        conceptType: v.string(),
        score: v.number(),
        lastPracticedAt: v.number(),
      }),
    ),
  ),
});
```

### Session Generation Strategy

**Current:** Sessions built on-demand in frontend (`sessionPlanner.ts`). No pre-generation.

**Recommended: Hybrid approach**

```
┌─────────────────────────────────────────────────────────────┐
│                    Session Generation                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Background Jobs (daily/hourly):                            │
│  ├── Pre-generate story pools per difficulty level          │
│  ├── Pre-generate sentences for common vocabulary           │
│  └── Cache questions for weak area patterns                 │
│                                                             │
│  On Session Start:                                          │
│  ├── Pull flashcards (instant - no generation)              │
│  ├── Select content from pre-generated pools                │
│  └── Queue personalized generation for next activity        │
│                                                             │
│  During Session:                                            │
│  ├── While user reviews cards → generate story in background│
│  └── Swap in personalized content when ready                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**After session completion:**

- User returns to results → dashboard
- Can immediately start another session (no daily limit)
- New session gets fresh plan based on updated state

### Cost Control Strategies

**1. Content reuse (maximize existing infrastructure):**

```typescript
// Before generating, check content libraries
const existing = await ctx.db
  .query("sentences")
  .withIndex("by_word_language", (q) => q.eq("word", word).eq("language", lang))
  .filter((q) => q.gte(q.field("difficulty"), targetDiff - 1))
  .first();

if (existing) return existing; // No AI cost!
```

**2. Credit-based generation (all tiers pay credits):**

```typescript
// All AI generation costs credits - no infinite tier
const GENERATION_COSTS = {
  sentence: 1, // Generate example sentence
  story: 10, // Generate personalized story
  feedback: 2, // AI grading/feedback
  vocabList: 5, // Generate goal-based vocab list
};

// Tier differences are in monthly credit allocation, not unlimited access
const MONTHLY_CREDITS = {
  free: 50,
  plus: 500,
  pro: 2000,
};
```

**3. Model selection by task:**

```typescript
// Fast/cheap for simple tasks
const SIMPLE_TASKS = ["vocabulary_list", "sentence_translation"];
// Better models for complex generation
const COMPLEX_TASKS = ["story_generation", "essay_grading"];
```

**4. Batch pre-generation (already have batchJobs infrastructure):**

- Use existing `batchJobs` table for bulk generation off-peak
- Pre-populate content libraries for common vocabulary

### Responsiveness / Loading UX

**Problem:** AI generation causes wait times.

**Solution: Progressive loading pattern**

```
Session Start Flow:
┌────────────────────────────────────────────────────────────┐
│ 1. User clicks "Start Session"                             │
│    └── Instant: Show session overview (cards due, etc.)    │
│                                                            │
│ 2. Begin with flashcard review (no generation needed)      │
│    └── Background: Start generating story/content          │
│                                                            │
│ 3. User finishes cards → transition to reading             │
│    └── If ready: Show personalized story                   │
│    └── If not ready: Show "Generating your story..."       │
│        with nice animation (typically <5 seconds)          │
│                                                            │
│ 4. Fallback: Offer library pick if generation slow         │
│    └── "While we prepare your story, pick from library?"   │
└────────────────────────────────────────────────────────────┘
```

**Pre-warming on dashboard:**

```typescript
// In DashboardPage.tsx
useEffect(() => {
  // When user lands on dashboard, start preparing session content
  if (user && hasFlashcardsDue) {
    prefetch(api.sessions.prepareNextContent, { userId, language });
  }
}, [user]);
```

---

## Open Questions

1. **Foundations track length:** 100 words? 200? Should it vary by language?
2. **Coverage threshold:** 85% vocabulary coverage default, adjustable?
3. **Vacation mode:** Auto-detect inactivity (7+ days) or manual toggle?
4. **Concept SRS:** Should grammar concepts use full FSRS or simpler intervals?
