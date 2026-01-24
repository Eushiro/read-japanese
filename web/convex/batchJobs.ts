import { v } from "convex/values";

import { internalMutation,mutation, query } from "./_generated/server";

// ============================================
// BATCH JOB QUERIES
// ============================================

// List all batch jobs
export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("submitted"),
        v.literal("running"),
        v.literal("succeeded"),
        v.literal("failed"),
        v.literal("cancelled")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let jobs;

    if (args.status) {
      jobs = await ctx.db
        .query("batchJobs")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .collect();
    } else {
      jobs = await ctx.db.query("batchJobs").order("desc").collect();
    }

    return args.limit ? jobs.slice(0, args.limit) : jobs;
  },
});

// Get a specific batch job
export const get = query({
  args: {
    jobId: v.id("batchJobs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

// Get job by Google batch name
export const getByGoogleName = query({
  args: {
    googleBatchJobName: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("batchJobs")
      .withIndex("by_google_job", (q) => q.eq("googleBatchJobName", args.googleBatchJobName))
      .first();
  },
});

// ============================================
// BATCH JOB MUTATIONS
// ============================================

// Create a new batch job
export const create = mutation({
  args: {
    jobType: v.union(v.literal("sentences"), v.literal("audio"), v.literal("images")),
    deckId: v.optional(v.string()),
    model: v.string(),
    itemCount: v.number(),
    estimatedCost: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("batchJobs", {
      jobType: args.jobType,
      deckId: args.deckId,
      model: args.model,
      itemCount: args.itemCount,
      processedCount: 0,
      status: "pending",
      estimatedCost: args.estimatedCost,
      createdAt: now,
    });
  },
});

// Update job after submission to Google
export const markSubmitted = mutation({
  args: {
    jobId: v.id("batchJobs"),
    googleBatchJobName: v.string(),
    inputFileUri: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "submitted",
      googleBatchJobName: args.googleBatchJobName,
      inputFileUri: args.inputFileUri,
      submittedAt: Date.now(),
    });
  },
});

// Update job status from Google polling
export const updateStatus = mutation({
  args: {
    jobId: v.id("batchJobs"),
    status: v.union(
      v.literal("pending"),
      v.literal("submitted"),
      v.literal("running"),
      v.literal("succeeded"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    processedCount: v.optional(v.number()),
    outputFileUri: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    actualCost: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { jobId, ...updates } = args;

    const patchData: Record<string, unknown> = { ...updates };

    if (
      updates.status === "succeeded" ||
      updates.status === "failed" ||
      updates.status === "cancelled"
    ) {
      patchData.completedAt = Date.now();
    }

    await ctx.db.patch(jobId, patchData);
  },
});

// Cancel a job
export const cancel = mutation({
  args: {
    jobId: v.id("batchJobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    if (job.status === "succeeded" || job.status === "failed") {
      throw new Error("Cannot cancel completed job");
    }

    await ctx.db.patch(args.jobId, {
      status: "cancelled",
      completedAt: Date.now(),
    });
  },
});

// ============================================
// INTERNAL MUTATIONS (for processing scripts)
// ============================================

// Increment processed count
export const incrementProcessed = internalMutation({
  args: {
    jobId: v.id("batchJobs"),
    count: v.number(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;

    await ctx.db.patch(args.jobId, {
      processedCount: job.processedCount + args.count,
    });
  },
});
