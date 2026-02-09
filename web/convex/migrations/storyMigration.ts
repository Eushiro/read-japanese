/**
 * Migration: Populate stories table from R2 manifest
 *
 * This migration reads the R2 manifest and creates Convex story records.
 * It also generates translations for titles and summaries.
 *
 * Usage:
 *   npx convex run migrations/storyMigration:migrateFromManifest
 *   npx convex run migrations/storyMigration:generateTranslations
 */

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction, internalMutation, mutation, query } from "../_generated/server";
import type { ContentLanguage } from "../schema";

const R2_PUBLIC_URL = process.env.VITE_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL || "";

interface ManifestStory {
  id: string;
  language: string;
  title: string;
  titleJapanese?: string;
  level: string;
  wordCount: number;
  genre: string;
  summary: string;
  summaryJapanese?: string;
  coverImageURL?: string;
  audioURL?: string;
  chapterCount: number;
  isPremium: boolean;
}

interface Manifest {
  stories: ManifestStory[];
  generatedAt: string;
}

/**
 * Fetch the manifest from R2
 */
async function fetchManifest(): Promise<Manifest> {
  const manifestUrl = `${R2_PUBLIC_URL}/stories/manifest.json`;
  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch manifest: ${response.status}`);
  }
  return response.json();
}

/**
 * Insert a single story into the database
 */
export const insertStory = internalMutation({
  args: {
    storyId: v.string(),
    language: v.union(v.literal("japanese"), v.literal("english"), v.literal("french")),
    title: v.string(),
    titleTranslations: v.object({
      en: v.string(),
      ja: v.string(),
      fr: v.string(),
      zh: v.string(),
    }),
    level: v.string(),
    wordCount: v.number(),
    genre: v.string(),
    chapterCount: v.number(),
    isPremium: v.boolean(),
    summary: v.string(),
    summaryTranslations: v.object({
      en: v.string(),
      ja: v.string(),
      fr: v.string(),
      zh: v.string(),
    }),
    storyUrl: v.string(),
    coverUrl: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if story already exists
    const existing = await ctx.db
      .query("stories")
      .withIndex("by_story_id", (q) => q.eq("storyId", args.storyId))
      .first();

    if (existing) {
      // Update existing story
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: Date.now(),
      });
      return { action: "updated", storyId: args.storyId };
    }

    // Insert new story
    await ctx.db.insert("stories", {
      ...args,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { action: "inserted", storyId: args.storyId };
  },
});

// Hardcoded translations for all stories (French and Chinese added)
// Moved here so migrateFromManifest can use it
const STORY_TRANSLATIONS: Record<
  string,
  {
    title: { en: string; ja: string; fr: string; zh: string };
    summary: { en: string; ja: string; fr: string; zh: string };
  }
> = {
  n5_school_day_001: {
    title: {
      en: "My Day at School",
      ja: "学校の一日",
      fr: "Ma journée à l'école",
      zh: "我的校园一天",
    },
    summary: {
      en: "A student describes their typical day at school, from morning classes to going home.",
      ja: "学生が朝の授業から帰るまでの学校の一日を話します。",
      fr: "Un étudiant décrit sa journée typique à l'école, des cours du matin jusqu'au retour à la maison.",
      zh: "一名学生描述了自己在学校的一天，从早课到放学回家。",
    },
  },
  n5_first_cafe_001: {
    title: {
      en: "My First Cafe",
      ja: "はじめてのカフェ",
      fr: "Mon premier café",
      zh: "我的第一次咖啡馆之旅",
    },
    summary: {
      en: "A student visits a cafe for the first time with a friend and enjoys trying new drinks and cake.",
      ja: "学生が友達と初めてカフェに行って、新しい飲み物とケーキを楽しみます。",
      fr: "Un étudiant visite un café pour la première fois avec un ami et découvre de nouvelles boissons et gâteaux.",
      zh: "一名学生第一次和朋友去咖啡馆，品尝新饮品和蛋糕。",
    },
  },
  n5_weekend_trip_001: {
    title: { en: "A Fun Weekend", ja: "楽しい週末", fr: "Un week-end amusant", zh: "愉快的周末" },
    summary: {
      en: "A student plans and enjoys a weekend mountain trip with friends, experiencing beautiful nature and delicious food.",
      ja: "学生が友達と週末の山旅行を計画し、美しい自然とおいしい食べ物を楽しみました。",
      fr: "Un étudiant planifie et profite d'une excursion en montagne avec des amis, découvrant la belle nature et la bonne cuisine.",
      zh: "一名学生和朋友计划并享受了一次周末登山之旅，体验美丽的自然风光和美食。",
    },
  },
  n4_lost_wallet_001: {
    title: {
      en: "The Lost Wallet",
      ja: "落とした財布",
      fr: "Le portefeuille perdu",
      zh: "丢失的钱包",
    },
    summary: {
      en: "A person loses their wallet and experiences the kindness of strangers in Japan.",
      ja: "財布をなくして、日本の人々の親切さを経験する話です。",
      fr: "Une personne perd son portefeuille et découvre la gentillesse des inconnus au Japon.",
      zh: "一个人丢失了钱包，体验了日本陌生人的善意。",
    },
  },
  magic_cat_001: {
    title: {
      en: "The Cat of the Rain",
      ja: "雨の日の猫",
      fr: "Le chat de la pluie",
      zh: "雨天的猫",
    },
    summary: {
      en: "A young man finds a mysterious cat that can stop the rain and learns about its magical past.",
      ja: "雨を止めることができる不思議な猫を見つけた青年が、その猫の魔法の過去を知る物語です。",
      fr: "Un jeune homme trouve un chat mystérieux capable d'arrêter la pluie et découvre son passé magique.",
      zh: "一个年轻人发现了一只能够停止雨水的神奇猫咪，并了解了它神奇的过去。",
    },
  },
  n2_digital_detox_001: {
    title: {
      en: "Modern Society and Solitude",
      ja: "現代社会と孤独",
      fr: "La société moderne et la solitude",
      zh: "现代社会与孤独",
    },
    summary: {
      en: "A reflection on the importance of disconnecting from technology to rediscover oneself.",
      ja: "テクノロジーから離れ、自分自身を見つめ直す重要性についての考察です。",
      fr: "Une réflexion sur l'importance de se déconnecter de la technologie pour se retrouver soi-même.",
      zh: "关于远离科技、重新发现自我的重要性的思考。",
    },
  },
  n2_career_change_001: {
    title: { en: "A New Path", ja: "新しい道", fr: "Un nouveau chemin", zh: "新的道路" },
    summary: {
      en: "A salaryman questions his life choices and finds the courage to pursue his dream of becoming a ceramicist.",
      ja: "サラリーマンが人生の選択を問い直し、陶芸家になる夢を追う勇気を見つける話です。",
      fr: "Un employé de bureau remet en question ses choix de vie et trouve le courage de poursuivre son rêve de devenir céramiste.",
      zh: "一名上班族重新审视自己的人生选择，找到勇气追求成为陶艺家的梦想。",
    },
  },
  n1_seasons_reflection_001: {
    title: {
      en: "The Passage of Seasons",
      ja: "季節の移ろい",
      fr: "Le passage des saisons",
      zh: "季节的更迭",
    },
    summary: {
      en: "A contemplative piece about the beauty and transience of seasons, reflecting on life's changes through the lens of nature.",
      ja: "季節の美しさと儚さについての瞑想的な作品。自然を通して人生の変化を見つめる。",
      fr: "Une œuvre contemplative sur la beauté et l'éphémère des saisons, réfléchissant aux changements de la vie à travers le prisme de la nature.",
      zh: "一篇关于季节之美与短暂的沉思之作，通过自然的视角反思人生的变化。",
    },
  },
  n3_cooking_lesson_001: {
    title: { en: "Learning to Cook", ja: "料理を習う", fr: "Apprendre à cuisiner", zh: "学习烹饪" },
    summary: {
      en: "A young person learns to cook from their grandmother and discovers the joy of making food for others.",
      ja: "祖母から料理を習って、人に食べてもらう喜びを見つける話です。",
      fr: "Un jeune apprend à cuisiner avec sa grand-mère et découvre la joie de préparer des repas pour les autres.",
      zh: "一个年轻人跟祖母学习烹饪，发现了为他人做饭的快乐。",
    },
  },
  n3_library_discovery_001: {
    title: {
      en: "A Discovery at the Library",
      ja: "図書館での発見",
      fr: "Une découverte à la bibliothèque",
      zh: "图书馆里的发现",
    },
    summary: {
      en: "A busy office worker escapes to the library and accidentally discovers calligraphy, which transforms their perspective on life and the value of quiet, focused time.",
      ja: "忙しい会社員が図書館で偶然に書道と出会い、静かで集中できる時間の価値に気づいて、日常生活が変わっていく話です。",
      fr: "Un employé de bureau débordé se réfugie à la bibliothèque et découvre par hasard la calligraphie, ce qui transforme sa vision de la vie et la valeur du temps calme et concentré.",
      zh: "一名忙碌的上班族逃到图书馆，意外发现了书法，这改变了他对生活的看法以及对安静专注时光的珍视。",
    },
  },
  n4_shinkansen_001: {
    title: {
      en: "First Shinkansen",
      ja: "初めての新幹線",
      fr: "Mon premier Shinkansen",
      zh: "第一次乘坐新干线",
    },
    summary: {
      en: "A person rides the bullet train for the first time on a business trip, experiences the modern station, the fast journey, beautiful scenery, and arrives with new appreciation for Japanese technology.",
      ja: "出張で初めて新幹線に乗って、駅の様子、速い旅、美しい景色を経験し、日本の技術に感動した話です。",
      fr: "Une personne prend le train à grande vitesse pour la première fois lors d'un voyage d'affaires, découvre la gare moderne, le voyage rapide, les beaux paysages, et arrive avec une nouvelle appréciation de la technologie japonaise.",
      zh: "一个人在出差时第一次乘坐新干线，体验了现代化的车站、快速的旅程、美丽的风景，并对日本技术产生了新的敬意。",
    },
  },
  n1_ephemeral_snow_001: {
    title: {
      en: "Fleeting Reminiscence",
      ja: "微かな追憶",
      fr: "Réminiscence éphémère",
      zh: "短暂的追忆",
    },
    summary: {
      en: "A profound meditation on the nature of memory and the passing of time through the lens of falling snow, as the narrator reflects on a lost love and comes to terms with the beauty of impermanence.",
      ja: "降り積もる雪を通じ、記憶の本質と時の流れを深く思索する文学的な物語。失われた恋の追憶と、無常の美への理解を描く。",
      fr: "Une méditation profonde sur la nature de la mémoire et le passage du temps à travers la neige qui tombe, alors que le narrateur réfléchit à un amour perdu et accepte la beauté de l'impermanence.",
      zh: "通过飘落的雪花，对记忆本质和时光流逝进行深刻的沉思。叙述者回忆逝去的爱情，并接受无常之美。",
    },
  },
};

/**
 * Migrate all stories from R2 manifest to Convex
 */
export const migrateFromManifest = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("Fetching manifest from R2...");
    const manifest = await fetchManifest();
    console.log(`Found ${manifest.stories.length} stories in manifest`);

    const results = {
      inserted: 0,
      updated: 0,
      errors: 0,
    };

    for (const story of manifest.stories) {
      try {
        // Build story URL
        const storyUrl = `${R2_PUBLIC_URL}/stories/${story.language}/${story.id}/story.json`;

        // Get translations from hardcoded data
        const translations = STORY_TRANSLATIONS[story.id];
        if (!translations) {
          console.error(`  No translations found for ${story.id}, skipping`);
          results.errors++;
          continue;
        }

        const result = await ctx.runMutation(internal.migrations.storyMigration.insertStory, {
          storyId: story.id,
          language: story.language as ContentLanguage,
          // For Japanese stories, use Japanese as the primary title
          title: story.language === "japanese" ? translations.title.ja : translations.title.en,
          titleTranslations: translations.title,
          level: story.level,
          wordCount: story.wordCount,
          genre: story.genre,
          chapterCount: story.chapterCount,
          isPremium: story.isPremium,
          // For Japanese stories, use Japanese as the primary summary
          summary:
            story.language === "japanese" ? translations.summary.ja : translations.summary.en,
          summaryTranslations: translations.summary,
          storyUrl,
          // Convert null to undefined for optional fields
          coverUrl: story.coverImageURL ?? undefined,
          audioUrl: story.audioURL ?? undefined,
        });

        if (result.action === "inserted") {
          results.inserted++;
        } else {
          results.updated++;
        }
        console.log(`  ${result.action}: ${story.id}`);
      } catch (error) {
        console.error(`  Error processing ${story.id}:`, error);
        results.errors++;
      }
    }

    console.log("\nMigration complete:");
    console.log(`  Inserted: ${results.inserted}`);
    console.log(`  Updated: ${results.updated}`);
    console.log(`  Errors: ${results.errors}`);

    return results;
  },
});

/**
 * List all stories in the database
 */
export const listStories = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("stories").collect();
  },
});

/**
 * Get stories missing translations
 */
export const getStoriesMissingTranslations = query({
  args: {},
  handler: async (ctx) => {
    const stories = await ctx.db.query("stories").collect();
    return stories.filter((s) => !s.titleTranslations || !s.summaryTranslations);
  },
});

/**
 * Update translations for a story
 */
export const updateTranslations = mutation({
  args: {
    storyId: v.string(),
    titleTranslations: v.object({
      en: v.string(),
      ja: v.string(),
      fr: v.string(),
      zh: v.string(),
    }),
    summaryTranslations: v.object({
      en: v.string(),
      ja: v.string(),
      fr: v.string(),
      zh: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const story = await ctx.db
      .query("stories")
      .withIndex("by_story_id", (q) => q.eq("storyId", args.storyId))
      .first();

    if (!story) {
      throw new Error(`Story not found: ${args.storyId}`);
    }

    await ctx.db.patch(story._id, {
      titleTranslations: args.titleTranslations,
      summaryTranslations: args.summaryTranslations,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Apply all translations from the hardcoded data
 */
export const applyAllTranslations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const stories = await ctx.db.query("stories").collect();
    let updated = 0;

    for (const story of stories) {
      const translations = STORY_TRANSLATIONS[story.storyId];
      if (translations) {
        await ctx.db.patch(story._id, {
          titleTranslations: translations.title,
          summaryTranslations: translations.summary,
          updatedAt: Date.now(),
        });
        updated++;
      }
    }

    return { updated, total: stories.length };
  },
});

/**
 * Run the translation update
 */
export const runTranslationUpdate = internalAction({
  args: {},
  handler: async (ctx): Promise<{ updated: number; total: number }> => {
    const result: { updated: number; total: number } = await ctx.runMutation(
      internal.migrations.storyMigration.applyAllTranslations,
      {}
    );
    console.log(`Updated ${result.updated} of ${result.total} stories with full translations`);
    return result;
  },
});

// Known story IDs to rebuild manifest from
const STORY_IDS = [
  "n5_school_day_001",
  "n5_first_cafe_001",
  "n5_weekend_trip_001",
  "n4_lost_wallet_001",
  "n4_shinkansen_001",
  "n3_cooking_lesson_001",
  "n3_library_discovery_001",
  "n2_digital_detox_001",
  "n2_career_change_001",
  "n1_seasons_reflection_001",
  "n1_ephemeral_snow_001",
  "magic_cat_001",
];

interface StoryJson {
  id: string;
  metadata: {
    title: string;
    titleJapanese?: string;
    level: string;
    wordCount: number;
    genre: string;
    summary: string;
    summaryJapanese?: string;
    coverImageURL?: string;
    audioURL?: string;
  };
  chapters: unknown[];
}

/**
 * Rebuild manifest.json from R2 stories and upload it
 *
 * Usage:
 *   npx convex run migrations/storyMigration:rebuildManifest --prod
 */
export const rebuildManifest = internalAction({
  args: {},
  handler: async () => {
    console.log("Rebuilding manifest from R2 stories...");

    const stories: ManifestStory[] = [];

    for (const id of STORY_IDS) {
      const url = `${R2_PUBLIC_URL}/stories/japanese/${id}/story.json`;
      console.log(`  Fetching ${id}...`);

      try {
        const response = await fetch(url);
        if (!response.ok) {
          console.log(`    Skipping ${id}: ${response.status}`);
          continue;
        }

        const data: StoryJson = await response.json();
        stories.push({
          id: data.id,
          language: "japanese",
          title: data.metadata.title,
          titleJapanese: data.metadata.titleJapanese,
          level: data.metadata.level,
          wordCount: data.metadata.wordCount,
          genre: data.metadata.genre,
          summary: data.metadata.summary,
          summaryJapanese: data.metadata.summaryJapanese,
          coverImageURL: data.metadata.coverImageURL,
          audioURL: data.metadata.audioURL,
          chapterCount: data.chapters.length,
          isPremium: false,
        });
        console.log(`    Found: ${data.metadata.title}`);
      } catch (error) {
        console.log(`    Error fetching ${id}:`, error);
      }
    }

    console.log(`\nBuilding manifest with ${stories.length} stories...`);

    const manifest: Manifest = {
      stories,
      generatedAt: new Date().toISOString(),
    };

    // Upload to R2
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME || "sanlang-media";

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error("R2 credentials not configured");
    }

    const client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    const manifestJson = JSON.stringify(manifest, null, 2);
    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: "stories/manifest.json",
        Body: manifestJson,
        ContentType: "application/json",
      })
    );

    console.log(`\nManifest uploaded to R2: stories/manifest.json`);
    console.log(`Public URL: ${R2_PUBLIC_URL}/stories/manifest.json`);

    return { storiesCount: stories.length };
  },
});
