# Adaptive Practice and Diagnostic Quality Design Doc

## Summary

This document defines quality and adaptivity improvements for the adaptive practice and diagnostic flows. It proposes stricter validation and repair, skill-aware difficulty targeting, candidate scoring for question sets, and model strategy changes to improve question quality without feature flagging.

## Goals

- Increase question quality and correctness.
- Improve adaptivity to learner skill and recent performance.
- Reduce invalid or low-quality question sets.
- Make model selection measurable and optimizable.

## Non-Goals

- Redesign of the entire learner model.
- Major UI/UX changes beyond question ordering and display of metadata.
- Long-term A/B testing framework (basic monitoring only).

## Current System Overview

- Adaptive practice uses `getNextPractice` to choose diagnostic vs content-based sessions and generate questions.
- Diagnostic generation requests 4 questions but the UI expects 6-10 and triggers incremental generation when the pool is low.
- Question validation is minimal and only checks MCQ options length.
- Question ordering is frontend-only and does not incorporate per-skill ability.
- `generateAndParseRace` runs 4 parallel calls to the same model and returns the first valid result.
- `modelUsed` is returned to the client but not persisted for analytics.

## Problems Observed

- Diagnostic count and skill coverage constraints are internally inconsistent.
- Quality constraints in prompts are not enforced by validation.
- Difficulty targeting is coarse and not skill-aware.
- Audio caps can remove questions for weak audio skills with no replacement.
- Model race strategy optimizes latency but not quality, and increases cost.
- Insufficient instrumentation to understand model and prompt performance.

## Quality and Adaptivity Requirements

### Diagnostic

- Produce 6 to 8 questions in the initial diagnostic set.
- Cover all 6 skills at least once across the set.
- Difficulty distribution must include below/at/above estimated level.

### Adaptive Practice (Content-Based)

- At least 4 question types per set.
- Minimum 1 question each for top 2 weak skills.
- If listening or speaking is a weak skill, ensure at least 1 audio/mic question unless explicitly capped by user settings.

### Validation

- MCQ types must have exactly 4 unique options.
- `correctAnswer` must match one option exactly.
- `fill_blank` must include "\_\_\_" in the question.
- `translation` and `shadow_record` must have `questionTranslation` unless advanced tier.
- `mcq_comprehension` must include `passageText` in diagnostic and omit `passageText` in content-based.
- `difficulty` is required and must be one of easy/medium/hard.
- Points must be positive.

## Proposed Architecture Changes

### 1) Question Set Validation + Repair

Add a validator that enforces the rules above. If validation fails:

- Attempt a repair prompt for invalid items.
- If repair still fails, regenerate a full set.

Repair prompt strategy:

- Provide the broken question, list specific violations, request corrected JSON only.

### 2) Candidate Scoring for Question Sets

Generate 2 or 3 candidate question sets in parallel. Score each with a fast rubric evaluator, then select the best.

Scoring rubric (0-100):

- Correctness and answer alignment (40)
- Skill coverage and type variety (20)
- Difficulty fit to ability (20)
- Clarity and naturalness (20)

Select the highest score. If all scores < 70, regenerate once.

### 3) Skill-Aware Difficulty Targeting

Use `abilityBySkill` and recent performance to set target difficulty per skill. Map difficulty tags to numeric values:

- easy = -1
- medium = 0
- hard = +1

Add `difficultyEstimate` to each question based on abilityBySkill + target difficulty. Use this for updating the learner model rather than only `-1/0/1` from labels.

### 4) Audio Caps as Min/Max

Replace simple max caps with min/max rules:

- If listening/speaking are weak skills, require at least one audio/mic question.
- Only cap above a max if the user is overwhelmed or if audio generation fails.

### 5) Model Strategy

Replace `generateAndParseRace` for question generation with best-of-N + scorer.

Recommended default:

- Generate 2 candidates with GPT-OSS 120B.
- Score each with Gemini Flash (cheap, fast).
- Pick best.

Fallback chain:

- If both fail validation, attempt one candidate with Claude Sonnet.

### 6) Instrumentation

Persist the following for each practice session or result:

- `modelUsed` and `scorerModelUsed`
- validation failure counts
- quality score
- repair attempts
- latency and token usage

## Data Model Changes

Update schema for `practiceSessions` and/or `practiceResults` to store:

- `modelUsed`
- `scorerModelUsed`
- `qualityScore`
- `validationFailures`
- `repairAttempts`
- `generationLatencyMs`

## Rollout Plan

- No feature flagging per request.
- Deploy directly with enhanced logging.
- Monitor invalid rates, average quality score, and user accuracy for 1-2 weeks.
- Iterate on prompts and thresholds as needed.

## Implementation Plan

1. Add validator and repair utilities in `web/convex/adaptivePractice.ts`.
2. Add question-set scoring action using `Gemini Flash` in `web/convex/ai/models.ts` or a new helper.
3. Replace `generateAndParseRace` usage with best-of-N + scorer.
4. Align diagnostic question count to 6-8 and enforce skill coverage.
5. Add skill-aware difficulty targeting using `abilityBySkill`.
6. Update `practiceSessions` or `practiceResults` schema and write instrumentation.
7. Update frontend ordering to respect skill priorities and audio minimums.

## Risks and Mitigations

- Higher latency due to extra calls: mitigate with parallel generation and fast scoring model.
- Scorer bias: validate scoring rubric with small spot checks.
- Schema changes require migrations: do minimal additive changes to avoid breakage.

## Open Questions

- Do we want to auto-generate a small offline eval set for each language to track regression?
- What is the desired maximum cost per practice session?
