import { api } from "@cue/backend/convex/_generated/api";
import { useAuth } from "@clerk/expo";
import { useQuery } from "convex/react";
import React from "react";
import { Platform } from "react-native";

import { useBreakState } from "@/contexts/break-state-context";
import {
  hasBlockingMonitorBridge,
  setBlockingConfig,
  startBlockingMonitor,
  stopBlockingMonitor,
  useAndroidUsageAccess,
} from "@/lib/usage-access";

export function useAndroidBlockingMonitor() {
  const { isLoaded, isSignedIn } = useAuth();
  const currentUser = useQuery(api.users.current);
  const overview = useQuery(api.dashboard.overviewForCurrentUser);
  const { activeBreak, sessionResetCutoffs } = useBreakState();
  const usageAccess = useAndroidUsageAccess();

  React.useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    let cancelled = false;

    const syncMonitor = async () => {
      if (
        !isLoaded ||
        !isSignedIn ||
        !currentUser ||
        !currentUser.onboardingComplete ||
        !overview ||
        !usageAccess.isAvailable ||
        !usageAccess.granted ||
        !usageAccess.overlayAvailable ||
        !usageAccess.overlayGranted ||
        !hasBlockingMonitorBridge()
      ) {
        await stopBlockingMonitor();
        return;
      }

      await setBlockingConfig({
        enabled: true,
        defaultLimitMinutes: overview.defaultLimitMinutes,
        excludedPackages: overview.excludedApps.map((app) => app.appPackage),
        sessionResetCutoffs,
        appLimits: overview.recommendations.map((recommendation) => ({
          appPackage: recommendation.appPackage,
          appName: recommendation.appName,
          limitMinutes: recommendation.sessionLimitMinutes,
        })),
        activeBreak: activeBreak
          ? {
              appPackage: activeBreak.appPackage,
              endsAt: activeBreak.endsAt,
            }
          : null,
      });

      if (!cancelled) {
        await startBlockingMonitor();
      }
    };

    void syncMonitor();

    return () => {
      cancelled = true;
    };
  }, [
    activeBreak,
    currentUser,
    isLoaded,
    isSignedIn,
    overview,
    sessionResetCutoffs,
    usageAccess.granted,
    usageAccess.isAvailable,
    usageAccess.overlayAvailable,
    usageAccess.overlayGranted,
  ]);
}
