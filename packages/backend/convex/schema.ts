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
