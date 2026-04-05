import { v } from "convex/values";

import { internalQuery } from "./_generated/server";
import {
  buildMetabolicPayload,
  normalizeMetabolicEngineState,
} from "./metabolicEngine";

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

    const [excludedApps, sessions, recommendations, engineState] = await Promise.all([
      ctx.db.query("excludedApps").withIndex("by_user", (q) => q.eq("userId", user._id)).collect(),
      ctx.db.query("usageSessions").withIndex("by_user_time", (q) => q.eq("userId", user._id)).collect(),
      ctx.db.query("aiRecommendations").withIndex("by_user", (q) => q.eq("userId", user._id)).collect(),
      ctx.db.query("metabolicEngineStates").withIndex("by_user", (q) => q.eq("userId", user._id)).unique(),
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

    const metabolicPayload = buildMetabolicPayload({
      clerkId: user.clerkId,
      timeZone: user.timezone,
      sessions: recentSessions,
      state: normalizeMetabolicEngineState(engineState, now),
      now,
    });

    return {
      ...metabolicPayload,
      convex_user_id: String(user._id),
      exported_at: new Date(now).toISOString(),
      metadata: {
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
        currentRecommendations: [...latestRecommendations.values()].map((recommendation) => ({
          appPackage: recommendation.appPackage,
          appName: recommendation.appName,
          sessionLimitMinutes: recommendation.sessionLimitMinutes,
          breakSchedule: recommendation.breakSchedule,
          effectiveDate: recommendation.effectiveDate,
        })),
        rangeStart: new Date(startMs).toISOString(),
        rangeEnd: new Date(now).toISOString(),
      },
    };
  },
});
