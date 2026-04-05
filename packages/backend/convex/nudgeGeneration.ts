"use node";

import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

type NudgeBucket = "approaching" | "at_limit" | "exceeded";
type NudgeStyle = "gentle" | "direct" | "motivational";
type NudgeType = "limit_warning" | "pattern_break" | "session_check" | "ai_limit" | "break_time";

function buildFallbackMessage(params: {
  appName: string;
  alternatives?: string[];
  alternative?: string;
  nudgeStyle: NudgeStyle;
  bucket: NudgeBucket;
  limitMinutes: number;
  breakDurationMinutes: number;
}) {
  const fallbackAlternative = params.alternative ?? params.alternatives?.[0];
  const alternativeLine = fallbackAlternative
    ? ` Try ${fallbackAlternative.toLowerCase()} instead.`
    : "";
  const breakLine = ` Take a ${params.breakDurationMinutes}-minute reset.`;

  if (params.bucket === "exceeded") {
    if (params.nudgeStyle === "direct") {
      return `You've gone past today's ${params.limitMinutes}-minute target for ${params.appName}. Close the loop now.${breakLine}${alternativeLine}`;
    }

    if (params.nudgeStyle === "motivational") {
      return `You already crossed the ${params.limitMinutes}-minute mark on ${params.appName}. A small reset right now still counts.${breakLine}${alternativeLine}`;
    }

    return `You've spent a little longer than planned on ${params.appName}. This is a good moment to step out.${breakLine}${alternativeLine}`;
  }

  if (params.bucket === "at_limit") {
    if (params.nudgeStyle === "direct") {
      return `${params.appName} just hit your ${params.limitMinutes}-minute limit. Time to switch.${breakLine}${alternativeLine}`;
    }

    if (params.nudgeStyle === "motivational") {
      return `You reached your goal line for ${params.appName}. Protect the streak and pivot now.${breakLine}${alternativeLine}`;
    }

    return `You're right at your limit for ${params.appName}. Want to stop here while it still feels easy?${breakLine}${alternativeLine}`;
  }

  if (params.nudgeStyle === "direct") {
    return `${params.appName} is getting close to the ${params.limitMinutes}-minute limit. Wrap it up soon.${breakLine}${alternativeLine}`;
  }

  if (params.nudgeStyle === "motivational") {
    return `You're nearing your limit on ${params.appName}. A quick switch now keeps the momentum on your side.${breakLine}${alternativeLine}`;
  }

  return `${params.appName} is getting close to today's limit. This might be a nice place to pause.${breakLine}${alternativeLine}`;
}

async function generateMessage(params: {
  appName: string;
  alternatives?: string[];
  alternative?: string;
  nudgeStyle: NudgeStyle;
  bucket: NudgeBucket;
  limitMinutes: number;
  breakDurationMinutes: number;
}): Promise<{ message: string; alternative?: string }> {
  const openAiApiKey =
    process.env.OPENAI_API_KEY ??
    process.env.CUE_OPENAI_API_KEY ??
    null;
  const openAiModel =
    process.env.OPENAI_MODEL ??
    process.env.CUE_OPENAI_MODEL ??
    "gpt-5-mini";

  if (openAiApiKey) {
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${openAiApiKey}`,
        },
        body: JSON.stringify({
          model: openAiModel,
          max_output_tokens: 140,
          text: {
            format: {
              type: "json_schema",
              name: "cue_nudge_response",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  message: { type: "string" },
                  alternative: {
                    anyOf: [
                      { type: "string" },
                      { type: "null" },
                    ],
                  },
                },
                required: ["message", "alternative"],
              },
            },
          },
          instructions:
            "You write short, specific screen-time intervention nudges for a mobile app. Respond with valid JSON only. Keep the message under 140 characters, warm but firm, and never mention being an AI.",
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text:
                    `App: ${params.appName}\n` +
                    `Threshold: ${params.bucket}\n` +
                    `Session limit: ${params.limitMinutes} minutes\n` +
                    `Break duration: ${params.breakDurationMinutes} minutes\n` +
                    `Preferred nudge style: ${params.nudgeStyle}\n` +
                    `Alternative options: ${(params.alternatives && params.alternatives.length > 0) ? params.alternatives.join(", ") : params.alternative ?? "none"}\n` +
                    "Return one nudge message and one alternative field. Prefer a concrete option from the provided alternatives. Avoid generic suggestions like 'go outside' or 'take a walk' unless one of those was explicitly provided.",
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI Responses API failed with ${response.status}`);
      }

      const payload = await response.json() as {
        output_text?: string;
      };

      const parsed = JSON.parse(payload.output_text ?? "{}") as {
        message?: string;
        alternative?: string | null;
      };

      if (!parsed.message || parsed.message.trim().length === 0) {
        throw new Error("OpenAI returned an empty nudge message");
      }

      return {
        message: parsed.message.trim(),
        alternative: parsed.alternative?.trim() || params.alternative || params.alternatives?.[0],
      };
    } catch {
      return {
        message: buildFallbackMessage(params),
        alternative: params.alternative ?? params.alternatives?.[0],
      };
    }
  }

  const endpoint =
    process.env.CUE_NUDGE_MODEL_URL ??
    process.env.CUE_AI_NUDGE_URL ??
    process.env.AWS_NUDGE_URL ??
    null;

  if (!endpoint) {
    return {
      message: buildFallbackMessage(params),
      alternative: params.alternative ?? params.alternatives?.[0],
    };
  }

  const secret =
    process.env.CUE_NUDGE_MODEL_SECRET ??
    process.env.CUE_AI_NUDGE_SECRET ??
    process.env.AWS_NUDGE_SECRET ??
    null;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(secret ? { authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({
        appName: params.appName,
        alternatives: params.alternatives,
        alternative: params.alternative,
        nudgeStyle: params.nudgeStyle,
        thresholdBucket: params.bucket,
        limitMinutes: params.limitMinutes,
        breakDurationMinutes: params.breakDurationMinutes,
      }),
    });

    if (!response.ok) {
      throw new Error(`Upstream nudge model failed with ${response.status}`);
    }

    const payload = await response.json() as {
      message?: string;
      alternative?: string;
    };

    if (!payload.message || payload.message.trim().length === 0) {
      throw new Error("Upstream nudge model returned an empty message");
    }

    return {
      message: payload.message.trim(),
      alternative: payload.alternative?.trim() || params.alternative || params.alternatives?.[0],
    };
  } catch {
    return {
      message: buildFallbackMessage(params),
      alternative: params.alternative ?? params.alternatives?.[0],
    };
  }
}

export const generateForUser: any = internalAction({
  args: {
    userId: v.id("users"),
    triggerApp: v.string(),
    appName: v.string(),
    type: v.union(
      v.literal("limit_warning"),
      v.literal("pattern_break"),
      v.literal("session_check"),
      v.literal("ai_limit"),
      v.literal("break_time"),
    ),
    thresholdBucket: v.union(
      v.literal("approaching"),
      v.literal("at_limit"),
      v.literal("exceeded"),
    ),
    limitMinutes: v.number(),
    breakDurationMinutes: v.number(),
    sessionStartTime: v.optional(v.number()),
    alternatives: v.optional(v.array(v.string())),
    alternative: v.optional(v.string()),
    cooldownMinutes: v.optional(v.number()),
    nudgeStyle: v.union(
      v.literal("gentle"),
      v.literal("direct"),
      v.literal("motivational"),
    ),
  },
  handler: async (ctx, args): Promise<any> => {
    const generated = await generateMessage({
      appName: args.appName,
      alternatives: args.alternatives,
      alternative: args.alternative,
      nudgeStyle: args.nudgeStyle,
      bucket: args.thresholdBucket,
      limitMinutes: args.limitMinutes,
      breakDurationMinutes: args.breakDurationMinutes,
    });

    return await ctx.runMutation((internal as any).nudges.queueGeneratedForUser, {
      userId: args.userId,
      triggerApp: args.triggerApp,
      type: args.type,
      message: generated.message,
      alternative: generated.alternative,
      thresholdBucket: args.thresholdBucket,
      breakDurationMinutes: args.breakDurationMinutes,
      sessionStartTime: args.sessionStartTime,
      cooldownMinutes: args.cooldownMinutes,
    });
  },
});
