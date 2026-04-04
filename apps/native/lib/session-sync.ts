import { useAuth } from "@clerk/expo";
import { api } from "@cue/backend/convex/_generated/api";
import { useMutation } from "convex/react";
import React from "react";
import { AppState, Platform } from "react-native";

import { getUsageEvents, hasUsageEventsBridge, type RawUsageEvent, useAndroidUsageAccess } from "@/lib/usage-access";
import { computeSessionsFromUsageEvents } from "@/lib/usage-session-utils";

export type SessionSyncStatus = {
  lastSyncedAt: number | null;
  lastInserted: number;
  lastSkipped: number;
  lastReceived: number;
  bridgeReady: boolean;
  isSyncing: boolean;
};

export function useUsageSessionSync() {
  const { isLoaded, isSignedIn } = useAuth();
  const usageAccess = useAndroidUsageAccess();
  const syncSessions = useMutation(api.usageSessions.syncForCurrentUser);
  const [status, setStatus] = React.useState<SessionSyncStatus>({
    lastSyncedAt: null,
    lastInserted: 0,
    lastSkipped: 0,
    lastReceived: 0,
    bridgeReady: hasUsageEventsBridge(),
    isSyncing: false,
  });
  const syncInFlightRef = React.useRef(false);

  const runSync = React.useCallback(async () => {
    if (
      Platform.OS !== "android" ||
      !isLoaded ||
      !isSignedIn ||
      !usageAccess.granted ||
      syncInFlightRef.current
    ) {
      return;
    }

    if (!hasUsageEventsBridge()) {
      setStatus((currentStatus) => ({
        ...currentStatus,
        bridgeReady: false,
      }));
      return;
    }

    syncInFlightRef.current = true;
    setStatus((currentStatus) => ({
      ...currentStatus,
      bridgeReady: true,
      isSyncing: true,
    }));

    try {
      const rawEvents = await getUsageEvents({ hours: 12, limit: 5000 });
      const sessions = computeSessionsFromUsageEvents(rawEvents);
      const result = await syncSessions({ sessions });

      setStatus({
        lastSyncedAt: result.syncedAt,
        lastInserted: result.inserted,
        lastSkipped: result.skipped,
        lastReceived: result.received,
        bridgeReady: true,
        isSyncing: false,
      });
    } catch {
      setStatus((currentStatus) => ({
        ...currentStatus,
        bridgeReady: hasUsageEventsBridge(),
        isSyncing: false,
      }));
    } finally {
      syncInFlightRef.current = false;
    }
  }, [isLoaded, isSignedIn, syncSessions, usageAccess.granted]);

  React.useEffect(() => {
    void runSync();
  }, [runSync]);

  React.useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void runSync();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [runSync]);

  return status;
}
