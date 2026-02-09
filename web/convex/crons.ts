import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

// Run sentence refresh check every day at 3 AM UTC
crons.daily(
  "refresh-flashcard-sentences",
  { hourUTC: 3, minuteUTC: 0 },
  internal.scheduledJobs.refreshDueSentences
);

// Clean up consumed and stuck prefetched practice sets daily at 4 AM UTC
crons.daily(
  "cleanup-prefetched-practice-sets",
  { hourUTC: 4, minuteUTC: 0 },
  internal.adaptivePracticeQueries.cleanupPrefetchedSets
);

export default crons;
