import { api } from "@cue/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { Text, View } from "react-native";

import { Container } from "@/components/container";

export default function TabTwo() {
  const usageSummary = useQuery(api.usageSessions.summaryForCurrentUser);

  return (
    <Container className="bg-background px-5 py-8">
      <View className="flex-1 gap-4">
        <View className="rounded-2xl border border-border bg-surface p-5">
          <Text className="text-secondary text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
            History
          </Text>
          <Text className="mt-2 text-foreground text-2xl font-['Inter_600SemiBold']">
            Recent sessions
          </Text>
          <Text className="mt-3 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            This is the first real history surface. It uses the synced session data and gives you a quick read on what the device has already sent to Convex.
          </Text>
        </View>

        {usageSummary?.recentSessions?.length ? (
          usageSummary.recentSessions.map((session) => (
            <View
              key={`${session.appPackage}-${session.startTime}`}
              className="rounded-2xl border border-border bg-surface p-5"
            >
              <Text className="text-foreground text-lg font-['Inter_600SemiBold']">
                {session.appName}
              </Text>
              <Text className="mt-1 text-muted text-xs font-['Inter_400Regular']">
                {session.appPackage}
              </Text>
              <View className="mt-3 flex-row items-center justify-between">
                <Text className="text-secondary text-sm font-['Inter_400Regular']">
                  {Math.round(session.durationMs / 60000)} min
                </Text>
                <Text className="text-secondary text-sm font-['Inter_400Regular']">
                  {new Date(session.startTime).toLocaleTimeString()}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View className="rounded-2xl border border-accent/30 bg-accent/10 p-5">
            <Text className="text-accent text-sm font-['Inter_600SemiBold']">
              Waiting for data
            </Text>
            <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
              No synced sessions yet
            </Text>
            <Text className="mt-2 text-secondary text-sm leading-6 font-['Inter_400Regular']">
              Once the rebuilt Android dev client starts syncing raw usage events, this screen will fill with recent sessions automatically.
            </Text>
          </View>
        )}
      </View>
    </Container>
  );
}
