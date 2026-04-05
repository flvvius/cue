import { api } from "@cue/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import React from "react";
import { AppState, Platform } from "react-native";

import { useBreakState } from "@/contexts/break-state-context";
import { resolveBreakDurationMinutes } from "@/lib/break-duration";
import { type ThresholdBucket } from "@/lib/enforcement-thresholds";
import { useEnforcementPreview } from "@/lib/enforcement-preview";
import { getBlockingSnapshot } from "@/lib/usage-access";

const BLOCKING_SNAPSHOT_HANDOFF_WINDOW_MS = 4_000;
const suppressedTriggerKeys = new Set<string>();

function buildTriggerKey(
  appPackage: string,
  sessionStartTime: number,
  bucket: Exclude<ThresholdBucket, "safe">,
) {
  return `${appPackage}:${sessionStartTime}:${bucket}`;
}

export function suppressLocalNudgeForSession(params: {
  appPackage: string;
  sessionStartTime?: number | null;
  thresholdBucket?: ThresholdBucket | null;
}) {
  if (
    params.sessionStartTime == null ||
    params.thresholdBucket == null ||
    params.thresholdBucket === "safe"
  ) {
    return;
  }

  suppressedTriggerKeys.add(
    buildTriggerKey(params.appPackage, params.sessionStartTime, params.thresholdBucket),
  );
}

function resolveNudgeType(bucket: Exclude<ThresholdBucket, "safe">) {
  if (bucket === "exceeded") {
    return "ai_limit" as const;
  }

  if (bucket === "at_limit") {
    return "limit_warning" as const;
  }

  return "session_check" as const;
}

export function useLocalNudgeEngine() {
  const alternatives = useQuery(api.alternatives.listForCurrentUser);
  const overview = useQuery(api.dashboard.overviewForCurrentUser);
  const activeNudge = useQuery(api.nudges.getActiveForCurrentUser);
  const requestGeneratedNudge = useMutation((api as any).nudgeRequests.requestForCurrentUser);
  const enforcementPreview = useEnforcementPreview();
  const { activeBreak, sessionResetCutoffs } = useBreakState();
  const lastAttemptAtRef = React.useRef(new Map<string, number>());
  const [blockingSnapshot, setBlockingSnapshot] = React.useState(() => getBlockingSnapshot());

  React.useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    const timeoutIds = new Set<ReturnType<typeof setTimeout>>();
    const refreshSnapshot = () => {
      setBlockingSnapshot(getBlockingSnapshot());
    };

    refreshSnapshot();

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        suppressedTriggerKeys.clear();
        return;
      }

      refreshSnapshot();
      timeoutIds.add(setTimeout(refreshSnapshot, 500));
      timeoutIds.add(setTimeout(refreshSnapshot, 1500));
    });

    return () => {
      subscription.remove();
      timeoutIds.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
    };
  }, []);

  React.useEffect(() => {
    if (activeBreak) {
      return;
    }

    const previewCandidate = enforcementPreview.activeSession ?? enforcementPreview.warmSession;
    const snapshotIsFresh = blockingSnapshot != null &&
      Date.now() - blockingSnapshot.blockedAt <= BLOCKING_SNAPSHOT_HANDOFF_WINDOW_MS;
    const snapshotWasReset = blockingSnapshot != null &&
      (sessionResetCutoffs[blockingSnapshot.appPackage] ?? 0) >= blockingSnapshot.sessionStartTime;
    const snapshotCandidate =
      !previewCandidate &&
      blockingSnapshot?.reason === "limit" &&
      snapshotIsFresh &&
      !snapshotWasReset
        ? {
            appPackage: blockingSnapshot.appPackage,
            appName: blockingSnapshot.appName,
            startTime: blockingSnapshot.sessionStartTime,
            limitMinutes: blockingSnapshot.limitMinutes,
            thresholdBucket: blockingSnapshot.thresholdBucket,
          }
        : null;
    const candidateSession = snapshotCandidate ?? previewCandidate;

    if (!overview || !candidateSession) {
      return;
    }

    const bucket = candidateSession.thresholdBucket === "safe" ? null : candidateSession.thresholdBucket;
    if (!bucket) {
      return;
    }

    const triggerKey = buildTriggerKey(candidateSession.appPackage, candidateSession.startTime, bucket);
    if (suppressedTriggerKeys.has(triggerKey)) {
      return;
    }
    const matchingPendingNudge = activeNudge &&
      activeNudge.triggerApp === candidateSession.appPackage &&
      activeNudge.thresholdBucket === bucket &&
      activeNudge.sessionStartTime === candidateSession.startTime;

    if (matchingPendingNudge) {
      return;
    }

    const retryWindowMs = bucket === "approaching" ? 10 * 60 * 1000 : 2 * 1000;
    const lastAttemptAt = lastAttemptAtRef.current.get(triggerKey) ?? 0;
    if (Date.now() - lastAttemptAt < retryWindowMs) {
      return;
    }

    lastAttemptAtRef.current.set(triggerKey, Date.now());
    const alternativeOptions = (alternatives ?? []).slice(0, 5).map((item) => item.activity);
    const chosenAlternative = alternativeOptions[0];
    const recommendation = overview.recommendations.find(
      (item: any) => item.appPackage === candidateSession.appPackage,
    );
    const breakDurationMinutes = resolveBreakDurationMinutes(recommendation);

    void requestGeneratedNudge({
      triggerApp: candidateSession.appPackage,
      appName: candidateSession.appName,
      type: resolveNudgeType(bucket),
      thresholdBucket: bucket,
      limitMinutes: candidateSession.limitMinutes,
      breakDurationMinutes,
      sessionStartTime: candidateSession.startTime,
      alternatives: alternativeOptions,
      alternative: chosenAlternative,
      cooldownMinutes: bucket === "approaching" ? 10 : 0,
    });
  }, [
    activeBreak,
    activeNudge,
    alternatives,
    blockingSnapshot,
    enforcementPreview.activeSession,
    enforcementPreview.warmSession,
    overview,
    requestGeneratedNudge,
    sessionResetCutoffs,
  ]);
}
