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
