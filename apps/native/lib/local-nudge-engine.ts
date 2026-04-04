import { api } from "@cue/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import React from "react";

import { useEnforcementPreview } from "@/lib/enforcement-preview";

function buildNudgeCopy(params: {
  appName: string;
  alternative?: string;
  nudgeStyle: "gentle" | "direct" | "motivational";
  bucket: "approaching" | "at_limit" | "exceeded";
  limitMinutes: number;
}) {
  const alternativeLine = params.alternative
    ? ` Try ${params.alternative.toLowerCase()} instead.`
    : "";

  if (params.bucket === "exceeded") {
    if (params.nudgeStyle === "direct") {
      return `You've gone past today's ${params.limitMinutes}-minute target for ${params.appName}. Close the loop now.${alternativeLine}`;
    }

    if (params.nudgeStyle === "motivational") {
      return `You already crossed the ${params.limitMinutes}-minute mark on ${params.appName}. A small reset right now still counts.${alternativeLine}`;
    }

    return `You've spent a little longer than planned on ${params.appName}. This is a good moment to step out.${alternativeLine}`;
  }

  if (params.bucket === "at_limit") {
    if (params.nudgeStyle === "direct") {
      return `${params.appName} just hit your ${params.limitMinutes}-minute limit. Time to switch.${alternativeLine}`;
    }

    if (params.nudgeStyle === "motivational") {
      return `You reached your goal line for ${params.appName}. Protect the streak and pivot now.${alternativeLine}`;
    }

    return `You're right at your limit for ${params.appName}. Want to stop here while it still feels easy?${alternativeLine}`;
  }

  if (params.nudgeStyle === "direct") {
    return `${params.appName} is getting close to the ${params.limitMinutes}-minute limit. Wrap it up soon.${alternativeLine}`;
  }

  if (params.nudgeStyle === "motivational") {
    return `You're nearing your limit on ${params.appName}. A quick switch now keeps the momentum on your side.${alternativeLine}`;
  }

  return `${params.appName} is getting close to today's limit. This might be a nice place to pause.${alternativeLine}`;
}

export function useLocalNudgeEngine() {
  const currentUser = useQuery(api.users.current);
  const alternatives = useQuery(api.alternatives.listForCurrentUser);
  const queueNudge = useMutation(api.nudges.queueForCurrentUser);
  const enforcementPreview = useEnforcementPreview();
  const triggeredKeysRef = React.useRef(new Set<string>());

  React.useEffect(() => {
    const activeSession = enforcementPreview.activeSession;
    if (!currentUser || !activeSession) {
      return;
    }

    let bucket: "approaching" | "at_limit" | "exceeded" | null = null;
    let nudgeType: "limit_warning" | "session_check" | "ai_limit" = "session_check";

    if (activeSession.isExceeded) {
      bucket = "exceeded";
      nudgeType = "ai_limit";
    } else if (activeSession.isAtLimit) {
      bucket = "at_limit";
      nudgeType = "limit_warning";
    } else if (activeSession.isApproachingLimit) {
      bucket = "approaching";
      nudgeType = "session_check";
    }

    if (!bucket) {
      return;
    }

    const triggerKey = `${activeSession.appPackage}:${activeSession.startTime}:${bucket}`;
    if (triggeredKeysRef.current.has(triggerKey)) {
      return;
    }

    triggeredKeysRef.current.add(triggerKey);
    const chosenAlternative = alternatives?.[0]?.activity;

    void queueNudge({
      triggerApp: activeSession.appPackage,
      type: nudgeType,
      message: buildNudgeCopy({
        appName: activeSession.appName,
        alternative: chosenAlternative,
        nudgeStyle: currentUser.nudgeStyle,
        bucket,
        limitMinutes: activeSession.limitMinutes,
      }),
      alternative: chosenAlternative,
      cooldownMinutes: bucket === "approaching" ? 10 : 20,
    });
  }, [
    alternatives,
    currentUser,
    enforcementPreview.activeSession,
    queueNudge,
  ]);
}
