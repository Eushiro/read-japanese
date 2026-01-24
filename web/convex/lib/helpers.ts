import type { Doc } from "../_generated/dataModel";
import type { MutationCtx,QueryCtx } from "../_generated/server";

/**
 * Find a user by their Clerk ID
 * @returns The user document or null if not found
 */
export async function findUserByClerkId(
  ctx: QueryCtx | MutationCtx,
  clerkId: string
): Promise<Doc<"users"> | null> {
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .first();
}

/**
 * Find a user by their Clerk ID or throw an error
 * @returns The user document
 * @throws Error if user not found
 */
export async function requireUserByClerkId(
  ctx: QueryCtx | MutationCtx,
  clerkId: string
): Promise<Doc<"users">> {
  const user = await findUserByClerkId(ctx, clerkId);
  if (!user) {
    throw new Error(`User not found for clerkId: ${clerkId}`);
  }
  return user;
}

/**
 * Get today's date as a string in YYYY-MM-DD format
 */
export function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Get yesterday's date as a string in YYYY-MM-DD format
 */
export function getYesterdayString(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split("T")[0];
}
