import { v } from "convex/values";

import { internalQuery } from "./_generated/server";

export const buildExportPayloadForClerkUser = internalQuery({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (user === null) {
      throw new Error("User record not found");
    }

    const [excludedApps, sessions, recommendations] = await Promise.all([
      ctx.db.query("excludedApps").withIndex("by_user", (q) => q.eq("userId", user._id)).collect(),
      ctx.db.query("usageSessions").withIndex("by_user_time", (q) => q.eq("userId", user._id)).collect(),
      ctx.db.query("aiRecommendations").withIndex("by_user", (q) => q.eq("userId", user._id)).collect(),
    ]);

    const now = Date.now();
    const startMs = now - 24 * 60 * 60 * 1000;
    const recentSessions = sessions
      .filter((session) => session.startTime >= startMs)
      .sort((left, right) => left.startTime - right.startTime);

    const latestRecommendations = new Map<string, (typeof recommendations)[number]>();
    for (const recommendation of recommendations) {
      const currentRecommendation = latestRecommendations.get(recommendation.appPackage);
      if (!currentRecommendation || recommendation.createdAt > currentRecommendation.createdAt) {
        latestRecommendations.set(recommendation.appPackage, recommendation);
      }
    }

    return {
      userId: user.clerkId,
      convexUserId: String(user._id),
      exportedAt: new Date(now).toISOString(),
      rangeStart: new Date(startMs).toISOString(),
      rangeEnd: new Date(now).toISOString(),
      profile: {
        name: user.name,
        timezone: user.timezone,
        nudgeStyle: user.nudgeStyle,
        defaultSessionLimitMinutes: user.defaultSessionLimitMinutes,
      },
      excludedApps: excludedApps.map((app) => ({
        appPackage: app.appPackage,
        appName: app.appName,
      })),
      sessions: recentSessions.map((session) => ({
        appPackage: session.appPackage,
        appName: session.appName,
        startTime: session.startTime,
        endTime: session.endTime,
        durationMs: session.durationMs,
      })),
      currentRecommendations: [...latestRecommendations.values()].map((recommendation) => ({
        appPackage: recommendation.appPackage,
        appName: recommendation.appName,
        sessionLimitMinutes: recommendation.sessionLimitMinutes,
        breakSchedule: recommendation.breakSchedule,
        effectiveDate: recommendation.effectiveDate,
      })),
    };
  },
});
