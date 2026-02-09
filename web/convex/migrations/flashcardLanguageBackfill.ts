import { internalMutation } from "../_generated/server";

/**
 * Backfill: Populate `language` field on existing flashcard rows.
 *
 * Reads each flashcard's linked vocabulary document and copies the language.
 * Safe to re-run (skips cards that already have language set).
 *
 * Run on DEV:
 *   npx convex run migrations/flashcardLanguageBackfill:backfill
 *
 * Run on PROD:
 *   npx convex run migrations/flashcardLanguageBackfill:backfill --prod
 */
export const backfill = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cards = await ctx.db.query("flashcards").collect();
    let updated = 0;
    let skipped = 0;
    let missing = 0;

    for (const card of cards) {
      if (card.language) {
        skipped++;
        continue;
      }

      const vocab = await ctx.db.get(card.vocabularyId);
      if (!vocab) {
        missing++;
        continue;
      }

      await ctx.db.patch(card._id, { language: vocab.language });
      updated++;
    }

    return { updated, skipped, missing, total: cards.length };
  },
});
