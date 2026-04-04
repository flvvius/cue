import { v } from "convex/values";

import { internalMutation, internalQuery } from "./_generated/server";

function generateDemoCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return code;
}

export const getSessionByCode = internalQuery({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedCode = args.code.trim().toUpperCase();
    const session = await ctx.db
      .query("demoSessions")
      .withIndex("by_code", (q) => q.eq("code", normalizedCode))
      .unique();

    if (!session || !session.active) {
      return null;
    }

    return {
      _id: session._id,
      code: session.code,
      active: session.active,
      createdAt: session.createdAt,
    };
  },
});

export const createSession = internalMutation({
  args: {},
  handler: async (ctx) => {
    let code = generateDemoCode();
    let existingSession = await ctx.db
      .query("demoSessions")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();

    while (existingSession) {
      code = generateDemoCode();
      existingSession = await ctx.db
        .query("demoSessions")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique();
    }

    const sessionId = await ctx.db.insert("demoSessions", {
      code,
      active: true,
      createdAt: Date.now(),
    });

    return {
      sessionId,
      code,
    };
  },
});

export const submitResponse = internalMutation({
  args: {
    code: v.string(),
    answers: v.array(
      v.object({
        question: v.string(),
        answer: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const normalizedCode = args.code.trim().toUpperCase();
    const session = await ctx.db
      .query("demoSessions")
      .withIndex("by_code", (q) => q.eq("code", normalizedCode))
      .unique();

    if (!session || !session.active) {
      throw new Error("Demo session not found");
    }

    const responseId = await ctx.db.insert("demoResponses", {
      sessionId: session._id,
      answers: args.answers,
      createdAt: Date.now(),
    });

    return {
      responseId,
      sessionId: session._id,
      code: session.code,
    };
  },
});
