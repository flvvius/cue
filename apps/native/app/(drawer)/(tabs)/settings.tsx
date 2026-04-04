import { api } from "@cue/backend/convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { Container } from "@/components/container";

export default function SettingsTab() {
  const currentUser = useQuery(api.users.current);
  const overview = useQuery(api.dashboard.overviewForCurrentUser);
  const alternatives = useQuery(api.alternatives.listForCurrentUser);
  const activeNudge = useQuery(api.nudges.getActiveForCurrentUser);
  const queueNudge = useMutation(api.nudges.queueForCurrentUser);
  const respondToNudge = useMutation(api.nudges.respondToCurrentUser);
  const seedFallbackRecommendations = useMutation(api.recommendations.seedFallbackForCurrentUser);
  const clearRecommendations = useMutation(api.recommendations.clearForCurrentUser);
  const triggerExportForCurrentUser = useAction((api as any).aiPipeline.triggerExportForCurrentUser);
  const seedDemoDataForCurrentUser = useMutation((api as any).demoData.seedForCurrentUser);
  const [isQueueing, setIsQueueing] = React.useState(false);
  const [isClearing, setIsClearing] = React.useState(false);
  const [debugStatus, setDebugStatus] = React.useState<string | null>(null);
  const [isSeedingRecommendations, setIsSeedingRecommendations] = React.useState(false);
  const [isClearingRecommendations, setIsClearingRecommendations] = React.useState(false);
  const [isTriggeringExport, setIsTriggeringExport] = React.useState(false);
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

  const handleTriggerExport = React.useCallback(async () => {
    if (isTriggeringExport) {
      return;
    }

    setIsTriggeringExport(true);
    try {
      const result = await triggerExportForCurrentUser({});
      if (result.sent) {
        setDebugStatus(`Export sent to ${result.endpoint} with ${result.payload.sessions.length} sessions.`);
        return;
      }

      if (result.reason === "missing_endpoint") {
        setDebugStatus(
          `Export payload is ready locally: ${result.payload.sessions.length} sessions, ${result.payload.excludedApps.length} excluded apps, but no AWS endpoint is configured yet.`,
        );
        return;
      }

      setDebugStatus(`Export failed with status ${result.status ?? "unknown"}.`);
    } finally {
      setIsTriggeringExport(false);
    }
  }, [isTriggeringExport, triggerExportForCurrentUser]);

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
            {(overview?.excludedApps ?? []).slice(0, 4).map((app) => app.appName).join(", ") || "None yet"}
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
            {(alternatives ?? []).slice(0, 4).map((alternative) => alternative.activity).join(", ") || "None yet"}
          </Text>
        </View>

        <View className="rounded-2xl border border-border bg-surface p-5">
          <Text className="text-muted text-xs uppercase tracking-[1.4px] font-['Inter_600SemiBold']">
            AI recommendations
          </Text>
          <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
            {overview?.recommendations.length ?? 0}
          </Text>
          <Text className="mt-2 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            {(overview?.recommendations ?? []).slice(0, 3).map((recommendation) => `${recommendation.appName}: ${recommendation.sessionLimitMinutes}m`).join(" • ") || "Fallback default only for now"}
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

        <View className="rounded-2xl border border-border bg-surface p-5">
          <Text className="text-muted text-xs uppercase tracking-[1.4px] font-['Inter_600SemiBold']">
            AI pipeline
          </Text>
          <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
            Manual export trigger
          </Text>
          <Text className="mt-2 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            Sends the last 24 hours of full usage data, exclusions, and profile settings to the external AI endpoint when configured. If the endpoint is missing, Cue still builds the payload so you can verify the flow safely.
          </Text>
          <View className="mt-4 flex-row gap-3">
            <Pressable
              onPress={() => void handleTriggerExport()}
              disabled={isTriggeringExport}
              className="flex-1 rounded-xl bg-brand-strong px-4 py-4"
              style={({ pressed }) => [{ opacity: pressed || isTriggeringExport ? 0.92 : 1 }]}
            >
              <Text className="text-center text-base text-foreground font-['Inter_600SemiBold']">
                {isTriggeringExport ? "Building..." : "Trigger export"}
              </Text>
            </Pressable>
          </View>
        </View>

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
          <Text className="mt-3 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            {activeNudge
              ? `Active nudge: ${activeNudge.triggerApp}`
              : "No pending nudge right now."}
          </Text>
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
