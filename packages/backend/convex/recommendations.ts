import { v } from "convex/values";

import { internalMutation, mutation } from "./_generated/server";

async function getCurrentIdentity(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new Error("Unauthorized");
  }
  return identity;
}

async function getUserByClerkId(ctx: any, clerkId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", clerkId))
    .unique();
}

async function replaceRecommendationsForUser(params: {
  ctx: any;
  userId: string;
  recommendations: Array<{
    appPackage: string;
    appName: string;
    sessionLimitMinutes: number;
    breakSchedule: Array<{
      from: string;
      to: string;
      breakAfterMinutes: number;
    }>;
  }>;
  effectiveDate: string;
}) {
  const existingRecommendations = await params.ctx.db
    .query("aiRecommendations")
    .withIndex("by_user", (q: any) => q.eq("userId", params.userId))
    .collect();

  for (const recommendation of existingRecommendations) {
    await params.ctx.db.delete(recommendation._id);
  }

  for (const recommendation of params.recommendations) {
    await params.ctx.db.insert("aiRecommendations", {
      userId: params.userId,
      appPackage: recommendation.appPackage,
      appName: recommendation.appName,
      sessionLimitMinutes: recommendation.sessionLimitMinutes,
      breakSchedule: recommendation.breakSchedule,
      effectiveDate: params.effectiveDate,
      createdAt: Date.now(),
    });
  }

  return {
    cleared: existingRecommendations.length,
    stored: params.recommendations.length,
    effectiveDate: params.effectiveDate,
  };
}

const FALLBACK_RECOMMENDATIONS = [
  {
    appPackage: "com.instagram.android",
    appName: "Instagram",
    sessionLimitMinutes: 15,
    breakSchedule: [
      { from: "06:00", to: "12:00", breakAfterMinutes: 4 },
      { from: "12:00", to: "18:00", breakAfterMinutes: 6 },
      { from: "18:00", to: "23:59", breakAfterMinutes: 8 },
      { from: "00:00", to: "06:00", breakAfterMinutes: 5 },
    ],
  },
  {
    appPackage: "com.zhiliaoapp.musically",
    appName: "TikTok",
    sessionLimitMinutes: 12,
    breakSchedule: [
      { from: "06:00", to: "12:00", breakAfterMinutes: 5 },
      { from: "12:00", to: "18:00", breakAfterMinutes: 7 },
      { from: "18:00", to: "23:59", breakAfterMinutes: 10 },
      { from: "00:00", to: "06:00", breakAfterMinutes: 6 },
    ],
  },
  {
    appPackage: "com.google.android.youtube",
    appName: "YouTube",
    sessionLimitMinutes: 20,
    breakSchedule: [
      { from: "06:00", to: "12:00", breakAfterMinutes: 5 },
      { from: "12:00", to: "18:00", breakAfterMinutes: 8 },
      { from: "18:00", to: "23:59", breakAfterMinutes: 10 },
      { from: "00:00", to: "06:00", breakAfterMinutes: 6 },
    ],
  },
  {
    appPackage: "com.reddit.frontpage",
    appName: "Reddit",
    sessionLimitMinutes: 18,
    breakSchedule: [
      { from: "06:00", to: "12:00", breakAfterMinutes: 4 },
      { from: "12:00", to: "18:00", breakAfterMinutes: 6 },
      { from: "18:00", to: "23:59", breakAfterMinutes: 9 },
      { from: "00:00", to: "06:00", breakAfterMinutes: 5 },
    ],
  },
  {
    appPackage: "com.twitter.android",
    appName: "X",
    sessionLimitMinutes: 10,
    breakSchedule: [
      { from: "06:00", to: "12:00", breakAfterMinutes: 4 },
      { from: "12:00", to: "18:00", breakAfterMinutes: 5 },
      { from: "18:00", to: "23:59", breakAfterMinutes: 7 },
      { from: "00:00", to: "06:00", breakAfterMinutes: 5 },
    ],
  },
];

export const seedFallbackForCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await getCurrentIdentity(ctx);
    const user = await getUserByClerkId(ctx, identity.subject);
    if (user === null) {
      throw new Error("User record not found");
    }

    const effectiveDate = new Date().toISOString().slice(0, 10);
    await replaceRecommendationsForUser({
      ctx,
      userId: user._id,
      recommendations: FALLBACK_RECOMMENDATIONS,
      effectiveDate,
    });

    return {
      seeded: FALLBACK_RECOMMENDATIONS.length,
      effectiveDate,
    };
  },
});

export const clearForCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await getCurrentIdentity(ctx);
    const user = await getUserByClerkId(ctx, identity.subject);
    if (user === null) {
      throw new Error("User record not found");
    }

    const existingRecommendations = await ctx.db
      .query("aiRecommendations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const recommendation of existingRecommendations) {
      await ctx.db.delete(recommendation._id);
    }

    return {
      cleared: existingRecommendations.length,
    };
  },
});

export const storeForCurrentUser = mutation({
  args: {
    recommendations: v.array(
      v.object({
        appPackage: v.string(),
        appName: v.string(),
        sessionLimitMinutes: v.number(),
        breakSchedule: v.array(
          v.object({
            from: v.string(),
            to: v.string(),
            breakAfterMinutes: v.number(),
          }),
        ),
      }),
    ),
    effectiveDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await getCurrentIdentity(ctx);
    const user = await getUserByClerkId(ctx, identity.subject);
    if (user === null) {
      throw new Error("User record not found");
    }

    const effectiveDate = args.effectiveDate ?? new Date().toISOString().slice(0, 10);
    await replaceRecommendationsForUser({
      ctx,
      userId: user._id,
      recommendations: args.recommendations,
      effectiveDate,
    });

    return {
      stored: args.recommendations.length,
      effectiveDate,
    };
  },
});

export const storeForClerkUser = internalMutation({
  args: {
    clerkId: v.string(),
    recommendations: v.array(
      v.object({
        appPackage: v.string(),
        appName: v.string(),
        sessionLimitMinutes: v.number(),
        breakSchedule: v.array(
          v.object({
            from: v.string(),
            to: v.string(),
            breakAfterMinutes: v.number(),
          }),
        ),
      }),
    ),
    effectiveDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getUserByClerkId(ctx, args.clerkId);
    if (user === null) {
      throw new Error("User record not found");
    }

    const effectiveDate = args.effectiveDate ?? new Date().toISOString().slice(0, 10);
    return await replaceRecommendationsForUser({
      ctx,
      userId: user._id,
      recommendations: args.recommendations,
      effectiveDate,
    });
  },
});
