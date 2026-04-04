"use node";

import { internal } from "./_generated/api";
import { action } from "./_generated/server";

export const triggerExportForCurrentUser = action({
  args: {},
  handler: async (ctx): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Unauthorized");
    }

    const payload: any = await ctx.runQuery((internal as any).aiPipelinePayload.buildExportPayloadForClerkUser, {
      clerkId: identity.subject,
    });
    const requestedAt = Date.now();
    const user: any = await ctx.runQuery((internal as any).users.getByClerkIdInternal, {
      clerkId: identity.subject,
    });
    if (!user) {
      throw new Error("User record not found");
    }

    const endpoint =
      process.env.CUE_AWS_EXPORT_URL ??
      process.env.CUE_AI_EXPORT_URL ??
      process.env.AWS_EXPORT_URL ??
      null;

    if (!endpoint) {
      await ctx.runMutation((internal as any).aiOps.recordExportRun, {
        userId: user._id,
        endpoint: undefined,
        requestedAt,
        sent: false,
        reason: "missing_endpoint",
        status: undefined,
        sessionCount: payload.sessions.length,
        excludedCount: payload.excludedApps.length,
        recommendationCount: payload.currentRecommendations.length,
        payload,
        responsePreview: "No export endpoint configured.",
      });

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

    await ctx.runMutation((internal as any).aiOps.recordExportRun, {
      userId: user._id,
      endpoint,
      requestedAt,
      sent: response.ok,
      reason: response.ok ? "sent" : "upstream_error",
      status: response.status,
      sessionCount: payload.sessions.length,
      excludedCount: payload.excludedApps.length,
      recommendationCount: payload.currentRecommendations.length,
      payload,
      responsePreview: responseText.slice(0, 2000),
    });

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
