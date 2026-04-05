"use node";

import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

type NudgeBucket = "approaching" | "at_limit" | "exceeded";
type NudgeStyle = "gentle" | "direct" | "motivational";
type NudgeType = "limit_warning" | "pattern_break" | "session_check" | "ai_limit" | "break_time";

type GeneratedNudgeResult = {
  message: string;
  alternative?: string;
  generationSource: "openai" | "custom_endpoint" | "fallback";
  generationModel?: string;
  generationFailureReason?: string;
};

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

function parseStructuredNudgePayload(rawValue: unknown): { message?: string; alternative?: string | null } | null {
  if (!rawValue) {
    return null;
  }

  if (typeof rawValue === "string") {
    try {
      return parseStructuredNudgePayload(JSON.parse(rawValue));
    } catch {
      return null;
    }
  }

  if (typeof rawValue !== "object") {
    return null;
  }

  const candidate = rawValue as {
    message?: unknown;
    alternative?: unknown;
  };

  if (typeof candidate.message !== "string") {
    return null;
  }

  return {
    message: candidate.message,
    alternative: typeof candidate.alternative === "string" || candidate.alternative === null
      ? candidate.alternative
      : undefined,
  };
}

function extractJsonObjectSubstring(rawText: string) {
  const startIndex = rawText.indexOf("{");
  const endIndex = rawText.lastIndexOf("}");

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return null;
  }

  return rawText.slice(startIndex, endIndex + 1);
}

function normalizeFreeformMessage(rawText: string) {
  return rawText
    .replace(/\s+/g, " ")
    .replace(/^["'`\s]+|["'`\s]+$/g, "")
    .trim();
}

function extractTextResponse(payload: any): string | null {
  if (typeof payload?.output_text === "string" && payload.output_text.trim().length > 0) {
    return payload.output_text.trim();
  }

  const outputItems = Array.isArray(payload?.output) ? payload.output : [];
  const textParts: string[] = [];

  for (const outputItem of outputItems) {
    const contentItems = Array.isArray(outputItem?.content) ? outputItem.content : [];
    for (const contentItem of contentItems) {
      if (typeof contentItem?.text === "string" && contentItem.text.trim().length > 0) {
        textParts.push(contentItem.text.trim());
      }
    }
  }

  const merged = textParts.join(" ").trim();
  return merged.length > 0 ? merged : null;
}

function extractStructuredResponse(payload: any) {
  const directParsed = parseStructuredNudgePayload(payload?.output_parsed);
  if (directParsed) {
    return directParsed;
  }

  const directText = parseStructuredNudgePayload(payload?.output_text);
  if (directText) {
    return directText;
  }

  if (typeof payload?.output_text === "string") {
    const jsonSubstring = extractJsonObjectSubstring(payload.output_text);
    if (jsonSubstring) {
      const parsedSubstring = parseStructuredNudgePayload(jsonSubstring);
      if (parsedSubstring) {
        return parsedSubstring;
      }
    }
  }

  const outputItems = Array.isArray(payload?.output) ? payload.output : [];
  for (const outputItem of outputItems) {
    const contentItems = Array.isArray(outputItem?.content) ? outputItem.content : [];
    for (const contentItem of contentItems) {
      const parsedContent =
        parseStructuredNudgePayload(contentItem?.parsed) ??
        parseStructuredNudgePayload(contentItem?.json) ??
        parseStructuredNudgePayload(contentItem?.text);
      if (parsedContent) {
        return parsedContent;
      }

      if (typeof contentItem?.text === "string") {
        const jsonSubstring = extractJsonObjectSubstring(contentItem.text);
        if (jsonSubstring) {
          const parsedSubstring = parseStructuredNudgePayload(jsonSubstring);
          if (parsedSubstring) {
            return parsedSubstring;
          }
        }
      }
    }
  }

  return null;
}

function buildFallbackResult(
  params: {
    appName: string;
    alternatives?: string[];
    alternative?: string;
    nudgeStyle: NudgeStyle;
    bucket: NudgeBucket;
    limitMinutes: number;
    breakDurationMinutes: number;
  },
  generationFailureReason?: string,
): GeneratedNudgeResult {
  return {
    message: buildFallbackMessage(params),
    alternative: params.alternative ?? params.alternatives?.[0],
    generationSource: "fallback",
    generationFailureReason,
  };
}

function buildStrictModelFailureResult(generationFailureReason?: string): GeneratedNudgeResult {
  return {
    message: "AI generation failed for this test nudge. Check the debug reason below and try again.",
    generationSource: "fallback",
    generationFailureReason,
  };
}

async function generateMessage(params: {
  appName: string;
  alternatives?: string[];
  alternative?: string;
  nudgeStyle: NudgeStyle;
  bucket: NudgeBucket;
  limitMinutes: number;
  breakDurationMinutes: number;
  requireModelSuccess?: boolean;
}): Promise<GeneratedNudgeResult> {
  const openAiApiKey =
    process.env.OPENAI_API_KEY ??
    process.env.CUE_OPENAI_API_KEY ??
    null;
  const openAiModel =
    process.env.OPENAI_MODEL ??
    process.env.CUE_OPENAI_MODEL ??
    "gpt-5-mini";
  const variationSeed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

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
            "You write short, specific screen-time intervention nudges for a mobile app. Respond with valid JSON only, no markdown, no prose outside the JSON object. The required format is exactly {\"message\":\"...\",\"alternative\":\"...\"} where alternative may also be null. Keep the message under 140 characters, warm but firm, never mention being an AI, and avoid repeating generic stock phrases from previous screen-time apps. Do not sound like a default template. Do not start with phrases like 'Time's up', 'You're at your limit', 'Pause now', 'Take a reset', 'Wrap it up', or 'Want to stop here'. Make each message feel freshly phrased.",
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
                    `Variation seed: ${variationSeed}\n` +
                    `Alternative options: ${(params.alternatives && params.alternatives.length > 0) ? params.alternatives.join(", ") : params.alternative ?? "none"}\n` +
                    "Return exactly one JSON object in this format: {\"message\":\"short nudge here\",\"alternative\":\"specific alternative here\"}. If no concrete alternative fits, use null for alternative. Prefer a concrete option from the provided alternatives. Avoid generic suggestions like 'go outside' or 'take a walk' unless one of those was explicitly provided. Make the phrasing feel distinct for this variation seed instead of reusing a stock template. The message should sound personal and app-specific, not like a generic productivity slogan. Use one crisp sentence only. If possible, hint at the user's chosen alternative without repeating it mechanically.",
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI Responses API failed with ${response.status}`);
      }

      const payload = await response.json();
      const parsed = extractStructuredResponse(payload);

      if (!parsed?.message || parsed.message.trim().length === 0) {
        const freeformText = extractTextResponse(payload);
        if (!freeformText) {
          throw new Error("OpenAI returned an empty nudge message");
        }

        return {
          message: normalizeFreeformMessage(freeformText),
          alternative: params.alternative ?? params.alternatives?.[0],
          generationSource: "openai",
          generationModel: openAiModel,
        };
      }

      return {
        message: parsed.message.trim(),
        alternative: parsed.alternative?.trim() || params.alternative || params.alternatives?.[0],
        generationSource: "openai",
        generationModel: openAiModel,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "openai_unknown_error";
      return params.requireModelSuccess
        ? buildStrictModelFailureResult(reason)
        : buildFallbackResult(params, reason);
    }
  }

  const endpoint =
    process.env.CUE_NUDGE_MODEL_URL ??
    process.env.CUE_AI_NUDGE_URL ??
    process.env.AWS_NUDGE_URL ??
    null;

  if (!endpoint) {
    return params.requireModelSuccess
      ? buildStrictModelFailureResult("no_model_endpoint_configured")
      : buildFallbackResult(params, "no_model_endpoint_configured");
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
        generationSource: "custom_endpoint",
        generationModel: endpoint,
      };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "custom_endpoint_unknown_error";
    return params.requireModelSuccess
      ? buildStrictModelFailureResult(reason)
      : buildFallbackResult(params, reason);
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
    requireModelSuccess: v.optional(v.boolean()),
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
      requireModelSuccess: args.requireModelSuccess,
    });

    return await ctx.runMutation((internal as any).nudges.queueGeneratedForUser, {
      userId: args.userId,
      triggerApp: args.triggerApp,
      type: args.type,
      message: generated.message,
      alternative: generated.alternative,
      generationSource: generated.generationSource,
      generationModel: generated.generationModel,
      generationFailureReason: generated.generationFailureReason,
      thresholdBucket: args.thresholdBucket,
      breakDurationMinutes: args.breakDurationMinutes,
      sessionStartTime: args.sessionStartTime,
      cooldownMinutes: args.cooldownMinutes,
    });
  },
});
