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
  const progress = sessionMinutes / Math.max(1, limitMinutes);
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
  const [state, setState] = React.useState<EnforcementPreviewState>({
    bridgeReady: hasUsageEventsBridge(),
    isRefreshing: false,
    activeSession: null,
    warmSession: null,
    mergedSessions: [],
  });

  const refresh = React.useCallback(async () => {
    if (Platform.OS !== "android" || !usageAccess.granted) {
      setState((currentState) => ({
        ...currentState,
        bridgeReady: hasUsageEventsBridge(),
        activeSession: null,
        warmSession: null,
        mergedSessions: [],
      }));
      return;
    }

    if (!hasUsageEventsBridge() || !overview) {
      setState((currentState) => ({
        ...currentState,
        bridgeReady: hasUsageEventsBridge(),
      }));
      return;
    }

    setState((currentState) => ({
      ...currentState,
      bridgeReady: true,
      isRefreshing: true,
    }));

    try {
      const rawEvents = await getUsageEvents({ hours: 6, limit: 3000 });
      const recommendationLimits = new Map(
        (overview.recommendations ?? []).map((recommendation) => [
          recommendation.appPackage,
          recommendation.sessionLimitMinutes,
        ]),
      );

      const preview = buildPreviewFromEvents(
        rawEvents,
        new Set((overview.excludedApps ?? []).map((app) => app.appPackage)),
        sessionResetCutoffs,
        recommendationLimits,
        overview.defaultLimitMinutes,
        Date.now(),
      );

      setState({
        bridgeReady: true,
        isRefreshing: false,
        ...preview,
      });
    } catch {
      setState((currentState) => ({
        ...currentState,
        bridgeReady: hasUsageEventsBridge(),
        isRefreshing: false,
      }));
    }
  }, [overview, sessionResetCutoffs, usageAccess.granted]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    const intervalId = setInterval(() => {
      void refresh();
    }, 15000);

    return () => {
      clearInterval(intervalId);
    };
  }, [refresh]);

  React.useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void refresh();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refresh]);

  return state;
}
