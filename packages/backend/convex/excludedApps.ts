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

export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return [];
    }

    const user = await getUserByClerkId(ctx, identity.subject);
    if (user === null) {
      return [];
    }

    return await ctx.db
      .query("excludedApps")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const replaceForCurrentUser = mutation({
  args: {
    apps: v.array(
      v.object({
        appPackage: v.string(),
        appName: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await getCurrentIdentity(ctx);
    const user = await getUserByClerkId(ctx, identity.subject);
    if (user === null) {
      throw new Error("User record not found");
    }

    const existingApps = await ctx.db
      .query("excludedApps")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const existingApp of existingApps) {
      await ctx.db.delete(existingApp._id);
    }

    const dedupedApps = new Map<string, string>();
    for (const app of args.apps) {
      if (!dedupedApps.has(app.appPackage)) {
        dedupedApps.set(app.appPackage, app.appName);
      }
    }

    for (const [appPackage, appName] of dedupedApps.entries()) {
      await ctx.db.insert("excludedApps", {
        userId: user._id,
        appPackage,
        appName,
        createdAt: Date.now(),
      });
    }

    return await ctx.db
      .query("excludedApps")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});
