import { api } from "@cue/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { Text, View } from "react-native";

import { Container } from "@/components/container";
import { useEnforcementPreview } from "@/lib/enforcement-preview";

export default function Home() {
  const overview = useQuery(api.dashboard.overviewForCurrentUser);
  const enforcementPreview = useEnforcementPreview();

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
              {overview?.monitoredApps.reduce((sum, app) => sum + app.totalMinutes, 0) ?? 0} min
            </Text>
            <Text className="mt-1 text-secondary text-sm font-['Inter_400Regular']">
              Across {overview?.monitoredApps.reduce((sum, app) => sum + app.sessionCount, 0) ?? 0} sessions
            </Text>
          </View>

          <View className="flex-1 rounded-2xl border border-brand/30 bg-brand/12 p-5">
            <Text className="text-accent text-xs uppercase tracking-[1.4px] font-['Inter_600SemiBold']">
              Default limit
            </Text>
            <Text className="mt-2 text-foreground text-2xl font-['Inter_700Bold']">
              {overview?.defaultLimitMinutes ?? 0} min
            </Text>
            <Text className="mt-1 text-secondary text-sm font-['Inter_400Regular']">
              Fallback before AI recommendations
            </Text>
          </View>
        </View>

        <View className="rounded-2xl border border-border bg-surface p-5">
          <Text className="text-secondary text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
            Monitored apps
          </Text>
          <Text className="mt-2 text-foreground text-2xl font-['Inter_600SemiBold']">
            Progress against limits
          </Text>
          <View className="mt-4 gap-4">
            {overview?.monitoredApps.length ? (
              overview.monitoredApps.map((app) => (
                <View key={app.appPackage}>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-foreground text-base font-['Inter_600SemiBold']">
                      {app.appName}
                    </Text>
                    <Text className="text-secondary text-sm font-['Inter_400Regular']">
                      {app.totalMinutes} / {app.limitMinutes} min
                    </Text>
                  </View>
                  <View className="mt-2 h-2 rounded-full bg-elevated overflow-hidden">
                    <View
                      className={app.isOverLimit ? "h-2 bg-danger" : "h-2 bg-success"}
                      style={{ width: `${Math.max(6, app.progressPercent)}%` }}
                    />
                  </View>
                </View>
              ))
            ) : (
              <Text className="text-secondary text-sm leading-6 font-['Inter_400Regular']">
                No monitored sessions yet. Use a few non-excluded apps, then return here.
              </Text>
            )}
          </View>
        </View>

        <View className="rounded-2xl border border-break/30 bg-break/12 p-5">
          <Text className="text-break text-sm font-['Inter_600SemiBold']">
            Nudge stats
          </Text>
          <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
            {overview?.nudgeStats.accepted ?? 0} accepted / {overview?.nudgeStats.dismissed ?? 0} dismissed
          </Text>
          <Text className="mt-2 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            The UI is ready for real nudge activity as soon as the enforcement loop starts writing records.
          </Text>
        </View>

        <View className="rounded-2xl border border-brand/30 bg-brand/12 p-5">
          <Text className="text-accent text-xs uppercase tracking-[1.4px] font-['Inter_600SemiBold']">
            Enforcement preview
          </Text>
          <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
            {enforcementPreview.activeSession
              ? `${enforcementPreview.activeSession.appName} is currently being tracked`
              : enforcementPreview.warmSession
                ? `${enforcementPreview.warmSession.appName} can resume without reset`
                : "No active monitored session right now"}
          </Text>
          <Text className="mt-2 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            {enforcementPreview.activeSession
              ? `${Math.round(enforcementPreview.activeSession.durationMs / 60000)} min so far against a ${enforcementPreview.activeSession.limitMinutes} min limit.`
              : enforcementPreview.warmSession
                ? `Reopening within ${Math.ceil(enforcementPreview.warmSession.graceRemainingMs / 1000)} seconds will continue the same session instead of resetting it.`
                : enforcementPreview.bridgeReady
                  ? "This turns the raw Android events into the local enforcement state the future nudge loop will use."
                  : "The raw-event bridge is not available in the current build yet."}
          </Text>

          {enforcementPreview.mergedSessions.length > 0 && (
            <View className="mt-4 gap-3">
              {enforcementPreview.mergedSessions.slice(0, 3).map((session) => (
                <View
                  key={`${session.appPackage}-${session.startTime}`}
                  className="rounded-2xl border border-border bg-surface px-4 py-4"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-foreground text-base font-['Inter_600SemiBold']">
                      {session.appName}
                    </Text>
                    <Text
                      className={`text-xs font-['Inter_600SemiBold'] ${
                        session.isExceeded
                          ? "text-danger"
                          : session.isAtLimit
                            ? "text-warning"
                            : session.isApproachingLimit
                              ? "text-accent"
                              : "text-success"
                      }`}
                    >
                      {session.isExceeded
                        ? "Exceeded"
                        : session.isAtLimit
                          ? "At limit"
                          : session.isApproachingLimit
                            ? "Approaching"
                            : "Safe"}
                    </Text>
                  </View>
                  <Text className="mt-1 text-secondary text-sm font-['Inter_400Regular']">
                    {Math.round(session.durationMs / 60000)} / {session.limitMinutes} min
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View className="rounded-2xl border border-border bg-surface p-5">
          <Text className="text-muted text-xs uppercase tracking-[1.4px] font-['Inter_600SemiBold']">
            Current streak
          </Text>
          <Text className="mt-2 text-foreground text-2xl font-['Inter_700Bold']">
            {overview?.currentStreakDays ?? 0} day
          </Text>
          <Text className="mt-2 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            A lightweight first streak model: one day if all monitored apps stayed within their current limits today.
          </Text>
        </View>
      </View>
    </Container>
  );
}
