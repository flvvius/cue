import { router } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { Container } from "@/components/container";

const presets = [20, 30, 45, 60];

export default function OnboardingLimitScreen() {
  const [selectedLimit, setSelectedLimit] = React.useState(30);

  return (
    <Container className="bg-background px-5 py-8" isScrollable={false}>
      <View className="flex-1">
        <Text className="text-accent text-xs uppercase tracking-[1.8px] font-['Inter_600SemiBold']">
          Step 2
        </Text>
        <Text className="mt-4 text-3xl leading-10 text-foreground font-['Inter_700Bold']">
          Pick a fallback session limit.
        </Text>
        <Text className="mt-3 text-base leading-7 text-secondary font-['Inter_400Regular']">
          This is the default ceiling we’ll use before app-specific AI recommendations arrive.
        </Text>

        <View className="mt-8 gap-3">
          {presets.map((preset) => {
            const isSelected = preset === selectedLimit;
            return (
              <Pressable
                key={preset}
                onPress={() => setSelectedLimit(preset)}
                className={`rounded-2xl border px-4 py-4 ${isSelected ? "border-brand bg-brand/12" : "border-border bg-surface"}`}
                style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
              >
                <Text
                  className={`text-lg font-['Inter_600SemiBold'] ${isSelected ? "text-foreground" : "text-foreground"}`}
                >
                  {preset} minutes
                </Text>
                <Text className="mt-1 text-sm leading-6 text-secondary font-['Inter_400Regular']">
                  {preset <= 30
                    ? "A tighter default for distraction-heavy apps."
                    : "A more forgiving default until smarter limits arrive."}
                </Text>
              </Pressable>
            );
          })}
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
            onPress={() =>
              router.push({
                pathname: "/(onboarding)/alternatives",
                params: { defaultLimitMinutes: String(selectedLimit) },
              })
            }
            className="flex-1 rounded-xl bg-brand-strong px-4 py-4"
            style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
          >
            <Text className="text-center text-base text-foreground font-['Inter_600SemiBold']">
              Continue
            </Text>
          </Pressable>
        </View>
      </View>
    </Container>
  );
}
