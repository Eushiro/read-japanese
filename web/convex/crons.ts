import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

// Run sentence refresh check every day at 3 AM UTC
crons.daily(
  "refresh-flashcard-sentences",
  { hourUTC: 3, minuteUTC: 0 },
  internal.scheduledJobs.refreshDueSentences
);

export default crons;
