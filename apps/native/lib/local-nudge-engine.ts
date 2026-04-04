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
    const candidateSession = enforcementPreview.activeSession ?? enforcementPreview.warmSession;
    if (!overview || !candidateSession) {
      return;
    }

    const bucket = candidateSession.thresholdBucket === "safe" ? null : candidateSession.thresholdBucket;
    if (!bucket) {
      return;
    }

    const triggerKey = `${candidateSession.appPackage}:${candidateSession.startTime}:${bucket}`;
    if (triggeredKeysRef.current.has(triggerKey)) {
      return;
    }

    triggeredKeysRef.current.add(triggerKey);
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
      alternatives: alternativeOptions,
      alternative: chosenAlternative,
      cooldownMinutes: bucket === "approaching" ? 10 : 20,
    });
  }, [
    alternatives,
    enforcementPreview.activeSession,
    enforcementPreview.warmSession,
    overview,
    requestGeneratedNudge,
  ]);
}
