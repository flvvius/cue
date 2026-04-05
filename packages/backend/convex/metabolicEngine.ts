import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { getUserByClerkId, replaceRecommendationsForUser } from "./recommendations";

export const DEFAULT_ENGINE_GLOBAL_MODIFIER = 1;
export const DEFAULT_ENGINE_W0 = 1000;
export const DEFAULT_ENGINE_W1 = -0.5;
export const DEFAULT_ENGINE_POINTS = 1000;

export type MetabolicEngineState = {
  lastSyncTime: string;
  globalModifier: number;
  appWeights: Record<string, [number, number]>;
  appPoints: Record<string, number>;
  lastRawResponse?: unknown;
};

export type MetabolicExportPayload = {
  user_id: string;
  minutes_today: number;
  minutes_yesterday: number;
  checkpoint: {
    last_sync_time: string;
    app_weights: Record<string, [number, number]>;
    app_points: Record<string, number>;
  };
  sessions: Array<{
    package_name: string;
    start_time: string;
    end_time: string;
    danger_level: number;
    alertness: number;
    points_at_start: number;
    points_at_end: number;
  }>;
};

export type MetabolicResponse = {
  user_id: string;
  global_modifier: number;
  apps: Array<{
    package_name: string;
    point_base: number;
    w0: number;
    w1: number;
  }>;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundToTwoDecimals(value: number) {
  return Math.round(value * 100) / 100;
}

function roundToFiveMinutes(value: number) {
  return Math.round(value / 5) * 5;
}

function resolveDisplayAppName(appName: string | null | undefined, appPackage: string) {
  if (typeof appName === "string" && appName.trim().length > 0 && appName.trim().toLowerCase() !== "android") {
    return appName.trim();
  }

  const parts = appPackage
    .split(".")
    .filter(Boolean)
    .filter((part) => !["com", "android", "app", "apps", "mobile", "client"].includes(part.toLowerCase()));
  const candidate = parts[parts.length - 1] ?? appPackage;
  return candidate
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getLocalDateParts(timestamp: number, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(timestamp))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function getTodayAndYesterdayKeys(now: number, timeZone: string) {
  const today = getLocalDateParts(now, timeZone).dateKey;
  const yesterday = getLocalDateParts(now - 24 * 60 * 60 * 1000, timeZone).dateKey;
  return { today, yesterday };
}

function deriveDangerLevel(hour: number, durationMinutes: number) {
  let dangerLevel = 1;

  if (hour < 5) {
    dangerLevel = 5;
  } else if (hour < 8) {
    dangerLevel = 3;
  } else if (hour < 18) {
    dangerLevel = 1;
  } else if (hour < 22) {
    dangerLevel = 2;
  } else {
    dangerLevel = 4;
  }

  if (durationMinutes >= 45) {
    dangerLevel += 1;
  }
  if (durationMinutes >= 120) {
    dangerLevel += 1;
  }

  return clamp(dangerLevel, 1, 5);
}

function deriveAlertness(hour: number, durationMinutes: number) {
  let alertness = 0.8;

  if (hour < 5) {
    alertness = 0.1;
  } else if (hour < 8) {
    alertness = 0.4;
  } else if (hour < 18) {
    alertness = 0.8;
  } else if (hour < 22) {
    alertness = 0.55;
  } else {
    alertness = 0.2;
  }

  if (durationMinutes >= 45) {
    alertness -= 0.1;
  }
  if (durationMinutes >= 120) {
    alertness -= 0.15;
  }

  return roundToTwoDecimals(clamp(alertness, 0.1, 0.9));
}

function derivePointDrain(params: {
  pointsAtStart: number;
  durationMinutes: number;
  dangerLevel: number;
  alertness: number;
}) {
  const rawDrain = params.durationMinutes * (params.dangerLevel + (1 - params.alertness)) * 1.6;
  const cappedDrain = Math.min(rawDrain, Math.max(40, params.pointsAtStart * 0.9));
  return roundToTwoDecimals(clamp(cappedDrain, 5, params.pointsAtStart));
}

export function getDefaultMetabolicEngineState(now: number): MetabolicEngineState {
  return {
    lastSyncTime: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
    globalModifier: DEFAULT_ENGINE_GLOBAL_MODIFIER,
    appWeights: {},
    appPoints: {},
  };
}

export function normalizeMetabolicEngineState(rawState: any, now: number): MetabolicEngineState {
  if (!rawState) {
    return getDefaultMetabolicEngineState(now);
  }

  return {
    lastSyncTime:
      typeof rawState.lastSyncTime === "string" && !Number.isNaN(Date.parse(rawState.lastSyncTime))
        ? rawState.lastSyncTime
        : new Date(now - 24 * 60 * 60 * 1000).toISOString(),
    globalModifier:
      typeof rawState.globalModifier === "number" && Number.isFinite(rawState.globalModifier)
        ? rawState.globalModifier
        : DEFAULT_ENGINE_GLOBAL_MODIFIER,
    appWeights:
      rawState.appWeights && typeof rawState.appWeights === "object"
        ? rawState.appWeights
        : {},
    appPoints:
      rawState.appPoints && typeof rawState.appPoints === "object"
        ? rawState.appPoints
        : {},
    lastRawResponse: rawState.lastRawResponse,
  };
}

export function buildMetabolicPayload(params: {
  clerkId: string;
  timeZone: string;
  sessions: Array<{
    appPackage: string;
    appName: string;
    startTime: number;
    endTime: number;
    durationMs: number;
  }>;
  state: MetabolicEngineState;
  now: number;
}): MetabolicExportPayload {
  const { today, yesterday } = getTodayAndYesterdayKeys(params.now, params.timeZone);
  const lastSyncMs = Date.parse(params.state.lastSyncTime);

  const sessions = params.sessions
    .filter((session) => session.endTime > lastSyncMs)
    .sort((left, right) => left.startTime - right.startTime);

  const pointsByPackage: Record<string, number> = { ...params.state.appPoints };
  const weightsByPackage: Record<string, [number, number]> = { ...params.state.appWeights };

  let minutesToday = 0;
  let minutesYesterday = 0;

  for (const session of params.sessions) {
    const dateKey = getLocalDateParts(session.startTime, params.timeZone).dateKey;
    const durationMinutes = session.durationMs / 60000;
    if (dateKey === today) {
      minutesToday += durationMinutes;
    }
    if (dateKey === yesterday) {
      minutesYesterday += durationMinutes;
    }
  }

  const exportedSessions = sessions.map((session) => {
    const { hour } = getLocalDateParts(session.startTime, params.timeZone);
    const durationMinutes = session.durationMs / 60000;
    const dangerLevel = deriveDangerLevel(hour, durationMinutes);
    const alertness = deriveAlertness(hour, durationMinutes);
    const pointsAtStart = roundToTwoDecimals(pointsByPackage[session.appPackage] ?? DEFAULT_ENGINE_POINTS);
    const pointDrain = derivePointDrain({
      pointsAtStart,
      durationMinutes,
      dangerLevel,
      alertness,
    });
    const pointsAtEnd = roundToTwoDecimals(clamp(pointsAtStart - pointDrain, 0, DEFAULT_ENGINE_POINTS));

    pointsByPackage[session.appPackage] = pointsAtEnd;
    if (!weightsByPackage[session.appPackage]) {
      weightsByPackage[session.appPackage] = [DEFAULT_ENGINE_W0, DEFAULT_ENGINE_W1];
    }

    return {
      package_name: session.appPackage,
      start_time: new Date(session.startTime).toISOString(),
      end_time: new Date(session.endTime).toISOString(),
      danger_level: dangerLevel,
      alertness,
      points_at_start: pointsAtStart,
      points_at_end: pointsAtEnd,
    };
  });

  return {
    user_id: params.clerkId,
    minutes_today: roundToTwoDecimals(minutesToday),
    minutes_yesterday: roundToTwoDecimals(minutesYesterday),
    checkpoint: {
      last_sync_time: params.state.lastSyncTime,
      app_weights: weightsByPackage,
      app_points: pointsByPackage,
    },
    sessions: exportedSessions,
  };
}

export function parseMetabolicResponse(rawValue: unknown): MetabolicResponse | null {
  if (!rawValue || typeof rawValue !== "object") {
    return null;
  }

  const candidate = rawValue as {
    user_id?: unknown;
    global_modifier?: unknown;
    apps?: unknown;
  };

  if (typeof candidate.user_id !== "string" || typeof candidate.global_modifier !== "number") {
    return null;
  }

  if (!Array.isArray(candidate.apps)) {
    return null;
  }

  const apps = candidate.apps
    .map((app) => {
      if (!app || typeof app !== "object") {
        return null;
      }

      const typedApp = app as {
        package_name?: unknown;
        point_base?: unknown;
        w0?: unknown;
        w1?: unknown;
      };

      if (
        typeof typedApp.package_name !== "string" ||
        typeof typedApp.point_base !== "number" ||
        typeof typedApp.w0 !== "number" ||
        typeof typedApp.w1 !== "number"
      ) {
        return null;
      }

      return {
        package_name: typedApp.package_name,
        point_base: typedApp.point_base,
        w0: typedApp.w0,
        w1: typedApp.w1,
      };
    })
    .filter((app): app is NonNullable<typeof app> => app !== null);

  return {
    user_id: candidate.user_id,
    global_modifier: candidate.global_modifier,
    apps,
  };
}

export function buildRecommendationsFromMetabolicResponse(params: {
  response: MetabolicResponse;
  defaultSessionLimitMinutes: number;
  appNamesByPackage: Map<string, string>;
}) {
  return params.response.apps.map((app) => {
    const baseFactor = clamp(app.point_base / 1000, 0.2, 1.2);
    const slopeFactor = clamp(1 + app.w1 / 5, 0.2, 1);
    const interceptFactor = clamp(app.w0 / 1000, 0.5, 1.2);
    const globalFactor = clamp(params.response.global_modifier, 0.4, 1.2);
    const combinedFactor = clamp(baseFactor * slopeFactor * interceptFactor * globalFactor, 0.15, 1.25);

    const rawLimit = params.defaultSessionLimitMinutes * combinedFactor;
    const sessionLimitMinutes = clamp(roundToFiveMinutes(rawLimit), 5, params.defaultSessionLimitMinutes);
    const severity = clamp(1 - combinedFactor, 0, 1);
    const baseBreak = clamp(Math.round(5 + severity * 7), 5, 12);

    return {
      appPackage: app.package_name,
      appName: resolveDisplayAppName(params.appNamesByPackage.get(app.package_name), app.package_name),
      sessionLimitMinutes,
      breakSchedule: [
        { from: "06:00", to: "12:00", breakAfterMinutes: clamp(baseBreak - 1, 5, 15) },
        { from: "12:00", to: "18:00", breakAfterMinutes: clamp(baseBreak, 5, 15) },
        { from: "18:00", to: "23:59", breakAfterMinutes: clamp(baseBreak + 2, 5, 15) },
        { from: "00:00", to: "06:00", breakAfterMinutes: clamp(baseBreak + 1, 5, 15) },
      ],
    };
  });
}

export const storeResultForClerkUser = internalMutation({
  args: {
    clerkId: v.string(),
    lastSyncTime: v.string(),
    response: v.any(),
    effectiveDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getUserByClerkId(ctx, args.clerkId);
    if (user === null) {
      throw new Error("User record not found");
    }

    const parsedResponse = parseMetabolicResponse(args.response);
    if (!parsedResponse) {
      throw new Error("Invalid metabolic engine response");
    }

    if (parsedResponse.apps.length === 0) {
      return {
        stored: 0,
        effectiveDate: args.effectiveDate ?? new Date().toISOString().slice(0, 10),
        globalModifier: parsedResponse.global_modifier,
        preservedExisting: true,
        reason: "empty_result",
      };
    }

    const existingState = await ctx.db
      .query("metabolicEngineStates")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    const appNamesByPackage = new Map<string, string>();
    const [existingRecommendations, usageSessions] = await Promise.all([
      ctx.db.query("aiRecommendations").withIndex("by_user", (q) => q.eq("userId", user._id)).collect(),
      ctx.db.query("usageSessions").withIndex("by_user_time", (q) => q.eq("userId", user._id)).collect(),
    ]);

    for (const recommendation of existingRecommendations) {
      appNamesByPackage.set(recommendation.appPackage, recommendation.appName);
    }
    for (const session of usageSessions) {
      appNamesByPackage.set(session.appPackage, session.appName);
    }

    const recommendations = buildRecommendationsFromMetabolicResponse({
      response: parsedResponse,
      defaultSessionLimitMinutes: user.defaultSessionLimitMinutes,
      appNamesByPackage,
    });

    if (recommendations.length === 0) {
      return {
        stored: 0,
        effectiveDate: args.effectiveDate ?? new Date().toISOString().slice(0, 10),
        globalModifier: parsedResponse.global_modifier,
        preservedExisting: true,
        reason: "no_recommendations",
      };
    }

    const appWeights = Object.fromEntries(
      parsedResponse.apps.map((app) => [app.package_name, [app.w0, app.w1] as [number, number]]),
    );
    const appPoints = Object.fromEntries(
      parsedResponse.apps.map((app) => [app.package_name, app.point_base]),
    );

    if (existingState) {
      await ctx.db.patch(existingState._id, {
        lastSyncTime: args.lastSyncTime,
        globalModifier: parsedResponse.global_modifier,
        appWeights,
        appPoints,
        lastRawResponse: args.response,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("metabolicEngineStates", {
        userId: user._id,
        lastSyncTime: args.lastSyncTime,
        globalModifier: parsedResponse.global_modifier,
        appWeights,
        appPoints,
        lastRawResponse: args.response,
        updatedAt: Date.now(),
      });
    }

    const effectiveDate = args.effectiveDate ?? new Date().toISOString().slice(0, 10);
    await replaceRecommendationsForUser({
      ctx,
      userId: user._id,
      recommendations,
      effectiveDate,
    });

    return {
      stored: recommendations.length,
      effectiveDate,
      globalModifier: parsedResponse.global_modifier,
      preservedExisting: false,
      reason: "applied",
    };
  },
});
