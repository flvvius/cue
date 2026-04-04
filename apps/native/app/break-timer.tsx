import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { Container } from "@/components/container";
import { useBreakState } from "@/contexts/break-state-context";

function formatRemainingTime(totalMs: number) {
  const safeMs = Math.max(0, totalMs);
  const totalSeconds = Math.ceil(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function BreakTimerScreen() {
  const router = useRouter();
  const { activeBreak, finishBreak } = useBreakState();
  const params = useLocalSearchParams<{
    appPackage?: string;
    appName?: string;
    alternative?: string;
    durationMinutes?: string;
    endsAt?: string;
  }>();
  const appPackage = params.appPackage ?? activeBreak?.appPackage ?? "debug.manual";
  const appName = params.appName ?? activeBreak?.appName ?? "This app";
  const alternative = params.alternative ?? activeBreak?.alternative;
  const durationMinutes = Math.max(
    1,
    Number(params.durationMinutes ?? String(activeBreak?.durationMinutes ?? 5)),
  );
  const initialEndsAt = Number(
    params.endsAt ?? String(activeBreak?.endsAt ?? Date.now() + durationMinutes * 60 * 1000),
  );
  const [remainingMs, setRemainingMs] = React.useState(() => Math.max(0, initialEndsAt - Date.now()));
  const hasFinishedRef = React.useRef(false);
  const totalDurationMs = durationMinutes * 60 * 1000;

  React.useEffect(() => {
    hasFinishedRef.current = false;
    setRemainingMs(Math.max(0, initialEndsAt - Date.now()));

    const intervalId = setInterval(() => {
      setRemainingMs(Math.max(0, initialEndsAt - Date.now()));
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [initialEndsAt]);

  const isComplete = remainingMs <= 0;
  const progress = isComplete ? 1 : Math.min(1, (totalDurationMs - remainingMs) / totalDurationMs);
  const ringSize = 232;
  const ringStroke = 12;
  const ringRadius = (ringSize - ringStroke) / 2;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const progressStrokeOffset = ringCircumference * (1 - progress);

  React.useEffect(() => {
    if (!isComplete || hasFinishedRef.current) {
      return;
    }

    hasFinishedRef.current = true;
    finishBreak(appPackage, initialEndsAt);
  }, [appPackage, finishBreak, initialEndsAt, isComplete]);

  const handleEndEarly = React.useCallback(() => {
    finishBreak(appPackage, Date.now());
    router.replace("/(drawer)/(tabs)");
  }, [appPackage, finishBreak, router]);

  const handleBackToCue = React.useCallback(() => {
    finishBreak(appPackage, initialEndsAt);
    router.replace("/(drawer)/(tabs)");
  }, [appPackage, finishBreak, initialEndsAt, router]);

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
          <View className="items-center justify-center">
            <Svg width={ringSize} height={ringSize} className="absolute">
              <Circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={ringRadius}
                stroke="#312e81"
                strokeOpacity={0.35}
                strokeWidth={ringStroke}
                fill="transparent"
              />
              <Circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={ringRadius}
                stroke="#a78bfa"
                strokeWidth={ringStroke}
                fill="transparent"
                strokeDasharray={ringCircumference}
                strokeDashoffset={progressStrokeOffset}
                strokeLinecap="round"
                rotation="-90"
                origin={`${ringSize / 2}, ${ringSize / 2}`}
              />
            </Svg>

            <View className="h-56 w-56 items-center justify-center rounded-full border border-break/20 bg-break/12">
              <Text className="text-break text-5xl font-['Inter_700Bold']">
                {formatRemainingTime(remainingMs)}
              </Text>
              <Text className="mt-3 text-sm text-secondary font-['Inter_500Medium']">
                {isComplete ? "Ready when you are" : "Remaining"}
              </Text>
              <Text className="mt-1 text-xs text-muted font-['Inter_500Medium']">
                {isComplete ? "Reset protected" : `${Math.round(progress * 100)}% complete`}
              </Text>
            </View>
          </View>

          <View className="mt-8 w-full rounded-3xl border border-border bg-surface px-5 py-5">
            <View className="flex-row items-start gap-3">
              <View className="mt-1 h-11 w-11 items-center justify-center rounded-full bg-accent/14">
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

          <View className="mt-4 w-full rounded-3xl border border-break/25 bg-break/10 px-5 py-4">
            <Text className="text-break text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
              What happens after this
            </Text>
            <Text className="mt-2 text-sm leading-6 text-foreground font-['Inter_500Medium']">
              Cue resets the session for {appName}, so coming back later starts clean instead of continuing the old spiral.
            </Text>
          </View>
        </View>

        <View className="gap-3">
          {isComplete ? (
            <Pressable
              onPress={handleBackToCue}
              className="rounded-2xl px-4 py-4"
              style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1, backgroundColor: "#a78bfa" }]}
            >
              <Text className="text-center text-base text-background font-['Inter_600SemiBold']">
                Back to Cue
              </Text>
            </Pressable>
          ) : (
            <View className="gap-3">
              <Text className="text-center text-xs leading-5 text-muted font-['Inter_500Medium']">
                Ending early will drop the break, but it will not reset this session yet.
              </Text>
              <Pressable
                onPress={handleEndEarly}
                className="rounded-2xl border border-border bg-surface px-4 py-4"
                style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
              >
                <Text className="text-center text-base text-secondary font-['Inter_600SemiBold']">
                  End break early
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Container>
  );
}
