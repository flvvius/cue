import { useRouter, useSegments } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useBreakState } from "@/contexts/break-state-context";
import { resolveDisplayAppName } from "@/lib/app-display-name";

function formatRemainingTime(totalMs: number) {
  const safeMs = Math.max(0, totalMs);
  const totalSeconds = Math.ceil(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function ActiveBreakHost() {
  const { activeBreak } = useBreakState();
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const [remainingMs, setRemainingMs] = React.useState(0);

  React.useEffect(() => {
    if (!activeBreak) {
      setRemainingMs(0);
      return;
    }

    setRemainingMs(Math.max(0, activeBreak.endsAt - Date.now()));

    const intervalId = setInterval(() => {
      setRemainingMs(Math.max(0, activeBreak.endsAt - Date.now()));
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [activeBreak]);

  const topLevel = segments[0];
  const shouldHide =
    !activeBreak ||
    topLevel === "(auth)" ||
    topLevel === "(onboarding)" ||
    topLevel === "sso-callback" ||
    topLevel === "break-timer";

  if (shouldHide) {
    return null;
  }

  const displayName = resolveDisplayAppName(activeBreak.appName, activeBreak.appPackage);

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-4"
      style={{ top: Math.max(insets.top + 8, 16) }}
    >
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/break-timer",
            params: {
              appPackage: activeBreak.appPackage,
              appName: displayName,
              alternative: activeBreak.alternative ?? undefined,
              durationMinutes: String(activeBreak.durationMinutes),
              endsAt: String(activeBreak.endsAt),
            },
          })
        }
        className="rounded-2xl border border-break/30 bg-break/12 px-4 py-4"
        style={({ pressed }) => [
          {
            opacity: pressed ? 0.94 : 1,
            backgroundColor: "#0f172a",
            borderColor: "#7c3aed",
          },
        ]}
      >
        <Text className="text-break text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
          Active break
        </Text>
        <Text className="mt-2 text-foreground text-base font-['Inter_600SemiBold']">
          {displayName} is cooling down for {formatRemainingTime(remainingMs)}
        </Text>
        <Text className="mt-2 text-secondary text-sm leading-6 font-['Inter_400Regular']">
          Cue will keep this app blocked until the timer ends. Tap to reopen the break screen.
        </Text>
      </Pressable>
    </View>
  );
}
