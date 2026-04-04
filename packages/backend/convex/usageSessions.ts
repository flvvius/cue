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

export const syncForCurrentUser = mutation({
  args: {
    sessions: v.array(
      v.object({
        appPackage: v.string(),
        appName: v.string(),
        startTime: v.number(),
        endTime: v.number(),
        durationMs: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await getCurrentIdentity(ctx);
    const user = await getUserByClerkId(ctx, identity.subject);
    if (user === null) {
      throw new Error("User record not found");
    }

    let inserted = 0;
    let skipped = 0;

    for (const session of args.sessions) {
      const existingSession = await ctx.db
        .query("usageSessions")
        .withIndex("by_user_app_time", (q) =>
          q
            .eq("userId", user._id)
            .eq("appPackage", session.appPackage)
            .eq("startTime", session.startTime)
        )
        .unique();

      if (existingSession !== null) {
        skipped += 1;
        continue;
      }

      await ctx.db.insert("usageSessions", {
        userId: user._id,
        appPackage: session.appPackage,
        appName: session.appName,
        startTime: session.startTime,
        endTime: session.endTime,
        durationMs: session.durationMs,
      });
      inserted += 1;
    }

    return {
      inserted,
      skipped,
      received: args.sessions.length,
      syncedAt: Date.now(),
    };
  },
});

export const summaryForCurrentUser = query({
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

    const sessions = await ctx.db
      .query("usageSessions")
      .withIndex("by_user_time", (q) => q.eq("userId", user._id))
      .collect();

    const now = Date.now();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayStartMs = dayStart.getTime();

    const todaySessions = sessions.filter((session) => session.startTime >= dayStartMs);
    const todayTotalMs = todaySessions.reduce((total, session) => total + session.durationMs, 0);

    const recentSessions = [...sessions]
      .sort((left, right) => right.startTime - left.startTime)
      .slice(0, 5);

    return {
      totalSessions: sessions.length,
      todaySessionCount: todaySessions.length,
      todayTotalMinutes: Math.round(todayTotalMs / 60000),
      recentSessions,
    };
  },
});
