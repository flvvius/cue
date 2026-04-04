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

export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }

    return await getUserByClerkId(ctx, identity.subject);
  },
});

export const ensureCurrent = mutation({
  args: {
    name: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await getCurrentIdentity(ctx);
    const existingUser = await getUserByClerkId(ctx, identity.subject);

    if (existingUser !== null) {
      const patch: { name?: string; timezone?: string } = {};

      if (args.name && args.name !== existingUser.name) {
        patch.name = args.name;
      }

      if (args.timezone && args.timezone !== existingUser.timezone) {
        patch.timezone = args.timezone;
      }

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existingUser._id, patch);
      }

      return (await ctx.db.get(existingUser._id)) ?? existingUser;
    }

    const userId = await ctx.db.insert("users", {
      clerkId: identity.subject,
      name: args.name ?? identity.name ?? "Cue user",
      onboardingComplete: false,
      nudgeStyle: "gentle",
      defaultSessionLimitMinutes: 30,
      timezone: args.timezone ?? "UTC",
      createdAt: Date.now(),
    });

    return await ctx.db.get(userId);
  },
});

export const completeOnboarding = mutation({
  args: {
    defaultSessionLimitMinutes: v.number(),
    nudgeStyle: v.union(
      v.literal("gentle"),
      v.literal("direct"),
      v.literal("motivational"),
    ),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await getCurrentIdentity(ctx);
    const existingUser = await getUserByClerkId(ctx, identity.subject);

    if (existingUser === null) {
      const userId = await ctx.db.insert("users", {
        clerkId: identity.subject,
        name: identity.name ?? "Cue user",
        onboardingComplete: true,
        nudgeStyle: args.nudgeStyle,
        defaultSessionLimitMinutes: args.defaultSessionLimitMinutes,
        timezone: args.timezone ?? "UTC",
        createdAt: Date.now(),
      });

      return await ctx.db.get(userId);
    }

    await ctx.db.patch(existingUser._id, {
      onboardingComplete: true,
      nudgeStyle: args.nudgeStyle,
      defaultSessionLimitMinutes: args.defaultSessionLimitMinutes,
      timezone: args.timezone ?? existingUser.timezone,
    });

    return await ctx.db.get(existingUser._id);
  },
});
