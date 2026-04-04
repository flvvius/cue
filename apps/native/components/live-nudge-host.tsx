import { api } from "@cue/backend/convex/_generated/api";
import { useAuth } from "@clerk/expo";
import { useMutation, useQuery } from "convex/react";
import { useRouter, useSegments } from "expo-router";
import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NudgeCard } from "@/components/nudge-card";
import { resolveBreakDurationMinutes } from "@/lib/break-duration";
import { useLocalNudgeEngine } from "@/lib/local-nudge-engine";

export function LiveNudgeHost() {
  const { isLoaded, isSignedIn } = useAuth();
  const currentUser = useQuery(api.users.current);
  const overview = useQuery(api.dashboard.overviewForCurrentUser);
  const activeNudge = useQuery(api.nudges.getActiveForCurrentUser);
  const respondToNudge = useMutation(api.nudges.respondToCurrentUser);
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [handledNudgeId, setHandledNudgeId] = React.useState<string | null>(null);

  useLocalNudgeEngine();

  React.useEffect(() => {
    if (!activeNudge) {
      setHandledNudgeId(null);
      return;
    }

    if (activeNudge._id !== handledNudgeId) {
      setHandledNudgeId(null);
    }
  }, [activeNudge, handledNudgeId]);

  const topLevel = segments[0];
  const shouldHide =
    !isLoaded ||
    !isSignedIn ||
    currentUser === undefined ||
    currentUser === null ||
    !currentUser.onboardingComplete ||
    topLevel === "(auth)" ||
    topLevel === "(onboarding)" ||
    topLevel === "sso-callback" ||
    topLevel === "break-timer";

  const handleRespond = React.useCallback(
    async (status: "accepted" | "dismissed") => {
      if (!activeNudge || isSubmitting) {
        return;
      }

      setIsSubmitting(true);
      setHandledNudgeId(activeNudge._id);
      try {
        await respondToNudge({
          nudgeId: activeNudge._id,
          status,
        });

        if (status === "accepted") {
          const recommendation = overview?.recommendations.find(
            (item) => item.appPackage === activeNudge.triggerApp,
          );
          const appName = activeNudge.triggerApp === "debug.manual"
            ? "your current app"
            : recommendation?.appName ??
              overview?.monitoredApps.find((item) => item.appPackage === activeNudge.triggerApp)?.appName ??
              activeNudge.triggerApp;
          const breakDurationMinutes =
            activeNudge.breakDurationMinutes ??
            resolveBreakDurationMinutes(recommendation);

          router.push({
            pathname: "/break-timer",
            params: {
              appName,
              alternative: activeNudge.alternative ?? undefined,
              durationMinutes: String(breakDurationMinutes),
              endsAt: String(Date.now() + breakDurationMinutes * 60 * 1000),
            },
          });
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [activeNudge, isSubmitting, overview, respondToNudge, router],
  );

  if (shouldHide || !activeNudge || handledNudgeId === activeNudge._id) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-4"
      style={{ bottom: Math.max(insets.bottom, 16) }}
    >
      <NudgeCard
        message={activeNudge.message}
        alternative={activeNudge.alternative}
        isSubmitting={isSubmitting}
        onAccept={() => void handleRespond("accepted")}
        onDismiss={() => void handleRespond("dismissed")}
      />
    </View>
  );
}
