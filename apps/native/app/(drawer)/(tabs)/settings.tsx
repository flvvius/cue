import { useAuth, useUser } from "@clerk/expo";
import { api } from "@cue/backend/convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { Container } from "@/components/container";
import { SignOutButton } from "@/components/sign-out-button";
import { resolveDisplayAppName } from "@/lib/app-display-name";
import { formatDisplayLimitCompact } from "@/lib/limit-display";
import { useUsageSessionSync } from "@/lib/session-sync";
import { useAndroidUsageAccess } from "@/lib/usage-access";

export default function SettingsTab() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const currentUser = useQuery(api.users.current);
  const healthCheck = useQuery(api.healthCheck.get);
  const privateData = useQuery(api.privateData.get);
  const overview = useQuery(api.dashboard.overviewForCurrentUser);
  const alternatives = useQuery(api.alternatives.listForCurrentUser);
  const activeNudge = useQuery(api.nudges.getActiveForCurrentUser);
  const queueNudge = useMutation(api.nudges.queueForCurrentUser);
  const requestGeneratedNudge = useMutation((api as any).nudgeRequests.requestForCurrentUser);
  const respondToNudge = useMutation(api.nudges.respondToCurrentUser);
  const seedFallbackRecommendations = useMutation(api.recommendations.seedFallbackForCurrentUser);
  const seedFastTestRecommendations = useMutation(api.recommendations.seedFastTestForCurrentUser);
  const clearRecommendations = useMutation(api.recommendations.clearForCurrentUser);
  const seedDemoDataForCurrentUser = useMutation((api as any).demoData.seedForCurrentUser);
  const usageAccess = useAndroidUsageAccess();
  const sessionSyncStatus = useUsageSessionSync();
  const [isQueueing, setIsQueueing] = React.useState(false);
  const [isQueueingAiNudge, setIsQueueingAiNudge] = React.useState(false);
  const [isClearing, setIsClearing] = React.useState(false);
  const [debugStatus, setDebugStatus] = React.useState<string | null>(null);
  const [isSeedingRecommendations, setIsSeedingRecommendations] = React.useState(false);
  const [isSeedingFastTestRecommendations, setIsSeedingFastTestRecommendations] = React.useState(false);
  const [isClearingRecommendations, setIsClearingRecommendations] = React.useState(false);
  const [isSeedingDemoData, setIsSeedingDemoData] = React.useState(false);

  const handleSendTestNudge = React.useCallback(async () => {
    if (isQueueing) {
      return;
    }

    setIsQueueing(true);
    try {
      if (activeNudge?.triggerApp === "debug.manual") {
        await respondToNudge({
          nudgeId: activeNudge._id,
          status: "dismissed",
        });
      }

      const result = await queueNudge({
        triggerApp: "debug.manual",
        type: "session_check",
        message: `Debug nudge for ${currentUser?.name ?? "you"}: step away for two minutes and reset your attention.${alternatives?.[0]?.activity ? ` Try ${alternatives[0].activity.toLowerCase()} instead.` : ""}`,
        alternative: alternatives?.[0]?.activity,
        cooldownMinutes: 0,
      });

      if (result.created) {
        setDebugStatus("Fresh test nudge created.");
      } else if (result.reason === "pending_exists") {
        setDebugStatus("A matching test nudge is already pending. Clear it first.");
      } else if (result.reason === "cooldown_active") {
        setDebugStatus("That test nudge is still in cooldown.");
      } else {
        setDebugStatus("No new test nudge was created.");
      }
    } finally {
      setIsQueueing(false);
    }
  }, [activeNudge, alternatives, currentUser?.name, isQueueing, queueNudge, respondToNudge]);

  const handleClearActiveNudge = React.useCallback(async () => {
    if (!activeNudge || isClearing) {
      return;
    }

    setIsClearing(true);
    try {
      await respondToNudge({
        nudgeId: activeNudge._id,
        status: "dismissed",
      });
      setDebugStatus("Active nudge cleared.");
    } finally {
      setIsClearing(false);
    }
  }, [activeNudge, isClearing, respondToNudge]);

  const handleSendAiTestNudge = React.useCallback(async () => {
    if (isQueueingAiNudge) {
      return;
    }

    setIsQueueingAiNudge(true);
    try {
      if (activeNudge) {
        await respondToNudge({
          nudgeId: activeNudge._id,
          status: "dismissed",
        });
      }

      const targetRecommendation = overview?.recommendations?.[0];
      const targetApp = targetRecommendation
        ? {
            appPackage: targetRecommendation.appPackage,
            appName: targetRecommendation.appName,
            limitMinutes: targetRecommendation.sessionLimitMinutes,
            breakMinutes:
              targetRecommendation.breakSchedule?.[0]?.breakAfterMinutes ?? 5,
          }
        : overview?.monitoredApps?.[0]
          ? {
              appPackage: overview.monitoredApps[0].appPackage,
              appName: overview.monitoredApps[0].appName,
              limitMinutes: overview.monitoredApps[0].limitMinutes,
              breakMinutes: 5,
            }
          : {
              appPackage: "debug.manual",
              appName: "Current app",
              limitMinutes: currentUser?.defaultSessionLimitMinutes ?? 5,
              breakMinutes: 5,
            };

      await requestGeneratedNudge({
        triggerApp: targetApp.appPackage,
        appName: targetApp.appName,
        type: "limit_warning",
        thresholdBucket: "at_limit",
        limitMinutes: targetApp.limitMinutes,
        breakDurationMinutes: targetApp.breakMinutes,
        sessionStartTime: Date.now(),
        alternatives: (alternatives ?? []).slice(0, 5).map((item: any) => item.activity),
        alternative: alternatives?.[0]?.activity,
        cooldownMinutes: 0,
        requireModelSuccess: true,
      });

      setDebugStatus(`AI nudge requested for ${targetApp.appName}. This test now fails loudly instead of silently using stock fallback copy.`);
    } finally {
      setIsQueueingAiNudge(false);
    }
  }, [
    activeNudge,
    alternatives,
    currentUser?.defaultSessionLimitMinutes,
    isQueueingAiNudge,
    overview,
    requestGeneratedNudge,
    respondToNudge,
  ]);

  const handleSeedRecommendations = React.useCallback(async () => {
    if (isSeedingRecommendations) {
      return;
    }

    setIsSeedingRecommendations(true);
    try {
      const result = await seedFallbackRecommendations({});
      setDebugStatus(`Seeded ${result.seeded} fallback recommendations for ${result.effectiveDate}.`);
    } finally {
      setIsSeedingRecommendations(false);
    }
  }, [isSeedingRecommendations, seedFallbackRecommendations]);

  const handleClearRecommendations = React.useCallback(async () => {
    if (isClearingRecommendations) {
      return;
    }

    setIsClearingRecommendations(true);
    try {
      const result = await clearRecommendations({});
      setDebugStatus(`Cleared ${result.cleared} AI recommendations.`);
    } finally {
      setIsClearingRecommendations(false);
    }
  }, [clearRecommendations, isClearingRecommendations]);

  const handleSeedFastTestRecommendations = React.useCallback(async () => {
    if (isSeedingFastTestRecommendations) {
      return;
    }

    setIsSeedingFastTestRecommendations(true);
    try {
      const result = await seedFastTestRecommendations({});
      setDebugStatus(
        `Seeded fast-test 1-minute limits for ${result.apps.join(", ")} on ${result.effectiveDate}.`,
      );
    } finally {
      setIsSeedingFastTestRecommendations(false);
    }
  }, [isSeedingFastTestRecommendations, seedFastTestRecommendations]);

  const handleSeedDemoData = React.useCallback(async () => {
    if (isSeedingDemoData) {
      return;
    }

    setIsSeedingDemoData(true);
    try {
      const result = await seedDemoDataForCurrentUser({});
      setDebugStatus(
        `Seeded ${result.inserted} demo sessions across ${result.seededApps.join(", ")}${result.skipped ? ` (${result.skipped} already existed)` : ""}.`,
      );
    } finally {
      setIsSeedingDemoData(false);
    }
  }, [isSeedingDemoData, seedDemoDataForCurrentUser]);

  return (
    <Container className="bg-background px-5 py-8">
      <View className="flex-1 gap-4">
        <View className="rounded-2xl border border-border bg-surface p-5">
          <Text className="text-secondary text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
            Settings
          </Text>
          <Text className="mt-2 text-foreground text-2xl font-['Inter_600SemiBold']">
            Current defaults
          </Text>
          <Text className="mt-3 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            A simple debug-friendly settings surface so you can verify what onboarding has already saved.
          </Text>
        </View>

        <View className="rounded-2xl border border-border bg-surface p-5">
          <Text className="text-muted text-xs uppercase tracking-[1.4px] font-['Inter_600SemiBold']">
            Account
          </Text>
          <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
            {isLoaded && isSignedIn
              ? user?.emailAddresses[0]?.emailAddress ?? "Signed in"
              : "Loading..."}
          </Text>
          <Text className="mt-2 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            {privateData?.message ?? "Signed in and ready to sync private Cue data."}
          </Text>
          <View className="mt-4 flex-row items-center justify-between">
            <View>
              <Text className="text-muted text-xs uppercase tracking-[1.4px] font-['Inter_600SemiBold']">
                Backend
              </Text>
              <Text className="mt-2 text-foreground text-base font-['Inter_600SemiBold']">
                {healthCheck === "OK" ? "Convex live" : healthCheck === undefined ? "Checking..." : "Offline"}
              </Text>
            </View>
            <SignOutButton />
          </View>
        </View>

        <View className="rounded-2xl border border-border bg-surface p-5">
          <Text className="text-muted text-xs uppercase tracking-[1.4px] font-['Inter_600SemiBold']">
            Usage pipeline
          </Text>
          <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
            {sessionSyncStatus.isSyncing
              ? "Syncing usage events..."
              : sessionSyncStatus.lastSyncedAt
                ? "Usage sessions synced"
                : "Waiting for first sync"}
          </Text>
          <Text className="mt-2 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            {sessionSyncStatus.bridgeReady
              ? `Received ${sessionSyncStatus.lastReceived} sessions, inserted ${sessionSyncStatus.lastInserted}, skipped ${sessionSyncStatus.lastSkipped}.`
              : "The installed Android build still needs the usage-event bridge."}
          </Text>
        </View>

        <View className="rounded-2xl border border-border bg-surface p-5">
          <Text className="text-muted text-xs uppercase tracking-[1.4px] font-['Inter_600SemiBold']">
            Nudge style
          </Text>
          <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
            {currentUser?.nudgeStyle ?? "Loading..."}
          </Text>
          <Text className="mt-4 text-muted text-xs uppercase tracking-[1.4px] font-['Inter_600SemiBold']">
            Default limit
          </Text>
          <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
            {currentUser?.defaultSessionLimitMinutes ?? 0} minutes
          </Text>
        </View>

        <View className="rounded-2xl border border-border bg-surface p-5">
          <Text className="text-muted text-xs uppercase tracking-[1.4px] font-['Inter_600SemiBold']">
            Excluded apps
          </Text>
          <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
            {overview?.excludedApps.length ?? 0}
          </Text>
          <Text className="mt-2 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            {(overview?.excludedApps ?? []).slice(0, 4).map((app: any) => resolveDisplayAppName(app.appName, app.appPackage)).join(", ") || "None yet"}
          </Text>
        </View>

        <View className="rounded-2xl border border-border bg-surface p-5">
          <Text className="text-muted text-xs uppercase tracking-[1.4px] font-['Inter_600SemiBold']">
            Alternatives
          </Text>
          <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
            {alternatives?.length ?? 0}
          </Text>
          <Text className="mt-2 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            {(alternatives ?? []).slice(0, 4).map((alternative: any) => alternative.activity).join(", ") || "None yet"}
          </Text>
        </View>

        <View className="rounded-2xl border border-border bg-surface p-5">
          <Text className="text-muted text-xs uppercase tracking-[1.4px] font-['Inter_600SemiBold']">
            Android blocking
          </Text>
          <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
            {usageAccess.granted && usageAccess.overlayGranted ? "Fully armed" : "Needs permissions"}
          </Text>
          <Text className="mt-2 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            Usage Access: {usageAccess.granted ? "granted" : "missing"}{"\n"}
            Display over apps: {usageAccess.overlayGranted ? "granted" : "missing"}
          </Text>
          <View className="mt-4 flex-row gap-3">
            {!usageAccess.granted ? (
              <Pressable
                onPress={() => void usageAccess.openSettings()}
                className="flex-1 rounded-xl bg-brand-strong px-4 py-4"
                style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
              >
                <Text className="text-center text-base text-foreground font-['Inter_600SemiBold']">
                  Open usage settings
                </Text>
              </Pressable>
            ) : null}
            {!usageAccess.overlayGranted ? (
              <Pressable
                onPress={() => void usageAccess.openOverlaySettings()}
                className="flex-1 rounded-xl border border-border bg-surface px-4 py-4"
                style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
              >
                <Text className="text-center text-base text-secondary font-['Inter_600SemiBold']">
                  Allow overlay
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View className="rounded-2xl border border-border bg-surface p-5">
          <Text className="text-muted text-xs uppercase tracking-[1.4px] font-['Inter_600SemiBold']">
            AI recommendations
          </Text>
          <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
            {overview?.recommendations.length ?? 0}
          </Text>
          <Text className="mt-2 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            {(overview?.recommendations ?? []).slice(0, 3).map((recommendation: any) => `${resolveDisplayAppName(recommendation.appName, recommendation.appPackage)}: ${formatDisplayLimitCompact(recommendation.sessionLimitMinutes)}`).join(" • ") || "Fallback default only for now"}
          </Text>
          <Text className="mt-3 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            Fast test mode seeds 1-minute limits for a few monitored apps so you can hit real thresholds and blocker states almost immediately.
          </Text>
          <View className="mt-4 flex-row gap-3">
            <Pressable
              onPress={() => void handleSeedRecommendations()}
              disabled={isSeedingRecommendations}
              className="flex-1 rounded-xl bg-brand-strong px-4 py-4"
              style={({ pressed }) => [{ opacity: pressed || isSeedingRecommendations ? 0.92 : 1 }]}
            >
              <Text className="text-center text-base text-foreground font-['Inter_600SemiBold']">
                {isSeedingRecommendations ? "Seeding..." : "Seed fallback recs"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void handleSeedFastTestRecommendations()}
              disabled={isSeedingFastTestRecommendations}
              className="flex-1 rounded-xl border border-warning/30 bg-warning/12 px-4 py-4"
              style={({ pressed }) => [{ opacity: pressed || isSeedingFastTestRecommendations ? 0.92 : 1 }]}
            >
              <Text className="text-center text-base text-warning font-['Inter_600SemiBold']">
                {isSeedingFastTestRecommendations ? "Arming..." : "Seed fast test"}
              </Text>
            </Pressable>
          </View>
          <View className="mt-3 flex-row gap-3">
            <Pressable
              onPress={() => void handleClearRecommendations()}
              disabled={isClearingRecommendations}
              className="flex-1 rounded-xl border border-border bg-surface px-4 py-4"
              style={({ pressed }) => [{ opacity: pressed || isClearingRecommendations ? 0.92 : 1 }]}
            >
              <Text className="text-center text-base text-secondary font-['Inter_600SemiBold']">
                {isClearingRecommendations ? "Clearing..." : "Clear recs"}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Manual export trigger intentionally hidden for now. */}

        <View className="rounded-2xl border border-border bg-surface p-5">
          <Text className="text-muted text-xs uppercase tracking-[1.4px] font-['Inter_600SemiBold']">
            Demo prep
          </Text>
          <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
            Seed realistic usage history
          </Text>
          <Text className="mt-2 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            Inserts a handful of recent sessions for common apps so the dashboard looks strong even if today’s real device history is light.
          </Text>
          <View className="mt-4 flex-row gap-3">
            <Pressable
              onPress={() => void handleSeedDemoData()}
              disabled={isSeedingDemoData}
              className="flex-1 rounded-xl bg-brand-strong px-4 py-4"
              style={({ pressed }) => [{ opacity: pressed || isSeedingDemoData ? 0.92 : 1 }]}
            >
              <Text className="text-center text-base text-foreground font-['Inter_600SemiBold']">
                {isSeedingDemoData ? "Seeding..." : "Seed demo sessions"}
              </Text>
            </Pressable>
          </View>
        </View>

        <View className="rounded-2xl border border-brand/30 bg-brand/12 p-5">
          <Text className="text-accent text-xs uppercase tracking-[1.4px] font-['Inter_600SemiBold']">
            Nudge testing
          </Text>
          <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
            Fire a debug nudge instantly
          </Text>
          <Text className="mt-2 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            Real thresholds are currently: approaching at 80%, at limit at 100%, and exceeded at 120% of the session limit. Use the debug trigger below if you want to test the card without waiting.
          </Text>
          {/* Enforcement preview intentionally hidden for now. */}
          <View className="mt-4 flex-row gap-3">
            <Pressable
              onPress={() => void handleSendTestNudge()}
              disabled={isQueueing}
              className="flex-1 rounded-xl bg-brand-strong px-4 py-4"
              style={({ pressed }) => [{ opacity: pressed || isQueueing ? 0.92 : 1 }]}
            >
              <Text className="text-center text-base text-foreground font-['Inter_600SemiBold']">
                {isQueueing ? "Sending..." : "Send test nudge"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void handleClearActiveNudge()}
              disabled={!activeNudge || isClearing}
              className="flex-1 rounded-xl border border-border bg-surface px-4 py-4"
              style={({ pressed }) => [{ opacity: pressed || !activeNudge || isClearing ? 0.92 : 1 }]}
            >
              <Text className="text-center text-base text-secondary font-['Inter_600SemiBold']">
                {isClearing ? "Clearing..." : "Clear active"}
              </Text>
            </Pressable>
          </View>
          <View className="mt-3 flex-row gap-3">
            <Pressable
              onPress={() => void handleSendAiTestNudge()}
              disabled={isQueueingAiNudge}
              className="flex-1 rounded-xl border border-accent/30 bg-accent/12 px-4 py-4"
              style={({ pressed }) => [{ opacity: pressed || isQueueingAiNudge ? 0.92 : 1 }]}
            >
              <Text className="text-center text-base text-accent font-['Inter_600SemiBold']">
                {isQueueingAiNudge ? "Requesting..." : "Send AI test nudge"}
              </Text>
            </Pressable>
          </View>
          <Text className="mt-3 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            {activeNudge
              ? `Active nudge: ${activeNudge.triggerApp}`
              : "No pending nudge right now."}
          </Text>
          {activeNudge ? (
            <Text className="mt-2 text-secondary text-sm leading-6 font-['Inter_400Regular']">
              Source: {activeNudge.generationSource ?? "unknown"}
              {activeNudge.generationModel ? ` • ${activeNudge.generationModel}` : ""}
              {activeNudge.generationFailureReason ? ` • ${activeNudge.generationFailureReason}` : ""}
            </Text>
          ) : null}
          {debugStatus ? (
            <Text className="mt-2 text-sm leading-6 text-accent font-['Inter_500Medium']">
              {debugStatus}
            </Text>
          ) : null}
        </View>
      </View>
    </Container>
  );
}
