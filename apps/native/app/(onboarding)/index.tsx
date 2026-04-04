import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { Container } from "@/components/container";

const onboardingSteps = [
  "Choose a default session limit",
  "Pick the tone of your nudges",
  "Unlock the main app and keep building from there",
];

export default function OnboardingIndexScreen() {
  return (
    <Container className="bg-background px-5 py-8" isScrollable={false}>
      <View className="flex-1 justify-between">
        <View>
          <Text className="text-accent text-xs uppercase tracking-[1.8px] font-['Inter_600SemiBold']">
            Onboarding
          </Text>
          <Text className="mt-4 text-4xl leading-[44px] text-foreground font-['Inter_700Bold']">
            Let’s set your first healthy defaults.
          </Text>
          <Text className="mt-4 text-base leading-7 text-secondary font-['Inter_400Regular']">
            This is the first roadmap slice: a real onboarding gate with the core preferences we
            need before building permissions, exclusions, and live nudges.
          </Text>
        </View>

        <View className="gap-3">
          {onboardingSteps.map((step, index) => (
            <View
              key={step}
              className="rounded-2xl border border-border bg-surface px-4 py-4"
            >
              <Text className="text-muted text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
                Step {index + 1}
              </Text>
              <Text className="mt-2 text-base leading-6 text-foreground font-['Inter_600SemiBold']">
                {step}
              </Text>
            </View>
          ))}
        </View>

        <Pressable
          onPress={() => router.push("/(onboarding)/limit")}
          className="mt-8 rounded-xl bg-brand-strong px-5 py-4"
          style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
        >
          <Text className="text-center text-base text-foreground font-['Inter_600SemiBold']">
            Start onboarding
          </Text>
        </Pressable>
      </View>
    </Container>
  );
}
