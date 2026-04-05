import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

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

export const startForCurrentUser = mutation({
  args: {
    appPackage: v.string(),
    appName: v.string(),
    alternative: v.optional(v.string()),
    startedAt: v.number(),
    plannedEndsAt: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await getCurrentIdentity(ctx);
    const user = await getUserByClerkId(ctx, identity.subject);
    if (user === null) {
      throw new Error("User record not found");
    }

    const breakId = await ctx.db.insert("breaks", {
      userId: user._id,
      appPackage: args.appPackage,
      appName: args.appName,
      alternative: args.alternative,
      startedAt: args.startedAt,
      plannedEndsAt: args.plannedEndsAt,
      createdAt: Date.now(),
    });

    return { breakId };
  },
});

export const finishForCurrentUser = mutation({
  args: {
    appPackage: v.string(),
    finishedAt: v.number(),
    endedEarly: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await getCurrentIdentity(ctx);
    const user = await getUserByClerkId(ctx, identity.subject);
    if (user === null) {
      throw new Error("User record not found");
    }

    const recentBreaks = await ctx.db
      .query("breaks")
      .withIndex("by_user_app_start", (q) => q.eq("userId", user._id).eq("appPackage", args.appPackage))
      .order("desc")
      .take(10);

    const activeBreak = recentBreaks.find((item) => item.finishedAt === undefined);
    if (!activeBreak) {
      return { updated: false };
    }

    await ctx.db.patch(activeBreak._id, {
      finishedAt: args.finishedAt,
      endedEarly: args.endedEarly,
    });

    if (args.endedEarly) {
      await ctx.db.insert("socialEvents", {
        actorUserId: user._id,
        actorName: user.name,
        type: "break_ended_early",
        appPackage: activeBreak.appPackage,
        appName: activeBreak.appName,
        createdAt: args.finishedAt,
      });
    }

    return { updated: true, breakId: activeBreak._id };
  },
});

export const recentForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return { recentBreaks: [] };
    }

    const user = await getUserByClerkId(ctx, identity.subject);
    if (user === null) {
      return { recentBreaks: [] };
    }

    const recentBreaks = await ctx.db
      .query("breaks")
      .withIndex("by_user_start", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(12);

    return {
      recentBreaks: recentBreaks.map((item) => ({
        _id: item._id,
        appPackage: item.appPackage,
        appName: item.appName,
        alternative: item.alternative,
        startedAt: item.startedAt,
        plannedEndsAt: item.plannedEndsAt,
        finishedAt: item.finishedAt ?? null,
        endedEarly: item.endedEarly ?? false,
        durationMinutes: Math.max(1, Math.round((item.plannedEndsAt - item.startedAt) / 60000)),
      })),
    };
  },
});
