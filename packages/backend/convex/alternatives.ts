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
      .query("alternatives")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const replaceForCurrentUser = mutation({
  args: {
    alternatives: v.array(
      v.object({
        activity: v.string(),
        category: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await getCurrentIdentity(ctx);
    const user = await getUserByClerkId(ctx, identity.subject);
    if (user === null) {
      throw new Error("User record not found");
    }

    const existingAlternatives = await ctx.db
      .query("alternatives")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const existingAlternative of existingAlternatives) {
      await ctx.db.delete(existingAlternative._id);
    }

    const dedupedAlternatives = new Map<string, string>();
    for (const alternative of args.alternatives) {
      const normalizedActivity = alternative.activity.trim();
      if (!normalizedActivity) {
        continue;
      }

      const key = normalizedActivity.toLowerCase();
      if (!dedupedAlternatives.has(key)) {
        dedupedAlternatives.set(key, alternative.category);
      }
    }

    for (const [activity, category] of dedupedAlternatives.entries()) {
      await ctx.db.insert("alternatives", {
        userId: user._id,
        activity,
        category,
      });
    }

    return await ctx.db
      .query("alternatives")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});
