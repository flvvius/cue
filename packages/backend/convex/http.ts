import { httpRouter } from "convex/server";
import { z } from "zod";

import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";

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

const webhookPayloadSchema = z.object({
  userId: z.string().min(1),
  effectiveDate: z.string().optional(),
  recommendations: z.array(recommendationSchema),
});

const http = httpRouter();

http.route({
  path: "/ai/recommendations",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret =
      process.env.CUE_AWS_WEBHOOK_SECRET ??
      process.env.CUE_AI_WEBHOOK_SECRET ??
      process.env.AWS_WEBHOOK_SECRET ??
      null;

    if (secret) {
      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${secret}`) {
        return Response.json(
          {
            ok: false,
            error: "Unauthorized webhook request",
          },
          { status: 401 },
        );
      }
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        {
          ok: false,
          error: "Invalid JSON body",
        },
        { status: 400 },
      );
    }

    const parsedPayload = webhookPayloadSchema.safeParse(body);
    if (!parsedPayload.success) {
      return Response.json(
        {
          ok: false,
          error: "Invalid recommendation payload",
          issues: parsedPayload.error.issues,
        },
        { status: 400 },
      );
    }

    const result = await ctx.runAction((api as any).aiPipeline.storeRecommendationsFromWebhook, {
      userId: parsedPayload.data.userId,
      effectiveDate: parsedPayload.data.effectiveDate,
      recommendations: parsedPayload.data.recommendations,
    });

    return Response.json({
      ok: true,
      ...result,
    });
  }),
});

export default http;
