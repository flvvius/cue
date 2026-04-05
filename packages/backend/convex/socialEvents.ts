import { query } from "./_generated/server";

async function getCurrentIdentity(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    return null;
  }
  return identity;
}

async function getUserByClerkId(ctx: any, clerkId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", clerkId))
    .unique();
}

export const recentForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await getCurrentIdentity(ctx);
    if (identity === null) {
      return { events: [] };
    }

    const currentUser = await getUserByClerkId(ctx, identity.subject);
    if (currentUser === null) {
      return { events: [] };
    }

    const recentEvents = await ctx.db
      .query("socialEvents")
      .withIndex("by_time")
      .order("desc")
      .take(20);

    return {
      events: recentEvents
        .filter((event) => event.actorUserId !== currentUser._id)
        .map((event) => ({
          _id: event._id,
          actorName: event.actorName,
          type: event.type,
          appPackage: event.appPackage,
          appName: event.appName,
          createdAt: event.createdAt,
        })),
    };
  },
});
