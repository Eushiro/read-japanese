import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { ContentLanguage } from "../schema";

/**
 * Content Reuse Helpers
 *
 * These helpers enable content sharing across users by:
 * 1. Looking up existing content from the content library
 * 2. Tracking what each user has seen to avoid repetition
 * 3. Finding unseen content for variety
 */

// ============================================
// SENTENCE LOOKUP
// ============================================

/**
 * Find existing sentences for a word from the content library
 */
export async function findSentencesForWord(
  ctx: QueryCtx | MutationCtx,
  word: string,
  language: ContentLanguage
): Promise<Doc<"sentences">[]> {
  return await ctx.db
    .query("sentences")
    .withIndex("by_word_language", (q) => q.eq("word", word).eq("language", language))
    .collect();
}

/**
 * Find a sentence the user hasn't seen yet
 * Returns null if all available sentences have been seen
 */
export async function findUnseenSentence(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  vocabularyId: Id<"vocabulary">,
  word: string,
  language: ContentLanguage
): Promise<Doc<"sentences"> | null> {
  // Get all available sentences for this word
  const sentences = await findSentencesForWord(ctx, word, language);

  if (sentences.length === 0) {
    return null;
  }

  // Get user's content history for this vocabulary item
  const history = await ctx.db
    .query("userContentHistory")
    .withIndex("by_user_vocabulary", (q) => q.eq("userId", userId).eq("vocabularyId", vocabularyId))
    .first();

  const seenIds = history?.seenSentenceIds ?? [];
  const seenIdSet = new Set(seenIds.map((id) => id.toString()));

  // Find sentences the user hasn't seen
  const unseenSentences = sentences.filter((s) => !seenIdSet.has(s._id.toString()));

  if (unseenSentences.length > 0) {
    // Return a random unseen sentence for variety
    return unseenSentences[Math.floor(Math.random() * unseenSentences.length)];
  }

  // All sentences seen - reset and return a random one
  // (Better to repeat than to always generate new content)
  return sentences[Math.floor(Math.random() * sentences.length)];
}

/**
 * Find a sentence matching a specific difficulty level
 */
export async function findSentenceByDifficulty(
  ctx: QueryCtx | MutationCtx,
  word: string,
  language: ContentLanguage,
  difficulty: number
): Promise<Doc<"sentences"> | null> {
  const sentences = await findSentencesForWord(ctx, word, language);
  const matching = sentences.filter((s) => s.difficulty === difficulty);
  if (matching.length > 0) {
    return matching[Math.floor(Math.random() * matching.length)];
  }
  // Fall back to closest difficulty
  if (sentences.length > 0) {
    const sorted = sentences.sort(
      (a, b) => Math.abs(a.difficulty - difficulty) - Math.abs(b.difficulty - difficulty)
    );
    return sorted[0];
  }
  return null;
}

// ============================================
// IMAGE LOOKUP
// ============================================

/**
 * Find existing images for a word from the content library
 */
export async function findImagesForWord(
  ctx: QueryCtx | MutationCtx,
  word: string,
  language: ContentLanguage
): Promise<Doc<"images">[]> {
  return await ctx.db
    .query("images")
    .withIndex("by_word_language", (q) => q.eq("word", word).eq("language", language))
    .collect();
}

/**
 * Find an image the user hasn't seen yet
 */
export async function findUnseenImage(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  vocabularyId: Id<"vocabulary">,
  word: string,
  language: ContentLanguage
): Promise<Doc<"images"> | null> {
  const images = await findImagesForWord(ctx, word, language);

  if (images.length === 0) {
    return null;
  }

  const history = await ctx.db
    .query("userContentHistory")
    .withIndex("by_user_vocabulary", (q) => q.eq("userId", userId).eq("vocabularyId", vocabularyId))
    .first();

  const seenIds = history?.seenImageIds ?? [];
  const seenIdSet = new Set(seenIds.map((id) => id.toString()));

  const unseenImages = images.filter((img) => !seenIdSet.has(img._id.toString()));

  if (unseenImages.length > 0) {
    return unseenImages[Math.floor(Math.random() * unseenImages.length)];
  }

  // All images seen - return a random one
  return images[Math.floor(Math.random() * images.length)];
}

// ============================================
// WORD AUDIO LOOKUP
// ============================================

/**
 * Find word audio from the content library
 */
export async function findWordAudio(
  ctx: QueryCtx | MutationCtx,
  word: string,
  language: ContentLanguage
): Promise<Doc<"wordAudio"> | null> {
  return await ctx.db
    .query("wordAudio")
    .withIndex("by_word_language", (q) => q.eq("word", word).eq("language", language))
    .first();
}

// ============================================
// CONTENT HISTORY TRACKING
// ============================================

/**
 * Mark a sentence as seen by a user
 */
export async function markSentenceSeen(
  ctx: MutationCtx,
  userId: string,
  vocabularyId: Id<"vocabulary">,
  sentenceId: Id<"sentences">
): Promise<void> {
  const now = Date.now();
  const existing = await ctx.db
    .query("userContentHistory")
    .withIndex("by_user_vocabulary", (q) => q.eq("userId", userId).eq("vocabularyId", vocabularyId))
    .first();

  if (existing) {
    // Don't add duplicates
    if (!existing.seenSentenceIds.includes(sentenceId)) {
      await ctx.db.patch(existing._id, {
        seenSentenceIds: [...existing.seenSentenceIds, sentenceId],
        lastShownAt: now,
      });
    }
  } else {
    await ctx.db.insert("userContentHistory", {
      userId,
      vocabularyId,
      seenSentenceIds: [sentenceId],
      seenImageIds: [],
      lastShownAt: now,
      createdAt: now,
    });
  }
}

/**
 * Mark an image as seen by a user
 */
export async function markImageSeen(
  ctx: MutationCtx,
  userId: string,
  vocabularyId: Id<"vocabulary">,
  imageId: Id<"images">
): Promise<void> {
  const now = Date.now();
  const existing = await ctx.db
    .query("userContentHistory")
    .withIndex("by_user_vocabulary", (q) => q.eq("userId", userId).eq("vocabularyId", vocabularyId))
    .first();

  if (existing) {
    if (!existing.seenImageIds.includes(imageId)) {
      await ctx.db.patch(existing._id, {
        seenImageIds: [...existing.seenImageIds, imageId],
        lastShownAt: now,
      });
    }
  } else {
    await ctx.db.insert("userContentHistory", {
      userId,
      vocabularyId,
      seenSentenceIds: [],
      seenImageIds: [imageId],
      lastShownAt: now,
      createdAt: now,
    });
  }
}

/**
 * Get content history for a user's vocabulary item
 */
export async function getContentHistory(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  vocabularyId: Id<"vocabulary">
): Promise<Doc<"userContentHistory"> | null> {
  return await ctx.db
    .query("userContentHistory")
    .withIndex("by_user_vocabulary", (q) => q.eq("userId", userId).eq("vocabularyId", vocabularyId))
    .first();
}

// ============================================
// CONTENT STORAGE
// ============================================

/**
 * Store a new sentence in the content library
 */
export async function storeSentence(
  ctx: MutationCtx,
  params: {
    word: string;
    language: ContentLanguage;
    difficulty: number;
    sentence: string;
    translations: {
      en?: string;
      ja?: string;
      fr?: string;
      es?: string;
      zh?: string;
    };
    audioUrl?: string;
    model: string;
    createdBy?: string;
  }
): Promise<Id<"sentences">> {
  return await ctx.db.insert("sentences", {
    word: params.word,
    language: params.language,
    difficulty: params.difficulty,
    sentence: params.sentence,
    translations: params.translations,
    audioUrl: params.audioUrl,
    model: params.model,
    createdBy: params.createdBy,
    createdAt: Date.now(),
  });
}

/**
 * Store a new image in the content library
 */
export async function storeImage(
  ctx: MutationCtx,
  params: {
    word: string;
    language: ContentLanguage;
    imageUrl: string;
    style?: string;
    model: string;
    createdBy?: string;
  }
): Promise<Id<"images">> {
  return await ctx.db.insert("images", {
    word: params.word,
    language: params.language,
    imageUrl: params.imageUrl,
    style: params.style,
    model: params.model,
    createdBy: params.createdBy,
    createdAt: Date.now(),
  });
}

/**
 * Store word audio in the content library
 */
export async function storeWordAudio(
  ctx: MutationCtx,
  params: {
    word: string;
    language: ContentLanguage;
    audioUrl: string;
    model: string;
    createdBy?: string;
  }
): Promise<Id<"wordAudio">> {
  return await ctx.db.insert("wordAudio", {
    word: params.word,
    language: params.language,
    audioUrl: params.audioUrl,
    model: params.model,
    createdBy: params.createdBy,
    createdAt: Date.now(),
  });
}
