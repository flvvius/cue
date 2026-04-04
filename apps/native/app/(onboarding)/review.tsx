import { api } from "@cue/backend/convex/_generated/api";
import { useMutation } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { Container } from "@/components/container";

const styleLabels = {
  gentle: "Gentle",
  direct: "Direct",
  motivational: "Motivational",
} as const;

export default function OnboardingReviewScreen() {
  const params = useLocalSearchParams<{
    defaultLimitMinutes?: string;
    nudgeStyle?: keyof typeof styleLabels;
  }>();
  const completeOnboarding = useMutation(api.users.completeOnboarding);
  const [isSaving, setIsSaving] = React.useState(false);

  const selectedLimit = Number(params.defaultLimitMinutes ?? "30");
  const selectedStyle = params.nudgeStyle && params.nudgeStyle in styleLabels
    ? params.nudgeStyle
    : "gentle";

  const handleComplete = async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      await completeOnboarding({
        defaultSessionLimitMinutes: selectedLimit,
        nudgeStyle: selectedStyle,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      router.replace("/(drawer)");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Container className="bg-background px-5 py-8" isScrollable={false}>
      <View className="flex-1">
        <Text className="text-accent text-xs uppercase tracking-[1.8px] font-['Inter_600SemiBold']">
          Review
        </Text>
        <Text className="mt-4 text-3xl leading-10 text-foreground font-['Inter_700Bold']">
          First slice complete.
        </Text>
        <Text className="mt-3 text-base leading-7 text-secondary font-['Inter_400Regular']">
          We’re saving your Android permission-backed setup, core exclusions, and first two preferences now so the rest of the roadmap has a real user state to build on.
        </Text>

        <View className="mt-8 gap-3">
          <View className="rounded-2xl border border-border bg-surface px-4 py-4">
            <Text className="text-muted text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
              Default limit
            </Text>
            <Text className="mt-2 text-lg text-foreground font-['Inter_600SemiBold']">
              {selectedLimit} minutes
            </Text>
          </View>
          <View className="rounded-2xl border border-border bg-surface px-4 py-4">
            <Text className="text-muted text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
              Nudge style
            </Text>
            <Text className="mt-2 text-lg text-foreground font-['Inter_600SemiBold']">
              {styleLabels[selectedStyle]}
            </Text>
          </View>
          <View className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-4">
            <Text className="text-accent text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
              Next
            </Text>
            <Text className="mt-2 text-sm leading-6 text-foreground font-['Inter_500Medium']">
              Alternatives, session syncing, and real nudges are the next roadmap steps.
            </Text>
          </View>
        </View>

        <View className="mt-auto flex-row gap-3 pt-8">
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
            onPress={handleComplete}
            disabled={isSaving}
            className="flex-1 rounded-xl bg-brand-strong px-4 py-4"
            style={({ pressed }) => [{ opacity: pressed || isSaving ? 0.92 : 1 }]}
          >
            <Text className="text-center text-base text-foreground font-['Inter_600SemiBold']">
              {isSaving ? "Saving..." : "Finish onboarding"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Container>
  );
}
