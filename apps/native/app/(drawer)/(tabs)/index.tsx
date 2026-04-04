import { api } from "@cue/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { Text, View } from "react-native";

import { Container } from "@/components/container";

export default function Home() {
  const usageSummary = useQuery(api.usageSessions.summaryForCurrentUser);
  const currentUser = useQuery(api.users.current);

  return (
    <Container className="bg-background px-5 py-8">
      <View className="flex-1 gap-4">
        <View className="rounded-2xl border border-border bg-surface p-5">
          <Text className="text-secondary text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
            Dashboard
          </Text>
          <Text className="mt-2 text-foreground text-2xl font-['Inter_600SemiBold']">
            Today at a glance
          </Text>
          <Text className="mt-3 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            A simple home for today’s usage totals, default limit, and the state of the local enforcement pipeline.
          </Text>
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1 rounded-2xl border border-border bg-surface p-5">
            <Text className="text-muted text-xs uppercase tracking-[1.4px] font-['Inter_600SemiBold']">
              Today
            </Text>
            <Text className="mt-2 text-foreground text-2xl font-['Inter_700Bold']">
              {usageSummary?.todayTotalMinutes ?? 0} min
            </Text>
            <Text className="mt-1 text-secondary text-sm font-['Inter_400Regular']">
              Across {usageSummary?.todaySessionCount ?? 0} sessions
            </Text>
          </View>

          <View className="flex-1 rounded-2xl border border-brand/30 bg-brand/12 p-5">
            <Text className="text-accent text-xs uppercase tracking-[1.4px] font-['Inter_600SemiBold']">
              Default limit
            </Text>
            <Text className="mt-2 text-foreground text-2xl font-['Inter_700Bold']">
              {currentUser?.defaultSessionLimitMinutes ?? 0} min
            </Text>
            <Text className="mt-1 text-secondary text-sm font-['Inter_400Regular']">
              Fallback before AI recommendations
            </Text>
          </View>
        </View>

        <View className="rounded-2xl border border-break/30 bg-break/12 p-5">
          <Text className="text-break text-sm font-['Inter_600SemiBold']">
            Next milestone
          </Text>
          <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
            Real nudges and break timer
          </Text>
          <Text className="mt-2 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            The local usage pipeline is in place. The next visible leap is threshold-based nudges and a full-screen cooldown flow.
          </Text>
        </View>
      </View>
    </Container>
  );
}
