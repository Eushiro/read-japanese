/**
 * Script to seed YouTube videos into the database
 * Run with: npx convex run scripts/seedVideos
 *
 * Note: After seeding, you need to fetch transcripts and generate questions:
 * 1. Go to Convex dashboard
 * 2. Run api.ai.fetchYoutubeTranscript for each video
 * 3. Run api.ai.generateVideoQuestions for each video
 */

import { mutation } from "../convex/_generated/server";
import { v } from "convex/values";

// Educational videos curated for language learning
const SEED_VIDEOS = [
  // Japanese - N5/Beginner
  {
    videoId: "rGrBHiuPlT0", // Comprehensible Japanese - 自己紹介 (Self Introduction)
    language: "japanese" as const,
    level: "N5",
    title: "自己紹介 - Self Introduction in Japanese",
    description: "Learn basic self-introduction phrases in Japanese. Perfect for absolute beginners.",
    duration: 180, // ~3 minutes
  },
  {
    videoId: "ORb-fVn-YyI", // Japanese Ammo - Hiragana basics
    language: "japanese" as const,
    level: "N5",
    title: "Hiragana Made Easy - Learn Japanese Writing",
    description: "Introduction to Hiragana, the basic Japanese writing system for beginners.",
    duration: 300, // ~5 minutes
  },
  {
    videoId: "6p9Il_j0zjc", // JapanesePod101 - Basic greetings
    language: "japanese" as const,
    level: "N5",
    title: "Basic Japanese Greetings",
    description: "Essential greetings and phrases for everyday Japanese conversation.",
    duration: 240, // ~4 minutes
  },
  // Japanese - N4
  {
    videoId: "qf-xqOWvH84", // Miku Real Japanese - て form
    language: "japanese" as const,
    level: "N4",
    title: "て Form Explained Simply",
    description: "Master the Japanese て form with clear examples and practice.",
    duration: 360, // ~6 minutes
  },
  // Japanese - N3
  {
    videoId: "Vz2PGkpOXgU", // Nihongo no Mori - N3 Grammar
    language: "japanese" as const,
    level: "N3",
    title: "JLPT N3 Grammar Review",
    description: "Key grammar patterns for JLPT N3 preparation.",
    duration: 420, // ~7 minutes
  },

  // English - A1/A2
  {
    videoId: "juKd26qkNAw", // BBC Learning English - 6 Minute English intro
    language: "english" as const,
    level: "A2",
    title: "Learn English: Daily Routines",
    description: "Practice talking about daily routines with simple English vocabulary.",
    duration: 180, // ~3 minutes
  },
  {
    videoId: "DHvZLI7Db8E", // English with Lucy - Basic phrases
    language: "english" as const,
    level: "A1",
    title: "100 Basic English Phrases for Beginners",
    description: "Essential English phrases every beginner should know.",
    duration: 300, // ~5 minutes
  },
  // English - B1
  {
    videoId: "eW3gMGqcZQc", // English Addict - Intermediate listening
    language: "english" as const,
    level: "B1",
    title: "Improve Your English Listening Skills",
    description: "Intermediate English listening practice with native speakers.",
    duration: 360, // ~6 minutes
  },

  // French - A1/A2
  {
    videoId: "K5PzS8cZ1Rc", // Français avec Pierre - Se présenter
    language: "french" as const,
    level: "A1",
    title: "Se Présenter en Français - French Self Introduction",
    description: "Learn to introduce yourself in French with basic vocabulary.",
    duration: 240, // ~4 minutes
  },
  {
    videoId: "Fz-0BBQ_lFg", // Learn French with Alexa - Numbers
    language: "french" as const,
    level: "A1",
    title: "French Numbers 1-100",
    description: "Master counting in French from 1 to 100.",
    duration: 300, // ~5 minutes
  },
  // French - B1
  {
    videoId: "8sC6KMIJ3Hs", // innerFrench - Intermediate
    language: "french" as const,
    level: "B1",
    title: "French Listening Practice - Intermediate",
    description: "Natural French conversation for intermediate learners.",
    duration: 420, // ~7 minutes
  },
];

export default mutation({
  args: {},
  handler: async (ctx) => {
    const results = [];

    for (const video of SEED_VIDEOS) {
      // Check if video already exists
      const existing = await ctx.db
        .query("youtubeContent")
        .withIndex("by_video_id", (q) => q.eq("videoId", video.videoId))
        .first();

      if (existing) {
        // Update existing
        await ctx.db.patch(existing._id, {
          language: video.language,
          level: video.level,
          title: video.title,
          description: video.description,
          thumbnailUrl: `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`,
          duration: video.duration,
        });
        results.push({ videoId: video.videoId, action: "updated", title: video.title });
      } else {
        // Create new
        await ctx.db.insert("youtubeContent", {
          videoId: video.videoId,
          language: video.language,
          level: video.level,
          title: video.title,
          description: video.description,
          thumbnailUrl: `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`,
          duration: video.duration,
          createdAt: Date.now(),
        });
        results.push({ videoId: video.videoId, action: "created", title: video.title });
      }
    }

    return { seeded: results.length, results };
  },
});
