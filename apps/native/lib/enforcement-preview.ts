import { api } from "@cue/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import React from "react";
import { AppState, Platform } from "react-native";

import { useBreakState } from "@/contexts/break-state-context";
import { getUsageEvents, hasUsageEventsBridge, type RawUsageEvent, useAndroidUsageAccess } from "@/lib/usage-access";
import { resolveThresholdBucket, type ThresholdBucket } from "@/lib/enforcement-thresholds";
import {
  computeSessionsFromUsageEvents,
  mergeSessionsForEnforcement,
  type ComputedUsageSession,
} from "@/lib/usage-session-utils";

const MERGE_WINDOW_MS = 2 * 60 * 1000;

type EnforcedSession = ComputedUsageSession & {
  limitMinutes: number;
  progressPercent: number;
  thresholdBucket: ThresholdBucket;
  isApproachingLimit: boolean;
  isAtLimit: boolean;
  isExceeded: boolean;
};

type EnforcementPreviewState = {
  bridgeReady: boolean;
  isRefreshing: boolean;
  activeSession: EnforcedSession | null;
  warmSession: (EnforcedSession & { graceRemainingMs: number }) | null;
  mergedSessions: EnforcedSession[];
};

function addLimitState(
  session: ComputedUsageSession,
  recommendationLimits: Map<string, number>,
  defaultLimitMinutes: number,
): EnforcedSession {
  const limitMinutes = recommendationLimits.get(session.appPackage) ?? defaultLimitMinutes;
  const sessionMinutes = session.durationMs / 60000;
  const progress = sessionMinutes / Math.max(0.05, limitMinutes);
  const thresholdBucket = resolveThresholdBucket(progress);

  return {
    ...session,
    limitMinutes,
    progressPercent: Math.min(100, Math.round(progress * 100)),
    thresholdBucket,
    isApproachingLimit: thresholdBucket === "approaching" || thresholdBucket === "at_limit" || thresholdBucket === "exceeded",
    isAtLimit: thresholdBucket === "at_limit" || thresholdBucket === "exceeded",
    isExceeded: thresholdBucket === "exceeded",
  };
}

function buildPreviewFromEvents(
  rawEvents: RawUsageEvent[],
  excludedPackages: Set<string>,
  sessionResetCutoffs: Record<string, number>,
  recommendationLimits: Map<string, number>,
  defaultLimitMinutes: number,
  now: number,
): Pick<EnforcementPreviewState, "activeSession" | "warmSession" | "mergedSessions"> {
  const monitoredEvents = rawEvents.filter((event) => {
    if (excludedPackages.has(event.appPackage)) {
      return false;
    }

    const resetCutoff = sessionResetCutoffs[event.appPackage];
    if (resetCutoff && event.timestamp < resetCutoff) {
      return false;
    }

    return true;
  });
  const computedSessions = computeSessionsFromUsageEvents(monitoredEvents);
  const mergedSessions = mergeSessionsForEnforcement(computedSessions, MERGE_WINDOW_MS)
    .map((session) => addLimitState(session, recommendationLimits, defaultLimitMinutes));

  const latestEvent = [...monitoredEvents].sort((left, right) => right.timestamp - left.timestamp)[0];
  if (!latestEvent) {
    return {
      activeSession: null,
      warmSession: null,
      mergedSessions,
    };
  }

  const lastMergedForApp = mergedSessions.find((session) => session.appPackage === latestEvent.appPackage) ?? null;

  if (latestEvent.eventType === "foreground") {
    const resumedWithinMergeWindow = lastMergedForApp &&
      latestEvent.timestamp - lastMergedForApp.endTime <= MERGE_WINDOW_MS;
    const sessionStartTime = resumedWithinMergeWindow ? lastMergedForApp.startTime : latestEvent.timestamp;
    const activeDurationMs = now - sessionStartTime;

    return {
      activeSession: addLimitState(
        {
          appPackage: latestEvent.appPackage,
          appName: latestEvent.appName,
          startTime: sessionStartTime,
          endTime: now,
          durationMs: activeDurationMs,
        },
        recommendationLimits,
        defaultLimitMinutes,
      ),
      warmSession: null,
      mergedSessions,
    };
  }

  const sinceBackgroundMs = now - latestEvent.timestamp;
  if (lastMergedForApp && sinceBackgroundMs <= MERGE_WINDOW_MS) {
    return {
      activeSession: null,
      warmSession: {
        ...lastMergedForApp,
        graceRemainingMs: MERGE_WINDOW_MS - sinceBackgroundMs,
      },
      mergedSessions,
    };
  }

  return {
    activeSession: null,
    warmSession: null,
    mergedSessions,
  };
}

export function useEnforcementPreview() {
  const overview = useQuery(api.dashboard.overviewForCurrentUser);
  const usageAccess = useAndroidUsageAccess();
  const { sessionResetCutoffs } = useBreakState();
  const [rawEvents, setRawEvents] = React.useState<RawUsageEvent[]>([]);
  const [bridgeReady, setBridgeReady] = React.useState(hasUsageEventsBridge());
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());
  const [appState, setAppState] = React.useState(AppState.currentState);

  const recommendationLimits = React.useMemo(
    () =>
      new Map<string, number>(
        (overview?.recommendations ?? []).map((recommendation: any) => [
          recommendation.appPackage,
          recommendation.sessionLimitMinutes,
        ]),
      ),
    [overview?.recommendations],
  );

  const derivedPreview = React.useMemo(() => {
    if (Platform.OS !== "android" || !usageAccess.granted || !overview || !bridgeReady) {
      return {
        activeSession: null,
        warmSession: null,
        mergedSessions: [],
      };
    }

    return buildPreviewFromEvents(
      rawEvents,
      new Set((overview.excludedApps ?? []).map((app: any) => app.appPackage)),
      sessionResetCutoffs,
      recommendationLimits,
      overview.defaultLimitMinutes,
      now,
    );
  }, [
    bridgeReady,
    now,
    overview,
    rawEvents,
    recommendationLimits,
    sessionResetCutoffs,
    usageAccess.granted,
  ]);

  const state = React.useMemo<EnforcementPreviewState>(() => ({
    bridgeReady,
    isRefreshing,
    ...derivedPreview,
  }), [
    bridgeReady,
    derivedPreview,
    isRefreshing,
  ]);

  const refresh = React.useCallback(async () => {
    const nextBridgeReady = hasUsageEventsBridge();
    setBridgeReady(nextBridgeReady);

    if (Platform.OS !== "android" || !usageAccess.granted) {
      setRawEvents([]);
      return;
    }

    if (!nextBridgeReady || !overview) {
      return;
    }

    setIsRefreshing(true);

    try {
      const nextRawEvents = await getUsageEvents({ hours: 6, limit: 3000 });
      setRawEvents(nextRawEvents);
      setNow(Date.now());
    } catch {
      setBridgeReady(hasUsageEventsBridge());
    } finally {
      setIsRefreshing(false);
    }
  }, [overview, usageAccess.granted]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    const pollIntervalId = setInterval(() => {
      if (appState === "active") {
        void refresh();
      }
    }, 15000);

    return () => {
      clearInterval(pollIntervalId);
    };
  }, [appState, refresh]);

  React.useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    const tickIntervalId = setInterval(() => {
      if (appState === "active") {
        setNow(Date.now());
      }
    }, 1000);

    return () => {
      clearInterval(tickIntervalId);
    };
  }, [appState]);

  React.useEffect(() => {
    const timeoutIds = new Set<ReturnType<typeof setTimeout>>();
    const subscription = AppState.addEventListener("change", (nextState) => {
      setAppState(nextState);

      if (nextState === "active") {
        setNow(Date.now());
        void refresh();
        timeoutIds.add(setTimeout(() => {
          setNow(Date.now());
          void refresh();
        }, 500));
        timeoutIds.add(setTimeout(() => {
          setNow(Date.now());
          void refresh();
        }, 1500));
      }
    });

    return () => {
      subscription.remove();
      timeoutIds.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
    };
  }, [refresh]);

  return state;
}
