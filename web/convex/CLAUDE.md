# Convex CLAUDE.md

This file provides guidance for Claude Code when working on the Convex backend.

## Project Overview

Convex backend for SanLang, handling:
- User data and authentication (via Clerk)
- Vocabulary, flashcards, and learning progress
- AI-powered content generation (TTS, images)
- Study sessions and spaced repetition

## Essential Requirements

**See `docs/DEVELOPMENT.md` for detailed patterns.** Key points for Convex:

### 1. Use Centralized Generation Functions

All AI generation must go through `ai.ts` or `lib/generation.ts`:

```typescript
// TTS (outputs MP3) - word-centric storage
await ctx.runAction(internal.ai.generateTTSAudioAction, {
  text, language, word, audioType: "word" | "sentence", sentenceId
});

// Images (outputs WebP) - word-centric storage
await ctx.runAction(internal.ai.generateFlashcardImageAction, {
  word, sentence, language, imageId
});

// With content reuse + paywall
await ctx.runAction(internal.lib.generation.generateSentenceForWord, { userId, vocabularyId, word, ... });
```

### 2. Use Storage Abstraction (Word-Centric)

Media is organized by word for easy browsing and management:
```
flashcards/{language}/{word}/
├── word.mp3              # Word pronunciation
├── sentence-{id}.mp3     # Sentence audio
└── image-{id}.webp       # Images
```

```typescript
import { uploadWordAudio, uploadSentenceAudio, uploadWordImage } from "./lib/storage";

// Word pronunciation audio
const wordAudioUrl = await uploadWordAudio(audioBytes, word, language, "audio/mpeg");

// Sentence audio (requires word context and sentence ID)
const sentenceAudioUrl = await uploadSentenceAudio(audioBytes, word, language, sentenceId, "audio/mpeg");

// Image (requires word context and image ID)
const imageUrl = await uploadWordImage(imageBytes, word, language, imageId, "image/webp");
```

### 3. Use Shared Content Language Configuration

```typescript
import { LANGUAGES, SUPPORTED_LANGUAGE_CODES } from "@/lib/contentLanguages";
import type { ContentLanguage } from "@/lib/contentLanguages";
```

### 4. Node.js Runtime

Files using Node.js APIs need the directive:

```typescript
"use node";
import sharp from "sharp";
```

---

## Directory Structure

```
convex/
├── ai.ts                 # AI generation functions (TTS, images)
├── lib/
│   ├── storage.ts        # File storage abstraction (R2)
│   ├── imageCompression.ts  # Sharp-based image compression
│   ├── generation.ts     # Centralized generation with content reuse
│   └── contentReuse.ts   # Content library for reusing generated assets
├── flashcards.ts         # Flashcard CRUD and study logic
├── learnerModel.ts       # Spaced repetition and skill tracking
└── schema.ts             # Database schema definitions
```

---

## DO NOT

- Generate audio/images without using centralized functions
- Upload files directly to R2 without storage abstraction
- Store audio as WAV or images as PNG
- Import Node.js modules without `"use node"` directive
- Hardcode content language lists (use `@/lib/contentLanguages`)
