import { v } from "convex/values";

import { mutation,query } from "./_generated/server";

// Admin utility queries

/**
 * Get admin dashboard stats
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    // Get video counts
    const videos = await ctx.db.query("youtubeContent").collect();
    const videosWithQuestions = videos.filter((v) => v.questions && v.questions.length > 0).length;
    const videosWithTranscripts = videos.filter(
      (v) => v.transcript && v.transcript.length > 0
    ).length;

    // Get deck counts
    const decks = await ctx.db.query("premadeDecks").collect();
    const publishedDecks = decks.filter((d) => d.isPublished).length;

    // Get job counts
    const jobs = await ctx.db.query("batchJobs").collect();
    const activeJobs = jobs.filter(
      (j) => j.status === "running" || j.status === "submitted"
    ).length;
    const failedJobs = jobs.filter((j) => j.status === "failed").length;

    // Get user count
    const users = await ctx.db.query("users").collect();

    return {
      videos: {
        total: videos.length,
        withQuestions: videosWithQuestions,
        withTranscripts: videosWithTranscripts,
        needingWork: videos.length - videosWithQuestions,
      },
      decks: {
        total: decks.length,
        published: publishedDecks,
      },
      jobs: {
        total: jobs.length,
        active: activeJobs,
        failed: failedJobs,
      },
      users: {
        total: users.length,
      },
    };
  },
});

// ============================================
// USER INTEREST ANALYTICS
// ============================================

/**
 * Get aggregated user interest analytics for admin panel
 */
export const getInterestAnalytics = query({
  args: {},
  handler: async (ctx) => {
    const prefs = await ctx.db.query("userPreferences").collect();

    // Aggregate interests
    const interestCounts: Record<string, number> = {};
    const tonePreferences: Record<string, number> = {};
    const learningGoals: Record<string, number> = {};
    const culturalFocus: Record<string, number> = {};

    for (const pref of prefs) {
      // Count interests
      if (pref.content?.interests) {
        for (const interest of pref.content.interests) {
          interestCounts[interest] = (interestCounts[interest] || 0) + 1;
        }
      }

      // Count tone preferences
      if (pref.content?.tonePreference) {
        tonePreferences[pref.content.tonePreference] =
          (tonePreferences[pref.content.tonePreference] || 0) + 1;
      }

      // Count learning goals
      if (pref.content?.learningGoal) {
        learningGoals[pref.content.learningGoal] =
          (learningGoals[pref.content.learningGoal] || 0) + 1;
      }

      // Count cultural focus
      if (pref.content?.culturalFocus) {
        for (const focus of pref.content.culturalFocus) {
          culturalFocus[focus] = (culturalFocus[focus] || 0) + 1;
        }
      }
    }

    // Sort by count and calculate percentages
    const totalUsers = prefs.length || 1; // Avoid division by zero

    const sortedInterests = Object.entries(interestCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([interest, count]) => ({
        interest,
        count,
        percentage: Math.round((count / totalUsers) * 100),
      }));

    const sortedTones = Object.entries(tonePreferences)
      .sort((a, b) => b[1] - a[1])
      .map(([tone, count]) => ({
        tone,
        count,
        percentage: Math.round((count / totalUsers) * 100),
      }));

    const sortedGoals = Object.entries(learningGoals)
      .sort((a, b) => b[1] - a[1])
      .map(([goal, count]) => ({
        goal,
        count,
        percentage: Math.round((count / totalUsers) * 100),
      }));

    const sortedCultural = Object.entries(culturalFocus)
      .sort((a, b) => b[1] - a[1])
      .map(([focus, count]) => ({
        focus,
        count,
        percentage: Math.round((count / totalUsers) * 100),
      }));

    return {
      totalUsersWithPreferences: prefs.length,
      interests: sortedInterests,
      tonePreferences: sortedTones,
      learningGoals: sortedGoals,
      culturalFocus: sortedCultural,
    };
  },
});

// ============================================
// MEDIA MANAGEMENT
// ============================================

// Typical file sizes based on our generation settings (in bytes)
// WAV: 24kHz 16-bit mono, ~5-10 seconds = 240-480KB
// MP3: 128kbps, same duration = 24-48KB
// PNG: AI-generated images = 100-300KB
// WebP: Same images = 30-90KB
const TYPICAL_SIZES = {
  wav: 350 * 1024, // ~350KB average
  mp3: 35 * 1024, // ~35KB average (90% smaller)
  png: 200 * 1024, // ~200KB average
  webp: 60 * 1024, // ~60KB average (70% smaller)
  jpg: 80 * 1024, // ~80KB average
  jpeg: 80 * 1024,
  unknown: 100 * 1024, // fallback
};

interface MediaFile {
  url: string;
  type: "audio" | "image";
  format: string;
  isCompressed: boolean;
  source: "premadeVocabulary" | "flashcards";
  id: string;
  word?: string;
  estimatedSize: number;
}

/**
 * Check if a URL points to a compressed file
 */
function isCompressedFormat(url: string): boolean {
  const compressedExtensions = [".mp3", ".webp", ".jpg", ".jpeg", ".ogg", ".opus"];
  return compressedExtensions.some((ext) => url.toLowerCase().includes(ext));
}

/**
 * Get file format from URL
 */
function getFormat(url: string): string {
  const match = url.match(/\.(\w+)(?:\?|$)/);
  return match ? match[1].toLowerCase() : "unknown";
}

/**
 * Get estimated file size based on format
 */
function getEstimatedSize(format: string): number {
  return TYPICAL_SIZES[format as keyof typeof TYPICAL_SIZES] || TYPICAL_SIZES.unknown;
}

/**
 * Get media stats for admin panel
 * Now reads from content library tables (sentences, images, wordAudio)
 */
export const getMediaStats = query({
  args: {},
  handler: async (ctx) => {
    // Collect all media files from content library tables
    const sentences = await ctx.db.query("sentences").collect();
    const images = await ctx.db.query("images").collect();
    const wordAudios = await ctx.db.query("wordAudio").collect();

    const files: MediaFile[] = [];

    // Helper to add file with size estimate
    const addFile = (
      url: string,
      type: "audio" | "image",
      source: "premadeVocabulary" | "flashcards",
      id: string,
      word?: string
    ) => {
      const format = getFormat(url);
      files.push({
        url,
        type,
        format,
        isCompressed: isCompressedFormat(url),
        source,
        id,
        word,
        estimatedSize: getEstimatedSize(format),
      });
    };

    // Process sentences (sentence audio)
    for (const sentence of sentences) {
      if (sentence.audioUrl) {
        addFile(sentence.audioUrl, "audio", "premadeVocabulary", sentence._id, sentence.word);
      }
    }

    // Process word audio
    for (const audio of wordAudios) {
      addFile(audio.audioUrl, "audio", "premadeVocabulary", audio._id, audio.word);
    }

    // Process images
    for (const image of images) {
      addFile(image.imageUrl, "image", "premadeVocabulary", image._id, image.word);
    }

    // Calculate stats
    const audioFiles = files.filter((f) => f.type === "audio");
    const imageFiles = files.filter((f) => f.type === "image");

    const uncompressedAudio = audioFiles.filter((f) => !f.isCompressed);
    const compressedAudio = audioFiles.filter((f) => f.isCompressed);
    const uncompressedImages = imageFiles.filter((f) => !f.isCompressed);
    const compressedImages = imageFiles.filter((f) => f.isCompressed);

    // Calculate sizes by format
    const wavFiles = audioFiles.filter((f) => f.format === "wav");
    const mp3Files = audioFiles.filter((f) => f.format === "mp3");
    const pngFiles = imageFiles.filter((f) => f.format === "png");
    const webpFiles = imageFiles.filter((f) => f.format === "webp");
    const jpgFiles = imageFiles.filter((f) => ["jpg", "jpeg"].includes(f.format));

    // Calculate total sizes
    const totalCurrentSize = files.reduce((sum, f) => sum + f.estimatedSize, 0);
    const wavSize = wavFiles.reduce((sum, f) => sum + f.estimatedSize, 0);
    const mp3Size = mp3Files.reduce((sum, f) => sum + f.estimatedSize, 0);
    const pngSize = pngFiles.reduce((sum, f) => sum + f.estimatedSize, 0);
    const webpSize = webpFiles.reduce((sum, f) => sum + f.estimatedSize, 0);
    const jpgSize = jpgFiles.reduce((sum, f) => sum + f.estimatedSize, 0);

    // Calculate what size would be after compression
    // WAV → MP3: ~90% reduction, PNG → WebP: ~70% reduction
    const wavToMp3Size = wavFiles.length * TYPICAL_SIZES.mp3;
    const pngToWebpSize = pngFiles.length * TYPICAL_SIZES.webp;

    const totalAfterCompression =
      mp3Size + // Already MP3
      wavToMp3Size + // WAV converted to MP3
      webpSize + // Already WebP
      jpgSize + // Already JPG (keep as-is)
      pngToWebpSize; // PNG converted to WebP

    const potentialSavings = totalCurrentSize - totalAfterCompression;
    const savingsPercent =
      totalCurrentSize > 0 ? Math.round((potentialSavings / totalCurrentSize) * 100) : 0;

    return {
      total: files.length,

      // Size breakdown
      sizes: {
        current: {
          total: totalCurrentSize,
          audio: audioFiles.reduce((sum, f) => sum + f.estimatedSize, 0),
          images: imageFiles.reduce((sum, f) => sum + f.estimatedSize, 0),
        },
        afterCompression: {
          total: totalAfterCompression,
          audio: mp3Size + wavToMp3Size,
          images: webpSize + jpgSize + pngToWebpSize,
        },
        savings: {
          bytes: potentialSavings,
          percent: savingsPercent,
        },
        byFormat: {
          wav: { count: wavFiles.length, size: wavSize },
          mp3: { count: mp3Files.length, size: mp3Size },
          png: { count: pngFiles.length, size: pngSize },
          webp: { count: webpFiles.length, size: webpSize },
          jpg: { count: jpgFiles.length, size: jpgSize },
        },
      },

      audio: {
        total: audioFiles.length,
        compressed: compressedAudio.length,
        uncompressed: uncompressedAudio.length,
        formats: {
          wav: wavFiles.length,
          mp3: mp3Files.length,
          other: audioFiles.filter((f) => !["wav", "mp3"].includes(f.format)).length,
        },
      },

      images: {
        total: imageFiles.length,
        compressed: compressedImages.length,
        uncompressed: uncompressedImages.length,
        formats: {
          png: pngFiles.length,
          webp: webpFiles.length,
          jpg: jpgFiles.length,
          other: imageFiles.filter((f) => !["png", "webp", "jpg", "jpeg"].includes(f.format))
            .length,
        },
      },

      // Chart data for visualization
      chartData: {
        formatDistribution: [
          { name: "WAV", value: wavFiles.length, size: wavSize, fill: "#ef4444" },
          { name: "MP3", value: mp3Files.length, size: mp3Size, fill: "#22c55e" },
          { name: "PNG", value: pngFiles.length, size: pngSize, fill: "#f97316" },
          { name: "WebP", value: webpFiles.length, size: webpSize, fill: "#06b6d4" },
          { name: "JPG", value: jpgFiles.length, size: jpgSize, fill: "#8b5cf6" },
        ].filter((d) => d.value > 0),
        compressionComparison: [
          {
            name: "Current",
            audio: audioFiles.reduce((sum, f) => sum + f.estimatedSize, 0) / (1024 * 1024),
            images: imageFiles.reduce((sum, f) => sum + f.estimatedSize, 0) / (1024 * 1024),
          },
          {
            name: "After Compression",
            audio: (mp3Size + wavToMp3Size) / (1024 * 1024),
            images: (webpSize + jpgSize + pngToWebpSize) / (1024 * 1024),
          },
        ],
        sizeByType: [
          {
            name: "Audio",
            current: audioFiles.reduce((sum, f) => sum + f.estimatedSize, 0),
            projected: mp3Size + wavToMp3Size,
          },
          {
            name: "Images",
            current: imageFiles.reduce((sum, f) => sum + f.estimatedSize, 0),
            projected: webpSize + jpgSize + pngToWebpSize,
          },
        ],
      },

      // Return uncompressed file list for compression
      uncompressedFiles: {
        audio: uncompressedAudio.slice(0, 100),
        images: uncompressedImages.slice(0, 100),
      },
    };
  },
});

/**
 * Get list of all uncompressed files for the compression script
 * Now reads from content library tables
 */
export const listUncompressedFiles = query({
  args: {
    type: v.optional(v.union(v.literal("audio"), v.literal("image"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sentences = await ctx.db.query("sentences").collect();
    const images = await ctx.db.query("images").collect();
    const wordAudios = await ctx.db.query("wordAudio").collect();

    const files: Array<{
      url: string;
      type: "audio" | "image";
      format: string;
      source: "sentences" | "images" | "wordAudio";
      id: string;
      field: "audioUrl" | "imageUrl";
    }> = [];

    // Process sentence audio
    if (!args.type || args.type === "audio") {
      for (const sentence of sentences) {
        if (sentence.audioUrl && !isCompressedFormat(sentence.audioUrl)) {
          files.push({
            url: sentence.audioUrl,
            type: "audio",
            format: getFormat(sentence.audioUrl),
            source: "sentences",
            id: sentence._id,
            field: "audioUrl",
          });
        }
      }

      // Process word audio
      for (const audio of wordAudios) {
        if (!isCompressedFormat(audio.audioUrl)) {
          files.push({
            url: audio.audioUrl,
            type: "audio",
            format: getFormat(audio.audioUrl),
            source: "wordAudio",
            id: audio._id,
            field: "audioUrl",
          });
        }
      }
    }

    // Process images
    if (!args.type || args.type === "image") {
      for (const image of images) {
        if (!isCompressedFormat(image.imageUrl)) {
          files.push({
            url: image.imageUrl,
            type: "image",
            format: getFormat(image.imageUrl),
            source: "images",
            id: image._id,
            field: "imageUrl",
          });
        }
      }
    }

    const limit = args.limit || files.length;
    return files.slice(0, limit);
  },
});

/**
 * Update a file URL after compression
 * Now updates content library tables
 */
export const updateCompressedUrl = mutation({
  args: {
    source: v.union(v.literal("sentences"), v.literal("images"), v.literal("wordAudio")),
    id: v.string(),
    field: v.union(v.literal("audioUrl"), v.literal("imageUrl")),
    newUrl: v.string(),
  },
  handler: async (ctx, args) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic table ID requires type assertion
    await ctx.db.patch(args.id as any, { [args.field]: args.newUrl });
    return { success: true };
  },
});
