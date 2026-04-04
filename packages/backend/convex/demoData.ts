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

function atMinutesAgo(baseNow: number, minutesAgo: number) {
  return baseNow - minutesAgo * 60 * 1000;
}

export const seedForCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await getCurrentIdentity(ctx);
    const user = await getUserByClerkId(ctx, identity.subject);
    if (user === null) {
      throw new Error("User record not found");
    }

    const now = Date.now();
    const demoSessions = [
      {
        appPackage: "com.instagram.android",
        appName: "Instagram",
        startTime: atMinutesAgo(now, 110),
        endTime: atMinutesAgo(now, 92),
      },
      {
        appPackage: "com.instagram.android",
        appName: "Instagram",
        startTime: atMinutesAgo(now, 48),
        endTime: atMinutesAgo(now, 34),
      },
      {
        appPackage: "com.twitter.android",
        appName: "X",
        startTime: atMinutesAgo(now, 80),
        endTime: atMinutesAgo(now, 68),
      },
      {
        appPackage: "com.reddit.frontpage",
        appName: "Reddit",
        startTime: atMinutesAgo(now, 140),
        endTime: atMinutesAgo(now, 124),
      },
      {
        appPackage: "com.google.android.youtube",
        appName: "YouTube",
        startTime: atMinutesAgo(now, 210),
        endTime: atMinutesAgo(now, 186),
      },
    ].map((session) => ({
      ...session,
      durationMs: session.endTime - session.startTime,
    }));

    let inserted = 0;
    let skipped = 0;

    for (const session of demoSessions) {
      const existingSession = await ctx.db
        .query("usageSessions")
        .withIndex("by_user_app_time", (q) =>
          q
            .eq("userId", user._id)
            .eq("appPackage", session.appPackage)
            .eq("startTime", session.startTime)
        )
        .unique();

      if (existingSession) {
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
      seededApps: [...new Set(demoSessions.map((session) => session.appName))],
    };
  },
});
