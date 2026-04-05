import { useAuth, useUser } from "@clerk/expo";
import { api } from "@cue/backend/convex/_generated/api";
import { useQuery } from "convex/react";
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
  const usageAccess = useAndroidUsageAccess();
  const sessionSyncStatus = useUsageSessionSync();

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
        </View>
      </View>
    </Container>
  );
}
