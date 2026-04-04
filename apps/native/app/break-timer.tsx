import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { Container } from "@/components/container";

function formatRemainingTime(totalMs: number) {
  const safeMs = Math.max(0, totalMs);
  const totalSeconds = Math.ceil(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function BreakTimerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    appName?: string;
    alternative?: string;
    durationMinutes?: string;
    endsAt?: string;
  }>();
  const appName = params.appName ?? "This app";
  const alternative = params.alternative;
  const durationMinutes = Math.max(1, Number(params.durationMinutes ?? "5"));
  const initialEndsAt = Number(params.endsAt ?? String(Date.now() + durationMinutes * 60 * 1000));
  const [remainingMs, setRemainingMs] = React.useState(() => Math.max(0, initialEndsAt - Date.now()));

  React.useEffect(() => {
    setRemainingMs(Math.max(0, initialEndsAt - Date.now()));

    const intervalId = setInterval(() => {
      setRemainingMs(Math.max(0, initialEndsAt - Date.now()));
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [initialEndsAt]);

  const isComplete = remainingMs <= 0;

  return (
    <Container className="bg-background px-5 py-8" isScrollable={false}>
      <View className="flex-1 justify-between">
        <View>
          <Text className="text-break text-xs uppercase tracking-[1.8px] font-['Inter_600SemiBold']">
            Break time
          </Text>
          <Text className="mt-4 text-3xl leading-10 text-foreground font-['Inter_700Bold']">
            {isComplete ? "Reset complete." : `Step away from ${appName}.`}
          </Text>
          <Text className="mt-3 text-base leading-7 text-secondary font-['Inter_400Regular']">
            {isComplete
              ? "You made it through the current cooldown. Come back when you're ready."
              : `Cue is holding space for a ${durationMinutes}-minute reset before the next session starts fresh.`}
          </Text>
        </View>

        <View className="items-center">
          <View className="h-52 w-52 items-center justify-center rounded-full border border-break/30 bg-break/12">
            <Text className="text-break text-5xl font-['Inter_700Bold']">
              {formatRemainingTime(remainingMs)}
            </Text>
            <Text className="mt-3 text-sm text-secondary font-['Inter_500Medium']">
              {isComplete ? "Ready when you are" : "Remaining"}
            </Text>
          </View>

          <View className="mt-8 w-full rounded-2xl border border-border bg-surface px-5 py-5">
            <View className="flex-row items-start gap-3">
              <View className="mt-1 h-10 w-10 items-center justify-center rounded-full bg-accent/14">
                <Ionicons name="sparkles-outline" size={20} color="#fbbf24" />
              </View>
              <View className="flex-1">
                <Text className="text-muted text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
                  Suggested alternative
                </Text>
                <Text className="mt-2 text-lg text-foreground font-['Inter_600SemiBold']">
                  {alternative ?? "Take a short walk, stretch, or breathe for a minute."}
                </Text>
                <Text className="mt-2 text-sm leading-6 text-secondary font-['Inter_400Regular']">
                  The goal is not to be perfect. It&apos;s just to interrupt the loop and give your attention a better next move.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View className="gap-3">
          {isComplete ? (
            <Pressable
              onPress={() => router.replace("/(drawer)/(tabs)")}
              className="rounded-xl bg-break px-4 py-4"
              style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
            >
              <Text className="text-center text-base text-background font-['Inter_600SemiBold']">
                Back to Cue
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.replace("/(drawer)/(tabs)")}
              className="rounded-xl border border-border bg-surface px-4 py-4"
              style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
            >
              <Text className="text-center text-base text-secondary font-['Inter_600SemiBold']">
                End break early
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Container>
  );
}
