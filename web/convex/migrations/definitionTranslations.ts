/**
 * Migration: Add definition translations to vocabulary
 *
 * This migration adds hardcoded translations to premade vocabulary items.
 * Translations are stored in ./translationData.ts for the 300 premade words.
 *
 * Run this migration after deploying the schema changes:
 *   npx convex run migrations/definitionTranslations:migratePremadeVocabulary
 */

import { internalMutation } from "../_generated/server";
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
