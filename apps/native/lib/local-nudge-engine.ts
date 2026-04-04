import { api } from "@cue/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import React from "react";

import { resolveBreakDurationMinutes } from "@/lib/break-duration";
import { type ThresholdBucket } from "@/lib/enforcement-thresholds";
import { useEnforcementPreview } from "@/lib/enforcement-preview";

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
  const requestGeneratedNudge = useMutation((api as any).nudgeRequests.requestForCurrentUser);
  const enforcementPreview = useEnforcementPreview();
  const triggeredKeysRef = React.useRef(new Set<string>());

  React.useEffect(() => {
    const activeSession = enforcementPreview.activeSession;
    if (!overview || !activeSession) {
      return;
    }

    const bucket = activeSession.thresholdBucket === "safe" ? null : activeSession.thresholdBucket;
    if (!bucket) {
      return;
    }

    const triggerKey = `${activeSession.appPackage}:${activeSession.startTime}:${bucket}`;
    if (triggeredKeysRef.current.has(triggerKey)) {
      return;
    }

    triggeredKeysRef.current.add(triggerKey);
    const chosenAlternative = alternatives?.[0]?.activity;
    const recommendation = overview.recommendations.find(
      (item: any) => item.appPackage === activeSession.appPackage,
    );
    const breakDurationMinutes = resolveBreakDurationMinutes(recommendation);

    void requestGeneratedNudge({
      triggerApp: activeSession.appPackage,
      appName: activeSession.appName,
      type: resolveNudgeType(bucket),
      thresholdBucket: bucket,
      limitMinutes: activeSession.limitMinutes,
      breakDurationMinutes,
      alternative: chosenAlternative,
      cooldownMinutes: bucket === "approaching" ? 10 : 20,
    });
  }, [
    alternatives,
    enforcementPreview.activeSession,
    overview,
    requestGeneratedNudge,
  ]);
}
