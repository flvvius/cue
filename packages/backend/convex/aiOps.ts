import { v } from "convex/values";

import { internalMutation, query } from "./_generated/server";

async function getUserByClerkId(ctx: any, clerkId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", clerkId))
    .unique();
}

export const recordExportRun = internalMutation({
  args: {
    userId: v.id("users"),
    endpoint: v.optional(v.string()),
    requestedAt: v.number(),
    sent: v.boolean(),
    reason: v.string(),
    status: v.optional(v.number()),
    sessionCount: v.number(),
    excludedCount: v.number(),
    recommendationCount: v.number(),
    payload: v.any(),
    responsePreview: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("aiExportRuns", args);
  },
});

export const recordWebhookEvent = internalMutation({
  args: {
    clerkId: v.string(),
    receivedAt: v.number(),
    stored: v.boolean(),
    effectiveDate: v.optional(v.string()),
    recommendationCount: v.number(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("aiWebhookEvents", args);
  },
});

export const recentExportRunsForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return { runs: [] };
    }

    const user = await getUserByClerkId(ctx, identity.subject);
    if (user === null) {
      return { runs: [] };
    }

    const runs = await ctx.db
      .query("aiExportRuns")
      .withIndex("by_user_time", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(6);

    return {
      runs: runs.map((run) => ({
        _id: run._id,
        endpoint: run.endpoint ?? null,
        requestedAt: run.requestedAt,
        sent: run.sent,
        reason: run.reason,
        status: run.status ?? null,
        sessionCount: run.sessionCount,
        excludedCount: run.excludedCount,
        recommendationCount: run.recommendationCount,
        responsePreview: run.responsePreview ?? null,
      })),
    };
  },
});

export const recentWebhookEventsForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return { events: [] };
    }

    const events = await ctx.db
      .query("aiWebhookEvents")
      .withIndex("by_clerk_time", (q) => q.eq("clerkId", identity.subject))
      .order("desc")
      .take(6);

    return {
      events: events.map((event) => ({
        _id: event._id,
        receivedAt: event.receivedAt,
        stored: event.stored,
        effectiveDate: event.effectiveDate ?? null,
        recommendationCount: event.recommendationCount,
        error: event.error ?? null,
      })),
    };
  },
});
