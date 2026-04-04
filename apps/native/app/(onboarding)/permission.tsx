import { router, useLocalSearchParams, type Href } from "expo-router";
import React from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";

import { Container } from "@/components/container";
import { useAndroidUsageAccess } from "@/lib/usage-access";

function getNextHref(next?: string): Href {
  if (next === "home") {
    return "/(drawer)";
  }

  if (next === "limit") {
    return "/(onboarding)/limit";
  }

  return "/(onboarding)/exclusions";
}

export default function OnboardingPermissionScreen() {
  const params = useLocalSearchParams<{ next?: string }>();
  const usageAccess = useAndroidUsageAccess();
  const [isOpeningSettings, setIsOpeningSettings] = React.useState(false);

  const nextHref = getNextHref(params.next);
  const isAndroid = Platform.OS === "android";
  const needsPermission = isAndroid && usageAccess.isRelevant && !usageAccess.granted;
  const needsOverlayPermission = isAndroid && usageAccess.isRelevant && !usageAccess.overlayGranted;
  const hasMissingPermission = needsPermission || needsOverlayPermission;

  const handlePrimaryPress = async () => {
    if (!isAndroid) {
      router.replace(nextHref);
      return;
    }

    if (!usageAccess.isAvailable) {
      usageAccess.refresh();
      return;
    }

    if (!hasMissingPermission) {
      router.replace(nextHref);
      return;
    }

    setIsOpeningSettings(true);
    try {
      if (needsPermission) {
        await usageAccess.openSettings();
        return;
      }

      if (needsOverlayPermission) {
        await usageAccess.openOverlaySettings();
      }
    } finally {
      setIsOpeningSettings(false);
    }
  };

  const primaryLabel = !isAndroid
    ? "Continue"
    : !usageAccess.isAvailable
      ? "Refresh status"
      : needsPermission
        ? "Open usage access settings"
        : needsOverlayPermission
          ? "Allow display over apps"
          : "Continue";

  return (
    <Container className="bg-background px-5 py-8" isScrollable={false}>
      <View className="flex-1">
        <Text className="text-accent text-xs uppercase tracking-[1.8px] font-['Inter_600SemiBold']">
          Permission
        </Text>
        <Text className="mt-4 text-3xl leading-10 text-foreground font-['Inter_700Bold']">
          Give Cue the Android access it needs to actually step in.
        </Text>
        <Text className="mt-3 text-base leading-7 text-secondary font-['Inter_400Regular']">
          Cue needs two Android settings: usage access to read foreground sessions, and display-over-apps permission so it can put a real blocker on top of over-limit apps.
        </Text>

        <View className="mt-8 gap-3">
          <View className="rounded-2xl border border-border bg-surface px-4 py-4">
            <Text className="text-muted text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
              What we read
            </Text>
            <Text className="mt-2 text-sm leading-6 text-foreground font-['Inter_500Medium']">
              Which apps move to the foreground and how long sessions last.
            </Text>
          </View>
          <View className="rounded-2xl border border-border bg-surface px-4 py-4">
            <Text className="text-muted text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
              What we show
            </Text>
            <Text className="mt-2 text-sm leading-6 text-foreground font-['Inter_500Medium']">
              A full-screen blocker over apps that cross the limit, plus a path back into Cue to start a break.
            </Text>
          </View>
          <View className="rounded-2xl border border-border bg-surface px-4 py-4">
            <Text className="text-muted text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
              What happens next
            </Text>
            <Text className="mt-2 text-sm leading-6 text-foreground font-['Inter_500Medium']">
              Tap the button below, enable the missing setting, then come back here. Cue re-checks automatically when the app resumes.
            </Text>
          </View>
          {!isAndroid ? (
            <View className="rounded-2xl border border-brand/30 bg-brand/12 px-4 py-4">
              <Text className="text-accent text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
                Not needed here
              </Text>
              <Text className="mt-2 text-sm leading-6 text-foreground font-['Inter_500Medium']">
                Usage Access is Android-only, so this build can keep moving.
              </Text>
            </View>
          ) : !usageAccess.isAvailable ? (
            <View className="rounded-2xl border border-warning/30 bg-warning/12 px-4 py-4">
              <Text className="text-warning text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
                Rebuild required
              </Text>
              <Text className="mt-2 text-sm leading-6 text-foreground font-['Inter_500Medium']">
                This installed dev build does not include the new native Usage Access module yet. Rebuild the Android dev client once, then reopen Cue.
              </Text>
            </View>
          ) : needsPermission ? (
            <View className="rounded-2xl border border-warning/30 bg-warning/12 px-4 py-4">
              <Text className="text-warning text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
                Access missing
              </Text>
              <Text className="mt-2 text-sm leading-6 text-foreground font-['Inter_500Medium']">
                Cue is not enabled yet in Android&apos;s Usage Access settings.
              </Text>
            </View>
          ) : needsOverlayPermission ? (
            <View className="rounded-2xl border border-warning/30 bg-warning/12 px-4 py-4">
              <Text className="text-warning text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
                Overlay missing
              </Text>
              <Text className="mt-2 text-sm leading-6 text-foreground font-['Inter_500Medium']">
                Cue still needs Android&apos;s display-over-apps permission so it can actually block an app after the limit is reached.
              </Text>
            </View>
          ) : (
            <View className="rounded-2xl border border-success/30 bg-success/12 px-4 py-4">
              <Text className="text-success text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
                Ready to enforce
              </Text>
              <Text className="mt-2 text-sm leading-6 text-foreground font-['Inter_500Medium']">
                Usage access and overlay permission are both enabled. You can continue.
              </Text>
            </View>
          )}
        </View>

        <View className="mt-auto gap-3 pt-8">
          <Pressable
            onPress={handlePrimaryPress}
            disabled={isOpeningSettings}
            className="rounded-xl bg-brand-strong px-5 py-4"
            style={({ pressed }) => [{ opacity: pressed || isOpeningSettings ? 0.92 : 1 }]}
          >
            <View className="flex-row items-center justify-center gap-2">
              {isOpeningSettings && <ActivityIndicator color="#f8fafc" size="small" />}
              <Text className="text-center text-base text-foreground font-['Inter_600SemiBold']">
                {primaryLabel}
              </Text>
            </View>
          </Pressable>
          {isAndroid && usageAccess.isAvailable && hasMissingPermission && (
            <Pressable
              onPress={usageAccess.refresh}
              className="rounded-xl border border-border bg-surface px-5 py-4"
              style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
            >
              <Text className="text-center text-base text-secondary font-['Inter_600SemiBold']">
                I&apos;ve enabled it
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Container>
  );
}
