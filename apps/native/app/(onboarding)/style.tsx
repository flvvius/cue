import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { Container } from "@/components/container";

const styles = [
  {
    id: "gentle",
    title: "Gentle",
    description: "Calm, compassionate reminders with softer framing.",
  },
  {
    id: "direct",
    title: "Direct",
    description: "Short, clear nudges that get straight to the point.",
  },
  {
    id: "motivational",
    title: "Motivational",
    description: "Encouraging pushes that emphasize momentum and growth.",
  },
] as const;

export default function OnboardingStyleScreen() {
  const params = useLocalSearchParams<{ defaultLimitMinutes?: string }>();
  const [selectedStyle, setSelectedStyle] = React.useState<(typeof styles)[number]["id"]>("gentle");

  return (
    <Container className="bg-background px-5 py-8" isScrollable={false}>
      <View className="flex-1">
        <Text className="text-accent text-xs uppercase tracking-[1.8px] font-['Inter_600SemiBold']">
          Step 2
        </Text>
        <Text className="mt-4 text-3xl leading-10 text-foreground font-['Inter_700Bold']">
          Choose how Cue should speak to you.
        </Text>
        <Text className="mt-3 text-base leading-7 text-secondary font-['Inter_400Regular']">
          This sets the tone for the first nudge system. We can always make it smarter later.
        </Text>

        <View className="mt-8 gap-3">
          {styles.map((styleOption) => {
            const isSelected = styleOption.id === selectedStyle;
            return (
              <Pressable
                key={styleOption.id}
                onPress={() => setSelectedStyle(styleOption.id)}
                className={`rounded-2xl border px-4 py-4 ${isSelected ? "border-brand bg-brand/12" : "border-border bg-surface"}`}
                style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
              >
                <Text className="text-lg text-foreground font-['Inter_600SemiBold']">
                  {styleOption.title}
                </Text>
                <Text className="mt-1 text-sm leading-6 text-secondary font-['Inter_400Regular']">
                  {styleOption.description}
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
                pathname: "/(onboarding)/review",
                params: {
                  defaultLimitMinutes: params.defaultLimitMinutes ?? "30",
                  nudgeStyle: selectedStyle,
                },
              })
            }
            className="flex-1 rounded-xl bg-brand-strong px-4 py-4"
            style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
          >
            <Text className="text-center text-base text-foreground font-['Inter_600SemiBold']">
              Review
            </Text>
          </Pressable>
        </View>
      </View>
    </Container>
  );
}
