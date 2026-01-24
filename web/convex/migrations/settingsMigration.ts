import { internalMutation } from "../_generated/server";

/**
 * Migration: Consolidate settings tables into userPreferences
 *
 * This migration merges three tables into one:
 * - userSettings → userPreferences.display, .audio, .srs (partial), .notifications
 * - fsrsSettings → userPreferences.srs (merged)
 * - contentPreferences → userPreferences.content
 *
 * === MIGRATION STEPS ===
 *
 * 1. Deploy schema changes to dev:
 *    cd web && npx convex dev --once
 *
 * 2. Run migration on DEV:
 *    npx convex run migrations/settingsMigration:migrateAllSettings
 *
 * 3. Verify in Convex dashboard:
 *    - Check userPreferences table has data
 *    - Test the app works correctly
 *
 * 4. Deploy to PROD:
 *    cd web && npx convex deploy --cmd-url-env-var-name VITE_CONVEX_URL --yes
 *
 * 5. Run migration on PROD:
 *    npx convex run migrations/settingsMigration:migrateAllSettings --prod
 *
 * 6. Verify PROD works correctly
 *
 * 7. Clean up old data (after verification):
 *    npx convex run migrations/settingsMigration:cleanupOldTables --prod
 *
 * 8. Remove deprecated table definitions from schema.ts:
 *    - userSettings
 *    - fsrsSettings
 *    - contentPreferences
 *    - gradingProfiles (uses constants now)
 *
 * 9. Delete this migration file
 */

// Migrate all user settings from old tables to new userPreferences table
export const migrateAllSettings = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let migrated = 0;
    let skipped = 0;

    // Get all userSettings (source of truth for userId list)
    const allUserSettings = await ctx.db.query("userSettings").collect();

    for (const settings of allUserSettings) {
      // Check if already migrated
      const existing = await ctx.db
        .query("userPreferences")
        .withIndex("by_user", (q) => q.eq("userId", settings.userId))
        .first();

      if (existing) {
        skipped++;
        continue;
      }

      // Fetch related fsrsSettings
      const fsrs = await ctx.db
        .query("fsrsSettings")
        .withIndex("by_user", (q) => q.eq("userId", settings.userId))
        .first();

      // Fetch related contentPreferences
      const content = await ctx.db
        .query("contentPreferences")
        .withIndex("by_user", (q) => q.eq("userId", settings.userId))
        .first();

      // Create merged userPreferences
      await ctx.db.insert("userPreferences", {
        userId: settings.userId,
        display: {
          showFurigana: settings.showFurigana,
          theme: settings.theme,
          fontSize: settings.fontSize,
        },
        audio: {
          autoplay: settings.autoplayAudio,
          highlightMode: settings.audioHighlightMode,
          speed: settings.audioSpeed,
        },
        srs: {
          dailyReviewGoal: settings.dailyReviewGoal,
          newCardsPerDay: fsrs?.dailyNewCards ?? settings.newCardsPerDay,
          sentenceRefreshDays: settings.sentenceRefreshDays,
          desiredRetention: fsrs?.desiredRetention,
          maximumInterval: fsrs?.maximumInterval,
          customWeights: fsrs?.customWeights,
          preset: fsrs?.preset,
        },
        content: content
          ? {
              interests: content.interests,
              tonePreference: content.tonePreference,
              ageAppropriate: content.ageAppropriate,
              culturalFocus: content.culturalFocus,
              learningGoal: content.learningGoal,
              avoidTopics: content.avoidTopics,
            }
          : undefined,
        notifications: {
          reviewReminderEnabled: settings.reviewReminderEnabled,
          reviewReminderTime: settings.reviewReminderTime,
        },
        updatedAt: now,
      });

      migrated++;
    }

    return { migrated, skipped, total: allUserSettings.length };
  },
});

// Cleanup old tables after migration is verified
// WARNING: Only run this after verifying migration was successful!
export const cleanupOldTables = internalMutation({
  args: {},
  handler: async (ctx) => {
    let deleted = { userSettings: 0, fsrsSettings: 0, contentPreferences: 0 };

    // Delete all userSettings
    const allUserSettings = await ctx.db.query("userSettings").collect();
    for (const doc of allUserSettings) {
      await ctx.db.delete(doc._id);
      deleted.userSettings++;
    }

    // Delete all fsrsSettings
    const allFsrsSettings = await ctx.db.query("fsrsSettings").collect();
    for (const doc of allFsrsSettings) {
      await ctx.db.delete(doc._id);
      deleted.fsrsSettings++;
    }

    // Delete all contentPreferences
    const allContentPrefs = await ctx.db.query("contentPreferences").collect();
    for (const doc of allContentPrefs) {
      await ctx.db.delete(doc._id);
      deleted.contentPreferences++;
    }

    return deleted;
  },
});
