import React from "react";
import { Pressable, Text, View } from "react-native";

type Props = {
  message: string;
  alternative?: string | null;
  onAccept: () => void;
  onDismiss: () => void;
  isSubmitting?: boolean;
};

export function NudgeCard({
  message,
  alternative,
  onAccept,
  onDismiss,
  isSubmitting = false,
}: Props) {
  return (
    <View
      className="overflow-hidden rounded-3xl border px-5 py-5 shadow-sm"
      style={{
        backgroundColor: "#0f172a",
        borderColor: "#6366f1",
        borderWidth: 1,
        elevation: 14,
      }}
    >
      <View
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: "#818cf8" }}
      />

      <View className="flex-row items-center justify-between">
        <View className="rounded-full bg-brand/15 px-3 py-2">
          <Text className="text-accent text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
            Cue interrupt
          </Text>
        </View>
        <Text className="text-muted text-xs font-['Inter_500Medium']">
          Right now
        </Text>
      </View>

      <Text className="mt-4 text-lg leading-8 text-foreground font-['Inter_600SemiBold']">
        {message}
      </Text>

      {alternative ? (
        <View className="mt-4 rounded-2xl border border-accent/25 bg-accent/10 px-4 py-4">
          <Text className="text-muted text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
            Suggested alternative
          </Text>
          <Text className="mt-2 text-base leading-6 text-accent font-['Inter_600SemiBold']">
            {alternative}
          </Text>
        </View>
      ) : null}

      <Text className="mt-4 text-sm leading-6 text-secondary font-['Inter_400Regular']">
        The goal is not punishment. It&apos;s to interrupt the loop before the next scroll turns into another fifteen minutes.
      </Text>

      <View className="mt-6 flex-row gap-3">
        <Pressable
          onPress={onDismiss}
          disabled={isSubmitting}
          className="flex-1 rounded-2xl border px-4 py-4"
          style={({ pressed }) => [
            {
              opacity: pressed || isSubmitting ? 0.92 : 1,
              backgroundColor: "#1e293b",
              borderColor: "#334155",
              borderWidth: 1,
            },
          ]}
        >
          <Text className="text-center text-base text-secondary font-['Inter_600SemiBold']">
            Keep scrolling
          </Text>
        </Pressable>
        <Pressable
          onPress={onAccept}
          disabled={isSubmitting}
          className="flex-1 rounded-2xl px-4 py-4"
          style={({ pressed }) => [
            {
              opacity: pressed || isSubmitting ? 0.92 : 1,
              backgroundColor: "#34d399",
            },
          ]}
        >
          <Text className="text-center text-base text-background font-['Inter_600SemiBold']">
            Take a break
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
