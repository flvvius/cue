import { v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";

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

const nudgeTypeValidator = v.union(
  v.literal("limit_warning"),
  v.literal("pattern_break"),
  v.literal("session_check"),
  v.literal("ai_limit"),
  v.literal("break_time"),
);

const thresholdBucketValidator = v.union(
  v.literal("approaching"),
  v.literal("at_limit"),
  v.literal("exceeded"),
);

const responseStatusValidator = v.union(
  v.literal("accepted"),
  v.literal("dismissed"),
);

export const getActiveForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }

    const user = await getUserByClerkId(ctx, identity.subject);
    if (user === null) {
      return null;
    }

    const pendingNudges = await ctx.db
      .query("nudges")
      .withIndex("by_user_status", (q) => q.eq("userId", user._id).eq("status", "pending"))
      .collect();

    const latestPending = [...pendingNudges]
      .sort((left, right) => right.createdAt - left.createdAt)[0];

    if (!latestPending) {
      return null;
    }

    return latestPending;
  },
});

async function queueNudgeForUser(params: {
  ctx: any;
  userId: string;
  triggerApp: string;
  type: "limit_warning" | "pattern_break" | "session_check" | "ai_limit" | "break_time";
  message: string;
  alternative?: string;
  thresholdBucket?: "approaching" | "at_limit" | "exceeded";
  breakDurationMinutes?: number;
  sessionStartTime?: number;
  cooldownMinutes?: number;
}) {
  const pendingNudges = await params.ctx.db
    .query("nudges")
    .withIndex("by_user_status", (q: any) => q.eq("userId", params.userId).eq("status", "pending"))
    .collect();

  const existingPending = pendingNudges.find(
    (nudge: any) =>
      nudge.triggerApp === params.triggerApp &&
      nudge.type === params.type &&
      (params.sessionStartTime === undefined || nudge.sessionStartTime === params.sessionStartTime),
  );
  if (existingPending) {
    return {
      created: false,
      reason: "pending_exists",
      nudgeId: existingPending._id,
    };
  }

  const cooldownMinutes = Math.max(0, params.cooldownMinutes ?? 20);
  const cooldownBoundary = Date.now() - cooldownMinutes * 60 * 1000;

  const recentNudges = (await params.ctx.db
    .query("nudges")
    .withIndex("by_user_time", (q: any) => q.eq("userId", params.userId))
    .collect())
    .filter(
      (nudge: any) =>
        nudge.triggerApp === params.triggerApp &&
        nudge.type === params.type &&
        (params.sessionStartTime === undefined || nudge.sessionStartTime === params.sessionStartTime) &&
        nudge.createdAt >= cooldownBoundary,
    );

  if (recentNudges.length > 0) {
    const latestRecent = [...recentNudges].sort(
      (left: any, right: any) => right.createdAt - left.createdAt,
    )[0]!;
    return {
      created: false,
      reason: "cooldown_active",
      nudgeId: latestRecent._id,
    };
  }

  const nudgeId = await params.ctx.db.insert("nudges", {
    userId: params.userId,
    triggerApp: params.triggerApp,
    type: params.type,
    message: params.message,
    alternative: params.alternative,
    thresholdBucket: params.thresholdBucket,
    breakDurationMinutes: params.breakDurationMinutes,
    sessionStartTime: params.sessionStartTime,
    status: "pending",
    createdAt: Date.now(),
  });

  return {
    created: true,
    reason: "created",
    nudgeId,
  };
}

export const queueForCurrentUser = mutation({
  args: {
    triggerApp: v.string(),
    type: nudgeTypeValidator,
    message: v.string(),
    alternative: v.optional(v.string()),
    thresholdBucket: v.optional(thresholdBucketValidator),
    breakDurationMinutes: v.optional(v.number()),
    sessionStartTime: v.optional(v.number()),
    cooldownMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await getCurrentIdentity(ctx);
    const user = await getUserByClerkId(ctx, identity.subject);
    if (user === null) {
      throw new Error("User record not found");
    }

    return await queueNudgeForUser({
      ctx,
      userId: user._id,
      triggerApp: args.triggerApp,
      type: args.type,
      message: args.message,
      alternative: args.alternative,
      thresholdBucket: args.thresholdBucket,
      breakDurationMinutes: args.breakDurationMinutes,
      sessionStartTime: args.sessionStartTime,
      cooldownMinutes: args.cooldownMinutes,
    });
  },
});

export const queueGeneratedForUser = internalMutation({
  args: {
    userId: v.id("users"),
    triggerApp: v.string(),
    type: nudgeTypeValidator,
    message: v.string(),
    alternative: v.optional(v.string()),
    thresholdBucket: v.optional(thresholdBucketValidator),
    breakDurationMinutes: v.optional(v.number()),
    sessionStartTime: v.optional(v.number()),
    cooldownMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await queueNudgeForUser({
      ctx,
      userId: args.userId,
      triggerApp: args.triggerApp,
      type: args.type,
      message: args.message,
      alternative: args.alternative,
      thresholdBucket: args.thresholdBucket,
      breakDurationMinutes: args.breakDurationMinutes,
      sessionStartTime: args.sessionStartTime,
      cooldownMinutes: args.cooldownMinutes,
    });
  },
});

export const respondToCurrentUser = mutation({
  args: {
    nudgeId: v.id("nudges"),
    status: responseStatusValidator,
  },
  handler: async (ctx, args) => {
    const identity = await getCurrentIdentity(ctx);
    const user = await getUserByClerkId(ctx, identity.subject);
    if (user === null) {
      throw new Error("User record not found");
    }

    const nudge = await ctx.db.get(args.nudgeId);
    if (nudge === null || nudge.userId !== user._id) {
      throw new Error("Nudge not found");
    }

    await ctx.db.patch(args.nudgeId, {
      status: args.status,
      respondedAt: Date.now(),
    });

    return await ctx.db.get(args.nudgeId);
  },
});
