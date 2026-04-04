import { api } from "@cue/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { Pressable } from "react-native";

import { Container } from "@/components/container";
import { useBreakState } from "@/contexts/break-state-context";

export default function TabTwo() {
  const usageSummary = useQuery(api.usageSessions.summaryForCurrentUser);
  const breakSummary = useQuery(api.breaks.recentForCurrentUser);
  const { activeBreak } = useBreakState();
  const router = useRouter();

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

        {activeBreak ? (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/break-timer",
                params: {
                  appPackage: activeBreak.appPackage,
                  appName: activeBreak.appName,
                  alternative: activeBreak.alternative ?? undefined,
                  durationMinutes: String(activeBreak.durationMinutes),
                  endsAt: String(activeBreak.endsAt),
                },
              })
            }
            className="rounded-2xl border border-break/30 bg-break/12 p-5"
            style={({ pressed }) => [{ opacity: pressed ? 0.94 : 1 }]}
          >
            <Text className="text-break text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
              Break protection
            </Text>
            <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
              {activeBreak.appName} is currently blocked
            </Text>
            <Text className="mt-2 text-secondary text-sm leading-6 font-['Inter_400Regular']">
              Cue is holding the reset for {activeBreak.durationMinutes} minutes. Tap to reopen the timer and finish the break cleanly.
            </Text>
          </Pressable>
        ) : null}

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

        <View className="rounded-2xl border border-border bg-surface p-5">
          <Text className="text-secondary text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
            Break history
          </Text>
          <Text className="mt-2 text-foreground text-2xl font-['Inter_600SemiBold']">
            Recent resets
          </Text>
          <Text className="mt-3 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            Every accepted break now leaves a trail, so you can see which apps were interrupted and whether the reset finished cleanly.
          </Text>
          <View className="mt-4 gap-3">
            {breakSummary?.recentBreaks?.length ? (
              breakSummary.recentBreaks.map((item) => (
                <View
                  key={String(item._id)}
                  className="rounded-2xl border border-border bg-background px-4 py-4"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-foreground text-base font-['Inter_600SemiBold']">
                      {item.appName}
                    </Text>
                    <Text
                      className={`text-xs font-['Inter_600SemiBold'] ${
                        item.finishedAt
                          ? item.endedEarly
                            ? "text-warning"
                            : "text-success"
                          : "text-break"
                      }`}
                    >
                      {item.finishedAt
                        ? item.endedEarly
                          ? "Ended early"
                          : "Completed"
                        : "Active"}
                    </Text>
                  </View>
                  <Text className="mt-1 text-secondary text-sm font-['Inter_400Regular']">
                    {item.durationMinutes} min break
                    {item.alternative ? ` • ${item.alternative}` : ""}
                  </Text>
                  <Text className="mt-2 text-muted text-xs font-['Inter_400Regular']">
                    Started {new Date(item.startedAt).toLocaleTimeString()}
                  </Text>
                </View>
              ))
            ) : (
              <Text className="text-secondary text-sm leading-6 font-['Inter_400Regular']">
                No breaks recorded yet. Accept one nudge and finish the timer to start building this history.
              </Text>
            )}
          </View>
        </View>
      </View>
    </Container>
  );
}
