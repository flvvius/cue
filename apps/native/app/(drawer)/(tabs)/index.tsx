import { Text, View } from "react-native";

import { Container } from "@/components/container";

export default function Home() {
  return (
    <Container className="bg-background px-5 py-8">
      <View className="flex-1 gap-4">
        <View className="rounded-2xl border border-border bg-surface p-5">
          <Text className="text-secondary text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
            Studio
          </Text>
          <Text className="mt-2 text-foreground text-2xl font-['Inter_600SemiBold']">
            Patterns view
          </Text>
          <Text className="mt-3 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            This space is reserved for behavior patterns, habit loops, and the moments that usually trigger an impulsive session.
          </Text>
        </View>
        <View className="rounded-2xl border border-break/30 bg-break/12 p-5">
          <Text className="text-break text-sm font-['Inter_600SemiBold']">
            Future module
          </Text>
          <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
            Break timer and recovery rituals
          </Text>
        </View>
      </View>
    </Container>
  );
}
