import { httpRouter } from "convex/server";
import { z } from "zod";

import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { parseMetabolicResponse } from "./metabolicEngine";

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

const demoResponseSchema = z.object({
  code: z.string().min(1),
  answers: z.array(
    z.object({
      question: z.string().min(1),
      answer: z.string().min(1),
    }),
  ).min(1),
});

const http = httpRouter();

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return Response.json(body, {
    ...init,
    headers: {
      ...corsHeaders,
      ...(init?.headers ?? {}),
    },
  });
}

http.route({
  path: "/ai/recommendations",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret =
      process.env.CUE_AWS_METABOLIC_SECRET ??
      process.env.CUE_AWS_WEBHOOK_SECRET ??
      process.env.CUE_AI_WEBHOOK_SECRET ??
      process.env.AWS_WEBHOOK_SECRET ??
      null;

    if (secret) {
      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${secret}`) {
        return jsonResponse(
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
      return jsonResponse(
        {
          ok: false,
          error: "Invalid JSON body",
        },
        { status: 400 },
      );
    }

    const parsedPayload = webhookPayloadSchema.safeParse(body);
    const recommendationPayload = parsedPayload.success ? parsedPayload.data : null;
    const parsedMetabolicResponse =
      parseMetabolicResponse(body) ??
      parseMetabolicResponse((body as any)?.result) ??
      parseMetabolicResponse((body as any)?.data);

    if (!parsedPayload.success && !parsedMetabolicResponse) {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid recommendation payload",
          issues: parsedPayload.error.issues,
        },
        { status: 400 },
      );
    }

    let result;
    try {
      if (parsedMetabolicResponse) {
        result = await ctx.runMutation((internal as any).metabolicEngine.storeResultForClerkUser, {
          clerkId: parsedMetabolicResponse.user_id,
          lastSyncTime: new Date().toISOString(),
          response: parsedMetabolicResponse,
          effectiveDate: new Date().toISOString().slice(0, 10),
        });
      } else {
        result = await ctx.runMutation((internal as any).recommendations.storeForClerkUser, {
          clerkId: recommendationPayload!.userId,
          effectiveDate: recommendationPayload!.effectiveDate,
          recommendations: recommendationPayload!.recommendations,
        });
      }
    } catch (error) {
      await ctx.runMutation((internal as any).aiOps.recordWebhookEvent, {
        clerkId: parsedMetabolicResponse?.user_id ?? recommendationPayload!.userId,
        receivedAt: Date.now(),
        stored: false,
        effectiveDate: recommendationPayload?.effectiveDate,
        recommendationCount: parsedMetabolicResponse?.apps.length ?? recommendationPayload!.recommendations.length,
        error: error instanceof Error ? error.message : "Unable to store recommendations",
      });

      return jsonResponse(
        {
          ok: false,
          error: error instanceof Error ? error.message : "Unable to store recommendations",
        },
        { status: 400 },
      );
    }

    await ctx.runMutation((internal as any).aiOps.recordWebhookEvent, {
      clerkId: parsedMetabolicResponse?.user_id ?? recommendationPayload!.userId,
      receivedAt: Date.now(),
      stored: true,
      effectiveDate: recommendationPayload?.effectiveDate,
      recommendationCount: parsedMetabolicResponse?.apps.length ?? recommendationPayload!.recommendations.length,
      error: undefined,
    });

    return jsonResponse({
      ok: true,
      ...result,
    });
  }),
});

http.route({
  path: "/ai/recommendations",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

http.route({
  path: "/ai/metabolic-results",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret =
      process.env.CUE_AWS_METABOLIC_SECRET ??
      process.env.CUE_AWS_WEBHOOK_SECRET ??
      process.env.CUE_AI_WEBHOOK_SECRET ??
      process.env.AWS_WEBHOOK_SECRET ??
      null;

    if (secret) {
      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${secret}`) {
        return jsonResponse({ ok: false, error: "Unauthorized webhook request" }, { status: 401 });
      }
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const parsedMetabolicResponse =
      parseMetabolicResponse(body) ??
      parseMetabolicResponse((body as any)?.result) ??
      parseMetabolicResponse((body as any)?.data);

    if (!parsedMetabolicResponse) {
      return jsonResponse({ ok: false, error: "Invalid metabolic engine payload" }, { status: 400 });
    }

    try {
      const result = await ctx.runMutation((internal as any).metabolicEngine.storeResultForClerkUser, {
        clerkId: parsedMetabolicResponse.user_id,
        lastSyncTime: new Date().toISOString(),
        response: parsedMetabolicResponse,
        effectiveDate: new Date().toISOString().slice(0, 10),
      });

      await ctx.runMutation((internal as any).aiOps.recordWebhookEvent, {
        clerkId: parsedMetabolicResponse.user_id,
        receivedAt: Date.now(),
        stored: true,
        effectiveDate: new Date().toISOString().slice(0, 10),
        recommendationCount: parsedMetabolicResponse.apps.length,
        error: undefined,
      });

      return jsonResponse({ ok: true, ...result });
    } catch (error) {
      await ctx.runMutation((internal as any).aiOps.recordWebhookEvent, {
        clerkId: parsedMetabolicResponse.user_id,
        receivedAt: Date.now(),
        stored: false,
        effectiveDate: new Date().toISOString().slice(0, 10),
        recommendationCount: parsedMetabolicResponse.apps.length,
        error: error instanceof Error ? error.message : "Unable to store metabolic results",
      });

      return jsonResponse(
        { ok: false, error: error instanceof Error ? error.message : "Unable to store metabolic results" },
        { status: 400 },
      );
    }
  }),
});

http.route({
  path: "/ai/metabolic-results",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

http.route({
  path: "/demo/session/create",
  method: "POST",
  handler: httpAction(async (ctx) => {
    const result = await ctx.runMutation((internal as any).demoCompanion.createSession, {});

    return jsonResponse({
      ok: true,
      ...result,
    });
  }),
});

http.route({
  path: "/demo/session/create",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

http.route({
  path: "/demo/session",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code")?.trim().toUpperCase();

    if (!code) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing demo session code",
        },
        { status: 400 },
      );
    }

    const session = await ctx.runQuery((internal as any).demoCompanion.getSessionByCode, {
      code,
    });

    if (!session) {
      return jsonResponse(
        {
          ok: false,
          error: "Demo session not found",
        },
        { status: 404 },
      );
    }

    return jsonResponse({
      ok: true,
      session,
    });
  }),
});

http.route({
  path: "/demo/session",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

http.route({
  path: "/demo/respond",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid JSON body",
        },
        { status: 400 },
      );
    }

    const parsedPayload = demoResponseSchema.safeParse(body);
    if (!parsedPayload.success) {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid demo response payload",
          issues: parsedPayload.error.issues,
        },
        { status: 400 },
      );
    }

    try {
      const result = await ctx.runMutation((internal as any).demoCompanion.submitResponse, {
        code: parsedPayload.data.code,
        answers: parsedPayload.data.answers,
      });

      return jsonResponse({
        ok: true,
        ...result,
      });
    } catch (error) {
      return jsonResponse(
        {
          ok: false,
          error: error instanceof Error ? error.message : "Unable to submit demo response",
        },
        { status: 404 },
      );
    }
  }),
});

http.route({
  path: "/demo/respond",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

export default http;
