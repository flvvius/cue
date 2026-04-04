import { Text, View } from "react-native";

import { Container } from "@/components/container";

export default function TabTwo() {
  return (
    <Container className="bg-background px-5 py-8">
      <View className="flex-1 gap-4">
        <View className="rounded-2xl border border-border bg-surface p-5">
          <Text className="text-secondary text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
            Explore
          </Text>
          <Text className="mt-2 text-foreground text-2xl font-['Inter_600SemiBold']">
            Alternative actions
          </Text>
          <Text className="mt-3 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            A calmer replacement for doom-scroll energy: friction-light ideas, quick rituals, and small off-ramps from autopilot.
          </Text>
        </View>
        <View className="rounded-2xl border border-accent/30 bg-accent/10 p-5">
          <Text className="text-accent text-sm font-['Inter_600SemiBold']">
            Design note
          </Text>
          <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
            Warm accents should mark positive choices, not warnings.
          </Text>
        </View>
      </View>
    </Container>
  );
}
