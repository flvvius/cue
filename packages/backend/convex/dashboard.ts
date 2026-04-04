import { query } from "./_generated/server";

async function getUserByClerkId(ctx: any, clerkId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", clerkId))
    .unique();
}

export const overviewForCurrentUser = query({
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

    const [excludedApps, sessions, nudges, recommendations] = await Promise.all([
      ctx.db.query("excludedApps").withIndex("by_user", (q) => q.eq("userId", user._id)).collect(),
      ctx.db.query("usageSessions").withIndex("by_user_time", (q) => q.eq("userId", user._id)).collect(),
      ctx.db.query("nudges").withIndex("by_user_time", (q) => q.eq("userId", user._id)).collect(),
      ctx.db.query("aiRecommendations").withIndex("by_user", (q) => q.eq("userId", user._id)).collect(),
    ]);

    const now = Date.now();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayStartMs = dayStart.getTime();

    const excludedPackages = new Set(excludedApps.map((app) => app.appPackage));
    const todaySessions = sessions.filter((session) => session.startTime >= dayStartMs);
    const monitoredSessions = todaySessions.filter((session) => !excludedPackages.has(session.appPackage));

    const latestRecommendations = new Map<string, (typeof recommendations)[number]>();
    for (const recommendation of recommendations) {
      const currentRecommendation = latestRecommendations.get(recommendation.appPackage);
      if (!currentRecommendation || recommendation.createdAt > currentRecommendation.createdAt) {
        latestRecommendations.set(recommendation.appPackage, recommendation);
      }
    }

    const perAppMap = new Map<string, {
      appPackage: string;
      appName: string;
      totalDurationMs: number;
      sessionCount: number;
      limitMinutes: number;
    }>();

    for (const session of monitoredSessions) {
      const recommendation = latestRecommendations.get(session.appPackage);
      const existingEntry = perAppMap.get(session.appPackage);
      const limitMinutes = recommendation?.sessionLimitMinutes ?? user.defaultSessionLimitMinutes;

      if (existingEntry) {
        existingEntry.totalDurationMs += session.durationMs;
        existingEntry.sessionCount += 1;
        existingEntry.limitMinutes = limitMinutes;
      } else {
        perAppMap.set(session.appPackage, {
          appPackage: session.appPackage,
          appName: session.appName,
          totalDurationMs: session.durationMs,
          sessionCount: 1,
          limitMinutes,
        });
      }
    }

    const monitoredApps = [...perAppMap.values()]
      .map((app) => {
        const totalMinutes = Math.round(app.totalDurationMs / 60000);
        return {
          ...app,
          totalMinutes,
          isOverLimit: totalMinutes > app.limitMinutes,
          progressPercent: Math.min(100, Math.round((totalMinutes / Math.max(1, app.limitMinutes)) * 100)),
        };
      })
      .sort((left, right) => right.totalDurationMs - left.totalDurationMs);

    const todayNudges = nudges.filter((nudge) => nudge.createdAt >= dayStartMs);
    const acceptedNudges = todayNudges.filter((nudge) => nudge.status === "accepted").length;
    const dismissedNudges = todayNudges.filter((nudge) => nudge.status === "dismissed").length;

    const currentStreakDays =
      monitoredApps.length > 0 && monitoredApps.every((app) => !app.isOverLimit) ? 1 : 0;

    return {
      defaultLimitMinutes: user.defaultSessionLimitMinutes,
      monitoredApps,
      excludedApps: excludedApps.map((app) => ({
        appName: app.appName,
        appPackage: app.appPackage,
      })),
      recommendations: [...latestRecommendations.values()].map((recommendation) => ({
        appPackage: recommendation.appPackage,
        appName: recommendation.appName,
        sessionLimitMinutes: recommendation.sessionLimitMinutes,
        breakSchedule: recommendation.breakSchedule,
        effectiveDate: recommendation.effectiveDate,
      })),
      nudgeStats: {
        accepted: acceptedNudges,
        dismissed: dismissedNudges,
      },
      currentStreakDays,
    };
  },
});
