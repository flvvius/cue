"use node";

import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { parseMetabolicResponse } from "./metabolicEngine";

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
      process.env.CUE_AWS_METABOLIC_URL ??
      process.env.CUE_METABOLIC_ENGINE_URL ??
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
        excludedCount: payload.metadata.excludedApps.length,
        recommendationCount: payload.metadata.currentRecommendations.length,
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
      process.env.CUE_AWS_METABOLIC_SECRET ??
      process.env.CUE_AWS_WEBHOOK_SECRET ??
      process.env.CUE_AI_WEBHOOK_SECRET ??
      process.env.AWS_WEBHOOK_SECRET ??
      null;

    let response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(secret ? { authorization: `Bearer ${secret}` } : {}),
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Network error while contacting AWS endpoint";
      await ctx.runMutation((internal as any).aiOps.recordExportRun, {
        userId: user._id,
        endpoint,
        requestedAt,
        sent: false,
        reason: "network_error",
        status: undefined,
        sessionCount: payload.sessions.length,
        excludedCount: payload.metadata.excludedApps.length,
        recommendationCount: payload.metadata.currentRecommendations.length,
        payload,
        responsePreview: message,
      });

      return {
        sent: false,
        applied: false,
        appliedRecommendations: 0,
        reason: "network_error",
        endpoint,
        payload,
        responseText: message,
      };
    }

    const responseText = await response.text();
    let responseJson: unknown = null;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      responseJson = null;
    }

    let appliedRecommendations = 0;
    let applied = false;
    let reason = response.ok ? "sent" : "upstream_error";
    let preservedExisting = false;

    if (response.ok) {
      const directMetabolicResponse =
        parseMetabolicResponse(responseJson) ??
        parseMetabolicResponse((responseJson as any)?.result) ??
        parseMetabolicResponse((responseJson as any)?.data);

      if (directMetabolicResponse) {
        const appliedResult: any = await ctx.runMutation((internal as any).metabolicEngine.storeResultForClerkUser, {
          clerkId: identity.subject,
          lastSyncTime: payload.exported_at,
          response: directMetabolicResponse,
          effectiveDate: payload.exported_at.slice(0, 10),
        });
        appliedRecommendations = appliedResult.stored ?? 0;
        preservedExisting = Boolean(appliedResult.preservedExisting);
        applied = !preservedExisting && appliedRecommendations > 0;
        reason =
          applied
            ? "sent_and_applied"
            : preservedExisting
              ? "sent_preserved_existing"
              : "sent";
      }
    }

    await ctx.runMutation((internal as any).aiOps.recordExportRun, {
      userId: user._id,
      endpoint,
      requestedAt,
      sent: response.ok,
      reason,
      status: response.status,
      sessionCount: payload.sessions.length,
      excludedCount: payload.metadata.excludedApps.length,
      recommendationCount: payload.metadata.currentRecommendations.length,
      payload,
      responsePreview: responseText.slice(0, 2000),
    });

    return {
      sent: response.ok,
      applied,
      appliedRecommendations,
      preservedExisting,
      reason,
      status: response.status,
      endpoint,
      payload,
      responseText: responseText.slice(0, 2000),
    };
  },
});
