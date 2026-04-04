import { api } from "@cue/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { Container } from "@/components/container";
import {
  getRecentlyUsedApps,
  hasRecentAppsAccessBridge,
  type RecentUsageApp,
} from "@/lib/usage-access";

const essentialPackageHints = [
  "settings",
  "maps",
  "camera",
  "dialer",
  "phone",
  "contacts",
  "messages",
  "message",
  "bank",
  "wallet",
  "uber",
  "lyft",
  "gmail",
];

function shouldDefaultExclude(app: RecentUsageApp) {
  const normalizedName = app.appName.toLowerCase();
  const normalizedPackage = app.appPackage.toLowerCase();

  return (
    app.isSystemApp ||
    essentialPackageHints.some(
      (hint) => normalizedName.includes(hint) || normalizedPackage.includes(hint),
    )
  );
}

function formatMinutes(totalTimeInForegroundMs: number) {
  const minutes = Math.max(1, Math.round(totalTimeInForegroundMs / 60000));
  return `${minutes} min`;
}

export default function OnboardingExclusionsScreen() {
  const existingExclusions = useQuery(api.excludedApps.listForCurrentUser);
  const saveExclusions = useMutation(api.excludedApps.replaceForCurrentUser);
  const [recentApps, setRecentApps] = React.useState<RecentUsageApp[]>([]);
  const [selectedPackages, setSelectedPackages] = React.useState<Set<string>>(new Set());
  const [isLoadingApps, setIsLoadingApps] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const initializedSelectionRef = React.useRef(false);
  const hasRecentAppsBridge = hasRecentAppsAccessBridge();

  React.useEffect(() => {
    let isMounted = true;

    const loadApps = async () => {
      setIsLoadingApps(true);
      try {
        const apps = await getRecentlyUsedApps({ days: 7, limit: 24 });
        if (!isMounted) {
          return;
        }

        setRecentApps(apps);
      } finally {
        if (isMounted) {
          setIsLoadingApps(false);
        }
      }
    };

    void loadApps();

    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (initializedSelectionRef.current || existingExclusions === undefined || isLoadingApps) {
      return;
    }

    const initialSelection =
      existingExclusions.length > 0
        ? new Set<string>(existingExclusions.map((app: any) => app.appPackage))
        : new Set<string>(recentApps.filter(shouldDefaultExclude).map((app: RecentUsageApp) => app.appPackage));

    setSelectedPackages(initialSelection);
    initializedSelectionRef.current = true;
  }, [existingExclusions, isLoadingApps, recentApps]);

  const toggleApp = (appPackage: string) => {
    setSelectedPackages((currentSelection) => {
      const nextSelection = new Set(currentSelection);

      if (nextSelection.has(appPackage)) {
        nextSelection.delete(appPackage);
      } else {
        nextSelection.add(appPackage);
      }

      return nextSelection;
    });
  };

  const handleContinue = async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      await saveExclusions({
        apps: recentApps
          .filter((app) => selectedPackages.has(app.appPackage))
          .map((app) => ({
            appPackage: app.appPackage,
            appName: app.appName,
          })),
      });

      router.push("/(onboarding)/limit");
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCount = selectedPackages.size;

  return (
    <Container className="bg-background px-5 py-8" isScrollable={false}>
      <View className="flex-1">
        <Text className="text-accent text-xs uppercase tracking-[1.8px] font-['Inter_600SemiBold']">
          Step 1
        </Text>
        <Text className="mt-4 text-3xl leading-10 text-foreground font-['Inter_700Bold']">
          Pick the apps Cue should never limit.
        </Text>
        <Text className="mt-3 text-base leading-7 text-secondary font-['Inter_400Regular']">
          Everything is limited by default. Choose the essentials you always want to keep available,
          like maps, banking, phone, and settings.
        </Text>

        <View className="mt-6 rounded-2xl border border-border bg-surface px-4 py-4">
          <Text className="text-muted text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
            Selected exclusions
          </Text>
          <Text className="mt-2 text-lg text-foreground font-['Inter_600SemiBold']">
            {selectedCount} app{selectedCount === 1 ? "" : "s"}
          </Text>
          <Text className="mt-1 text-sm leading-6 text-secondary font-['Inter_400Regular']">
            We pre-selected likely essentials from your recently used apps. You can adjust them now.
          </Text>
        </View>

        <ScrollView className="mt-6 flex-1" contentContainerStyle={{ gap: 12, paddingBottom: 12 }}>
          {isLoadingApps ? (
            <View className="items-center rounded-2xl border border-border bg-surface px-4 py-8">
              <ActivityIndicator color="#f8fafc" />
              <Text className="mt-3 text-sm text-secondary font-['Inter_400Regular']">
                Reading your recent app sessions...
              </Text>
            </View>
          ) : !hasRecentAppsBridge ? (
            <View className="rounded-2xl border border-warning/30 bg-warning/12 px-4 py-5">
              <Text className="text-warning text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
                Rebuild required
              </Text>
              <Text className="mt-2 text-sm leading-6 text-foreground font-['Inter_500Medium']">
                This Android dev build doesn&apos;t include the newer recent-apps native method yet.
                Rebuild and reinstall the dev client once, then this list will populate.
              </Text>
            </View>
          ) : recentApps.length === 0 ? (
            <View className="rounded-2xl border border-warning/30 bg-warning/12 px-4 py-5">
              <Text className="text-warning text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
                No recent apps yet
              </Text>
              <Text className="mt-2 text-sm leading-6 text-foreground font-['Inter_500Medium']">
                Open a few apps on the phone, come back to Cue, and this list will populate from Android usage history.
              </Text>
            </View>
          ) : (
            recentApps.map((app) => {
              const isSelected = selectedPackages.has(app.appPackage);

              return (
                <Pressable
                  key={app.appPackage}
                  onPress={() => toggleApp(app.appPackage)}
                  className={`rounded-2xl border px-4 py-4 ${isSelected ? "border-brand bg-brand/12" : "border-border bg-surface"}`}
                  style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
                >
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-base text-foreground font-['Inter_600SemiBold']">
                        {app.appName}
                      </Text>
                      <Text className="mt-1 text-xs text-muted font-['Inter_400Regular']">
                        {app.appPackage}
                      </Text>
                      <Text className="mt-2 text-sm leading-6 text-secondary font-['Inter_400Regular']">
                        Used recently • {formatMinutes(app.totalTimeInForegroundMs)}
                      </Text>
                    </View>
                    <View
                      className={`rounded-full px-3 py-1 ${isSelected ? "bg-success/14 border border-success/30" : "bg-elevated border border-border"}`}
                    >
                      <Text
                        className={`text-xs font-['Inter_600SemiBold'] ${isSelected ? "text-success" : "text-secondary"}`}
                      >
                        {isSelected ? "Excluded" : "Limited"}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>

        <View className="mt-4 flex-row gap-3">
          <Pressable
            onPress={() => router.back()}
            className="flex-1 rounded-xl border border-border bg-surface px-4 py-4"
            style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
          >
            <Text className="text-center text-base text-secondary font-['Inter_600SemiBold']">
              Back
            </Text>
          </Pressable>
          <Pressable
            onPress={handleContinue}
            disabled={isSaving || isLoadingApps}
            className="flex-1 rounded-xl bg-brand-strong px-4 py-4"
            style={({ pressed }) => [{ opacity: pressed || isSaving || isLoadingApps ? 0.92 : 1 }]}
          >
            <Text className="text-center text-base text-foreground font-['Inter_600SemiBold']">
              {isSaving ? "Saving..." : "Continue"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Container>
  );
}
