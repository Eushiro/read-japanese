/**
 * Migration: Add definition translations to vocabulary
 *
 * This migration adds hardcoded translations to premade vocabulary items.
 * Translations are stored in ./translationData.ts for the 300 premade words.
 *
 * Run this migration after deploying the schema changes:
 *   npx convex run migrations/definitionTranslations:migratePremadeVocabulary
 *
 * For user-added words without premade translations, run:
 *   npx convex run migrations/definitionTranslations:migrateUserVocabularyWithAI
 */

import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, internalMutation } from "../_generated/server";
import { premadeTranslations } from "./translationData";

/**
 * Migrate premade vocabulary - add hardcoded translations from translationData.ts.
 * This is a one-time migration for the 300 premade vocabulary words.
 */
export const migratePremadeVocabulary = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all premade vocabulary items without translations
    const allVocab = await ctx.db
      .query("premadeVocabulary")
      .filter((q) => q.eq(q.field("definitionTranslations"), undefined))
      .collect();

    let migrated = 0;
    let skipped = 0;
    const notFound: string[] = [];

    for (const vocab of allVocab) {
      const translations = premadeTranslations[vocab.word];

      if (translations) {
        await ctx.db.patch(vocab._id, {
          definitionTranslations: translations,
          updatedAt: Date.now(),
        });
        migrated++;
      } else {
        notFound.push(vocab.word);
        skipped++;
      }
    }

    return {
      total: allVocab.length,
      migrated,
      skipped,
      notFound: notFound.slice(0, 20), // Return first 20 missing words for debugging
    };
  },
});

/**
 * Migrate user vocabulary - copy translations from premade if the word matches.
 * For user-added words that don't have premade translations, this will skip them.
 */
export const migrateUserVocabulary = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all user vocabulary items without translations
    const allVocab = await ctx.db
      .query("vocabulary")
      .filter((q) => q.eq(q.field("definitionTranslations"), undefined))
      .collect();

    let migrated = 0;
    let skipped = 0;

    for (const vocab of allVocab) {
      const translations = premadeTranslations[vocab.word];

      if (translations) {
        await ctx.db.patch(vocab._id, {
          definitionTranslations: translations,
          updatedAt: Date.now(),
        });
        migrated++;
      } else {
        skipped++;
      }
    }

    return {
      total: allVocab.length,
      migrated,
      skipped,
    };
  },
});

/**
 * Get migration status - counts of items with/without translations.
 */
export const getMigrationStatus = internalMutation({
  args: {},
  handler: async (ctx) => {
    const vocabWithTranslations = await ctx.db
      .query("vocabulary")
      .filter((q) => q.neq(q.field("definitionTranslations"), undefined))
      .collect();

    const vocabWithoutTranslations = await ctx.db
      .query("vocabulary")
      .filter((q) => q.eq(q.field("definitionTranslations"), undefined))
      .collect();

    const premadeWithTranslations = await ctx.db
      .query("premadeVocabulary")
      .filter((q) => q.neq(q.field("definitionTranslations"), undefined))
      .collect();

    const premadeWithoutTranslations = await ctx.db
      .query("premadeVocabulary")
      .filter((q) => q.eq(q.field("definitionTranslations"), undefined))
      .collect();

    return {
      vocabulary: {
        total: vocabWithTranslations.length + vocabWithoutTranslations.length,
        migrated: vocabWithTranslations.length,
        pending: vocabWithoutTranslations.length,
      },
      premadeVocabulary: {
        total: premadeWithTranslations.length + premadeWithoutTranslations.length,
        migrated: premadeWithTranslations.length,
        pending: premadeWithoutTranslations.length,
      },
    };
  },
});

/**
 * Internal mutation to update a single vocabulary item with translations.
 */
export const updateVocabularyTranslations = internalMutation({
  args: {
    vocabularyId: v.id("vocabulary"),
    definitionTranslations: v.array(
      v.object({
        en: v.string(),
        ja: v.string(),
        fr: v.string(),
        zh: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.vocabularyId, {
      definitionTranslations: args.definitionTranslations,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Get vocabulary items without translations for AI migration.
 */
export const getVocabularyWithoutTranslations = internalMutation({
  args: {
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const vocab = await ctx.db
      .query("vocabulary")
      .filter((q) => q.eq(q.field("definitionTranslations"), undefined))
      .take(args.limit);

    return vocab.map((v) => ({
      _id: v._id,
      word: v.word,
      definitions: v.definitions,
      language: v.language,
    }));
  },
});

// Type for vocabulary items without translations
type VocabItemForMigration = {
  _id: Id<"vocabulary">;
  word: string;
  definitions: string[];
  language: string;
};

// Type for the migration result
type MigrationResult = {
  message: string;
  migrated: number;
  failed: number;
  remaining: number | string;
  errors?: Array<{ word: string; error: string }>;
};

/**
 * Migrate user vocabulary using AI translation.
 * Processes vocabulary items in batches to avoid timeouts.
 * Run multiple times until all items are migrated.
 *
 * Usage: npx convex run migrations/definitionTranslations:migrateUserVocabularyWithAI
 */
export const migrateUserVocabularyWithAI = internalAction({
  args: {
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    message: v.string(),
    migrated: v.number(),
    failed: v.number(),
    remaining: v.union(v.number(), v.string()),
    errors: v.optional(v.array(v.object({ word: v.string(), error: v.string() }))),
  }),
  handler: async (ctx, args): Promise<MigrationResult> => {
    const batchSize = args.batchSize ?? 10;

    // Get vocabulary items without translations
    const vocabItems: VocabItemForMigration[] = await ctx.runMutation(
      internal.migrations.definitionTranslations.getVocabularyWithoutTranslations,
      { limit: batchSize }
    );

    if (vocabItems.length === 0) {
      return {
        message: "No vocabulary items need translation",
        migrated: 0,
        failed: 0,
        remaining: 0,
      };
    }

    let migrated = 0;
    let failed = 0;
    const errors: Array<{ word: string; error: string }> = [];

    for (const vocab of vocabItems) {
      try {
        // Call AI translation
        const translations = await ctx.runAction(internal.ai.translateDefinitions, {
          word: vocab.word,
          definitions: vocab.definitions,
          language: vocab.language as "japanese" | "english" | "french",
        });

        // Update the vocabulary item
        await ctx.runMutation(
          internal.migrations.definitionTranslations.updateVocabularyTranslations,
          {
            vocabularyId: vocab._id,
            definitionTranslations: translations,
          }
        );

        migrated++;
      } catch (error) {
        failed++;
        errors.push({
          word: vocab.word,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Get remaining count
    const remainingItems: VocabItemForMigration[] = await ctx.runMutation(
      internal.migrations.definitionTranslations.getVocabularyWithoutTranslations,
      { limit: 1 }
    );

    return {
      message:
        remainingItems.length > 0
          ? `Migrated ${migrated} items. Run again to continue migration.`
          : "Migration complete!",
      migrated,
      failed,
      remaining: remainingItems.length > 0 ? "more items pending" : 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
});
