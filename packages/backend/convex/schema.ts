import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    onboardingComplete: v.boolean(),
    nudgeStyle: v.union(
      v.literal("gentle"),
      v.literal("direct"),
      v.literal("motivational"),
    ),
    defaultSessionLimitMinutes: v.number(),
    timezone: v.string(),
    createdAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  excludedApps: defineTable({
    userId: v.id("users"),
    appPackage: v.string(),
    appName: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  alternatives: defineTable({
    userId: v.id("users"),
    activity: v.string(),
    category: v.string(),
  }).index("by_user", ["userId"]),

  usageSessions: defineTable({
    userId: v.id("users"),
    appPackage: v.string(),
    appName: v.string(),
    startTime: v.number(),
    endTime: v.number(),
    durationMs: v.number(),
  })
    .index("by_user_time", ["userId", "startTime"])
    .index("by_user_app_time", ["userId", "appPackage", "startTime"]),

  breaks: defineTable({
    userId: v.id("users"),
    appPackage: v.string(),
    appName: v.string(),
    alternative: v.optional(v.string()),
    startedAt: v.number(),
    plannedEndsAt: v.number(),
    finishedAt: v.optional(v.number()),
    endedEarly: v.optional(v.boolean()),
    createdAt: v.number(),
  })
    .index("by_user_start", ["userId", "startedAt"])
    .index("by_user_app_start", ["userId", "appPackage", "startedAt"]),

  socialEvents: defineTable({
    actorUserId: v.id("users"),
    actorName: v.string(),
    type: v.union(
      v.literal("break_ended_early"),
    ),
    appPackage: v.string(),
    appName: v.string(),
    createdAt: v.number(),
  })
    .index("by_time", ["createdAt"])
    .index("by_actor_time", ["actorUserId", "createdAt"]),

  patterns: defineTable({
    userId: v.id("users"),
    appPackage: v.string(),
    appName: v.string(),
    type: v.union(
      v.literal("time_trigger"),
      v.literal("chain_trigger"),
      v.literal("boredom_loop"),
      v.literal("over_limit"),
    ),
    description: v.string(),
    confidence: v.number(),
    metadata: v.any(),
    lastSeen: v.number(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  aiRecommendations: defineTable({
    userId: v.id("users"),
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
    effectiveDate: v.string(),
    createdAt: v.number(),
    })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "effectiveDate"]),

  metabolicEngineStates: defineTable({
    userId: v.id("users"),
    lastSyncTime: v.string(),
    globalModifier: v.number(),
    appWeights: v.any(),
    appPoints: v.any(),
    lastRawResponse: v.optional(v.any()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  nudges: defineTable({
    userId: v.id("users"),
    recommendationId: v.optional(v.id("aiRecommendations")),
    patternId: v.optional(v.id("patterns")),
    triggerApp: v.string(),
    type: v.union(
      v.literal("limit_warning"),
      v.literal("pattern_break"),
      v.literal("session_check"),
      v.literal("ai_limit"),
      v.literal("break_time"),
    ),
    message: v.string(),
    alternative: v.optional(v.string()),
    generationSource: v.optional(
      v.union(
        v.literal("openai"),
        v.literal("custom_endpoint"),
        v.literal("fallback"),
      ),
    ),
    generationModel: v.optional(v.string()),
    generationFailureReason: v.optional(v.string()),
    thresholdBucket: v.optional(
      v.union(
        v.literal("approaching"),
        v.literal("at_limit"),
        v.literal("exceeded"),
      ),
    ),
    breakDurationMinutes: v.optional(v.number()),
    sessionStartTime: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("shown"),
      v.literal("accepted"),
      v.literal("dismissed"),
    ),
    createdAt: v.number(),
    respondedAt: v.optional(v.number()),
  })
    .index("by_user_status", ["userId", "status"])
    .index("by_user_time", ["userId", "createdAt"]),

  aiExportRuns: defineTable({
    userId: v.id("users"),
    endpoint: v.optional(v.string()),
    requestedAt: v.number(),
    sent: v.boolean(),
    reason: v.string(),
    status: v.optional(v.number()),
    sessionCount: v.number(),
    excludedCount: v.number(),
    recommendationCount: v.number(),
    payload: v.any(),
    responsePreview: v.optional(v.string()),
  }).index("by_user_time", ["userId", "requestedAt"]),

  aiWebhookEvents: defineTable({
    clerkId: v.string(),
    receivedAt: v.number(),
    stored: v.boolean(),
    effectiveDate: v.optional(v.string()),
    recommendationCount: v.number(),
    error: v.optional(v.string()),
  }).index("by_clerk_time", ["clerkId", "receivedAt"]),

  demoSessions: defineTable({
    code: v.string(),
    active: v.boolean(),
    createdAt: v.number(),
  }).index("by_code", ["code"]),

  demoResponses: defineTable({
    sessionId: v.id("demoSessions"),
    answers: v.array(
      v.object({
        question: v.string(),
        answer: v.string(),
      }),
    ),
    aiRecommendation: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_session", ["sessionId"]),
});
