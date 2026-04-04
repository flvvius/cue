import { api } from "@cue/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import React from "react";

import { resolveBreakDurationMinutes } from "@/lib/break-duration";
import { type ThresholdBucket } from "@/lib/enforcement-thresholds";
import { useEnforcementPreview } from "@/lib/enforcement-preview";

function buildNudgeCopy(params: {
  appName: string;
  alternative?: string;
  nudgeStyle: "gentle" | "direct" | "motivational";
  bucket: "approaching" | "at_limit" | "exceeded";
  limitMinutes: number;
  breakDurationMinutes: number;
}) {
  const alternativeLine = params.alternative
    ? ` Try ${params.alternative.toLowerCase()} instead.`
    : "";
  const breakLine = ` Take a ${params.breakDurationMinutes}-minute reset.`;

  if (params.bucket === "exceeded") {
    if (params.nudgeStyle === "direct") {
      return `You've gone past today's ${params.limitMinutes}-minute target for ${params.appName}. Close the loop now.${breakLine}${alternativeLine}`;
    }

    if (params.nudgeStyle === "motivational") {
      return `You already crossed the ${params.limitMinutes}-minute mark on ${params.appName}. A small reset right now still counts.${breakLine}${alternativeLine}`;
    }

    return `You've spent a little longer than planned on ${params.appName}. This is a good moment to step out.${breakLine}${alternativeLine}`;
  }

  if (params.bucket === "at_limit") {
    if (params.nudgeStyle === "direct") {
      return `${params.appName} just hit your ${params.limitMinutes}-minute limit. Time to switch.${breakLine}${alternativeLine}`;
    }

    if (params.nudgeStyle === "motivational") {
      return `You reached your goal line for ${params.appName}. Protect the streak and pivot now.${breakLine}${alternativeLine}`;
    }

    return `You're right at your limit for ${params.appName}. Want to stop here while it still feels easy?${breakLine}${alternativeLine}`;
  }

  if (params.nudgeStyle === "direct") {
    return `${params.appName} is getting close to the ${params.limitMinutes}-minute limit. Wrap it up soon.${breakLine}${alternativeLine}`;
  }

  if (params.nudgeStyle === "motivational") {
    return `You're nearing your limit on ${params.appName}. A quick switch now keeps the momentum on your side.${breakLine}${alternativeLine}`;
  }

  return `${params.appName} is getting close to today's limit. This might be a nice place to pause.${breakLine}${alternativeLine}`;
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
  const currentUser = useQuery(api.users.current);
  const alternatives = useQuery(api.alternatives.listForCurrentUser);
  const overview = useQuery(api.dashboard.overviewForCurrentUser);
  const queueNudge = useMutation(api.nudges.queueForCurrentUser);
  const enforcementPreview = useEnforcementPreview();
  const triggeredKeysRef = React.useRef(new Set<string>());

  React.useEffect(() => {
    const activeSession = enforcementPreview.activeSession;
    if (!currentUser || !overview || !activeSession) {
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
      (item) => item.appPackage === activeSession.appPackage,
    );
    const breakDurationMinutes = resolveBreakDurationMinutes(recommendation);

    void queueNudge({
      triggerApp: activeSession.appPackage,
      type: resolveNudgeType(bucket),
      message: buildNudgeCopy({
        appName: activeSession.appName,
        alternative: chosenAlternative,
        nudgeStyle: currentUser.nudgeStyle,
        bucket,
        limitMinutes: activeSession.limitMinutes,
        breakDurationMinutes,
      }),
      alternative: chosenAlternative,
      breakDurationMinutes,
      thresholdBucket: bucket,
      cooldownMinutes: bucket === "approaching" ? 10 : 20,
    });
  }, [
    alternatives,
    currentUser,
    enforcementPreview.activeSession,
    overview,
    queueNudge,
  ]);
}
