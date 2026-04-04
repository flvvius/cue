import { v } from "convex/values";

import { internal } from "./_generated/api";
import { mutation } from "./_generated/server";

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

export const requestForCurrentUser = mutation({
  args: {
    triggerApp: v.string(),
    appName: v.string(),
    type: v.union(
      v.literal("limit_warning"),
      v.literal("pattern_break"),
      v.literal("session_check"),
      v.literal("ai_limit"),
      v.literal("break_time"),
    ),
    thresholdBucket: v.union(
      v.literal("approaching"),
      v.literal("at_limit"),
      v.literal("exceeded"),
    ),
    limitMinutes: v.number(),
    breakDurationMinutes: v.number(),
    alternative: v.optional(v.string()),
    cooldownMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await getCurrentIdentity(ctx);
    const user = await getUserByClerkId(ctx, identity.subject);
    if (user === null) {
      throw new Error("User record not found");
    }

    await ctx.scheduler.runAfter(0, (internal as any).nudgeGeneration.generateForUser, {
      userId: user._id,
      triggerApp: args.triggerApp,
      appName: args.appName,
      type: args.type,
      thresholdBucket: args.thresholdBucket,
      limitMinutes: args.limitMinutes,
      breakDurationMinutes: args.breakDurationMinutes,
      alternative: args.alternative,
      cooldownMinutes: args.cooldownMinutes,
      nudgeStyle: user.nudgeStyle,
    });

    return {
      queued: true,
    };
  },
});
