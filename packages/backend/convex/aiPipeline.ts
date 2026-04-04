"use node";

import { v } from "convex/values";
import { z } from "zod";

import { api, internal } from "./_generated/api";
import { action, internalQuery } from "./_generated/server";

const breakScheduleWindowSchema = z.object({
  from: z.string(),
  to: z.string(),
  breakAfterMinutes: z.number().finite(),
});

const recommendationSchema = z.object({
  appPackage: z.string().min(1),
  appName: z.string().min(1),
  sessionLimitMinutes: z.number().finite().positive(),
  breakSchedule: z.array(breakScheduleWindowSchema),
});

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

export const triggerExportForCurrentUser = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Unauthorized");
    }

    const payload = await ctx.runQuery((internal as any).aiPipeline.buildExportPayloadForClerkUser, {
      clerkId: identity.subject,
    });

    const endpoint =
      process.env.CUE_AWS_EXPORT_URL ??
      process.env.CUE_AI_EXPORT_URL ??
      process.env.AWS_EXPORT_URL ??
      null;

    if (!endpoint) {
      return {
        sent: false,
        reason: "missing_endpoint",
        payload,
      };
    }

    const secret =
      process.env.CUE_AWS_WEBHOOK_SECRET ??
      process.env.CUE_AI_WEBHOOK_SECRET ??
      process.env.AWS_WEBHOOK_SECRET ??
      null;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(secret ? { authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    return {
      sent: response.ok,
      reason: response.ok ? "sent" : "upstream_error",
      status: response.status,
      endpoint,
      payload,
      responseText: responseText.slice(0, 2000),
    };
  },
});

export const storeRecommendationsFromWebhook = action({
  args: {
    userId: v.string(),
    recommendations: v.array(
      v.object({
        appPackage: v.string(),
        appName: v.string(),
        sessionLimitMinutes: v.number(),
        breakSchedule: v.array(
          v.object({
            from: v.string(),
            to: v.string(),
            breakAfterMinutes: v.number(),
          }),
        ),
      }),
    ),
    effectiveDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const parsedRecommendations = z.array(recommendationSchema).parse(args.recommendations);

    return await ctx.runMutation(internal.recommendations.storeForClerkUser, {
      clerkId: args.userId,
      recommendations: parsedRecommendations,
      effectiveDate: args.effectiveDate,
    });
  },
});
