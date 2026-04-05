import { api } from "@cue/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { Container } from "@/components/container";
import { useBreakState } from "@/contexts/break-state-context";
import { resolveDisplayAppName } from "@/lib/app-display-name";
import { useEnforcementPreview } from "@/lib/enforcement-preview";
import { formatDisplayLimitCompact, formatDisplayLimitMinutes } from "@/lib/limit-display";
import { hasBlockingMonitorBridge, useAndroidUsageAccess } from "@/lib/usage-access";

function formatBreakScheduleWindow(window: {
  from: string;
  to: string;
  breakAfterMinutes: number;
}) {
  return `${window.from}-${window.to} -> ${window.breakAfterMinutes}m break`;
}

export default function Home() {
  const overview = useQuery(api.dashboard.overviewForCurrentUser);
  const socialEvents = useQuery((api as any).socialEvents.recentForCurrentUser);
  const enforcementPreview = useEnforcementPreview();
  const usageAccess = useAndroidUsageAccess();
  const { activeBreak, isHydrated } = useBreakState();
  const [showExcludedApps, setShowExcludedApps] = React.useState(false);
  const monitoredApps = overview?.monitoredApps ?? [];
  const recommendations = overview?.recommendations ?? [];
  const excludedApps = overview?.excludedApps ?? [];
  const liveImpactEvents = socialEvents?.events ?? [];

  const acceptedNudges = overview?.nudgeStats.accepted ?? 0;
  const dismissedNudges = overview?.nudgeStats.dismissed ?? 0;
  const totalNudges = acceptedNudges + dismissedNudges;
  const acceptedRatio = totalNudges > 0
    ? Math.round((acceptedNudges / totalNudges) * 100)
    : 0;
  const todayMinutes = monitoredApps.reduce((sum: number, app: any) => sum + app.totalMinutes, 0);
  const todaySessions = monitoredApps.reduce((sum: number, app: any) => sum + app.sessionCount, 0);
  const fastTestModeActive = recommendations.some(
    (recommendation: any) => recommendation.sessionLimitMinutes <= 1,
  );
  const blockingBridgeReady = hasBlockingMonitorBridge();
  const blockerArmed = usageAccess.granted && usageAccess.overlayGranted && blockingBridgeReady && isHydrated;

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
              {todayMinutes} min
            </Text>
            <Text className="mt-1 text-secondary text-sm font-['Inter_400Regular']">
              Across {todaySessions} sessions
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
            {monitoredApps.length ? (
              monitoredApps.map((app: any) => (
                <View key={app.appPackage}>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-foreground text-base font-['Inter_600SemiBold']">
                      {resolveDisplayAppName(app.appName, app.appPackage)}
                    </Text>
                    <Text className="text-secondary text-sm font-['Inter_400Regular']">
                      {app.totalMinutes} / {formatDisplayLimitCompact(app.limitMinutes)}
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

        <View className="rounded-2xl border border-border bg-surface p-5">
          <Text className="text-secondary text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
            Current recommendations
          </Text>
          <Text className="mt-2 text-foreground text-2xl font-['Inter_600SemiBold']">
            Limits and break windows
          </Text>
          {fastTestModeActive ? (
            <View className="mt-4 rounded-2xl border border-warning/30 bg-warning/12 px-4 py-4">
              <Text className="text-warning text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
                Fast test mode
              </Text>
              <Text className="mt-2 text-sm leading-6 text-foreground font-['Inter_500Medium']">
                Cue is using temporary 1-minute limits so you can trigger nudges and blockers quickly. Restore fallback recs when you want normal demo values back.
              </Text>
            </View>
          ) : null}
          <View className="mt-4 gap-4">
            {recommendations.length ? (
              recommendations.map((recommendation: any) => (
                <View
                  key={`${recommendation.appPackage}-${recommendation.effectiveDate}`}
                  className="rounded-2xl border border-border bg-background px-4 py-4"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-foreground text-base font-['Inter_600SemiBold']">
                      {resolveDisplayAppName(recommendation.appName, recommendation.appPackage)}
                    </Text>
                    <Text className="text-accent text-sm font-['Inter_600SemiBold']">
                      {formatDisplayLimitCompact(recommendation.sessionLimitMinutes)}
                    </Text>
                  </View>
                  <Text className="mt-2 text-secondary text-sm leading-6 font-['Inter_400Regular']">
                    {recommendation.breakSchedule.length
                      ? recommendation.breakSchedule
                        .slice(0, 2)
                        .map(formatBreakScheduleWindow)
                        .join(" • ")
                      : "No active break windows. Default 5-minute fallback will apply."}
                  </Text>
                </View>
              ))
            ) : (
              <Text className="text-secondary text-sm leading-6 font-['Inter_400Regular']">
                No app-specific AI recommendations yet. Cue will fall back to your default limit for now.
              </Text>
            )}
          </View>
        </View>

        <View className="rounded-2xl border border-border bg-surface p-5">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-secondary text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
                Excluded apps
              </Text>
              <Text className="mt-2 text-foreground text-2xl font-['Inter_600SemiBold']">
                {excludedApps.length} apps ignored
              </Text>
            </View>
            <Pressable
              onPress={() => setShowExcludedApps((value) => !value)}
              className="rounded-full border border-border px-4 py-2"
            >
              <Text className="text-secondary text-sm font-['Inter_600SemiBold']">
                {showExcludedApps ? "Hide" : "Show"}
              </Text>
            </Pressable>
          </View>
          <Text className="mt-2 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            These apps are still synced to Convex, but they are skipped by local enforcement and nudges.
          </Text>
          {showExcludedApps ? (
            <View className="mt-4 gap-3">
              {excludedApps.length ? (
                excludedApps.map((app: any) => (
                  <View
                    key={app.appPackage}
                    className="rounded-2xl border border-border bg-background px-4 py-4"
                  >
                    <Text className="text-foreground text-base font-['Inter_600SemiBold']">
                      {resolveDisplayAppName(app.appName, app.appPackage)}
                    </Text>
                    <Text className="mt-1 text-secondary text-sm font-['Inter_400Regular']">
                      {app.appPackage}
                    </Text>
                  </View>
                ))
              ) : (
                <Text className="text-secondary text-sm leading-6 font-['Inter_400Regular']">
                  Nothing is excluded yet.
                </Text>
              )}
            </View>
          ) : null}
        </View>

        <View className="rounded-2xl border border-break/30 bg-break/12 p-5">
          <Text className="text-break text-sm font-['Inter_600SemiBold']">
            Nudge stats
          </Text>
          <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
            {acceptedNudges} accepted / {dismissedNudges} dismissed
          </Text>
          <Text className="mt-2 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            {totalNudges > 0
              ? `${acceptedRatio}% of today's nudges ended in a break instead of a dismissal.`
              : "The UI is ready for real nudge activity as soon as the enforcement loop starts writing records."}
          </Text>
          {totalNudges > 0 ? (
            <View className="mt-4 h-3 overflow-hidden rounded-full bg-surface">
              <View className="h-3 flex-row overflow-hidden rounded-full">
                <View
                  className="bg-success"
                  style={{ width: `${Math.max(8, acceptedRatio)}%` }}
                />
                <View
                  className="bg-danger"
                  style={{ width: `${Math.max(0, 100 - Math.max(8, acceptedRatio))}%` }}
                />
              </View>
            </View>
          ) : null}
        </View>

        <View className="rounded-2xl border border-danger/30 bg-danger/10 p-5">
          <Text className="text-danger text-xs uppercase tracking-[1.4px] font-['Inter_600SemiBold']">
            Buddy system
          </Text>
          <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
            Early break endings across the app
          </Text>
          <Text className="mt-2 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            Every connected device sees these in realtime. For the demo, this doubles as a live accountability feed.
          </Text>
          <View className="mt-4 gap-3">
            {liveImpactEvents.length ? (
              liveImpactEvents.slice(0, 5).map((event: any) => (
                <View
                  key={event._id}
                  className="rounded-2xl border border-border bg-background px-4 py-4"
                >
                  <Text className="text-foreground text-base font-['Inter_600SemiBold']">
                    {event.actorName} ended a break early
                  </Text>
                  <Text className="mt-1 text-secondary text-sm leading-6 font-['Inter_400Regular']">
                    {resolveDisplayAppName(event.appName, event.appPackage)}
                  </Text>
                  <Text className="mt-2 text-muted text-xs font-['Inter_400Regular']">
                    {new Date(event.createdAt).toLocaleTimeString()}
                  </Text>
                </View>
              ))
            ) : (
              <Text className="text-secondary text-sm leading-6 font-['Inter_400Regular']">
                No news from your buddies. End a break early on another signed-in device to see the feed light up.
              </Text>
            )}
          </View>
        </View>

        <View className="rounded-2xl border border-brand/30 bg-brand/12 p-5">
          <Text className="text-accent text-xs uppercase tracking-[1.4px] font-['Inter_600SemiBold']">
            Blocker status
          </Text>
          <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
            {blockerArmed
              ? activeBreak
                ? `Blocking is armed and break protection is active for ${resolveDisplayAppName(activeBreak.appName, activeBreak.appPackage)}`
                : "Blocking is armed for over-limit apps"
              : "Blocking still needs setup"}
          </Text>
          <Text className="mt-2 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            {blockerArmed
              ? activeBreak
                ? `Cue will keep ${resolveDisplayAppName(activeBreak.appName, activeBreak.appPackage)} blocked until the current break ends.`
                : "Usage access, overlay permission, and the native blocker bridge are all available."
              : !usageAccess.granted
                ? "Usage Access is still missing."
                : !usageAccess.overlayGranted
                  ? "Display-over-apps permission is still missing."
                  : !blockingBridgeReady
                    ? "This installed build does not include the native blocker module yet."
                    : !isHydrated
                      ? "Cue is still restoring break state from disk."
                      : "Cue is waiting for the rest of the blocker state to become ready."}
          </Text>
          <View className="mt-4 gap-2">
            <Text className="text-muted text-xs font-['Inter_500Medium']">
              Usage Access: {usageAccess.granted ? "granted" : "missing"}
            </Text>
            <Text className="text-muted text-xs font-['Inter_500Medium']">
              Display over apps: {usageAccess.overlayGranted ? "granted" : "missing"}
            </Text>
            <Text className="text-muted text-xs font-['Inter_500Medium']">
              Native blocker bridge: {blockingBridgeReady ? "ready" : "missing in this build"}
            </Text>
            <Text className="text-muted text-xs font-['Inter_500Medium']">
              Break state restored: {isHydrated ? "yes" : "loading"}
            </Text>
          </View>
        </View>

        <View className="rounded-2xl border border-brand/30 bg-brand/12 p-5">
          <Text className="text-accent text-xs uppercase tracking-[1.4px] font-['Inter_600SemiBold']">
            Enforcement preview
          </Text>
          <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
            {enforcementPreview.activeSession
              ? `${resolveDisplayAppName(enforcementPreview.activeSession.appName, enforcementPreview.activeSession.appPackage)} is currently being tracked`
              : enforcementPreview.warmSession
                ? `${resolveDisplayAppName(enforcementPreview.warmSession.appName, enforcementPreview.warmSession.appPackage)} can resume without reset`
                : "No active monitored session right now"}
          </Text>
          <Text className="mt-2 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            {enforcementPreview.activeSession
              ? `${Math.round(enforcementPreview.activeSession.durationMs / 60000)} min so far against a ${formatDisplayLimitMinutes(enforcementPreview.activeSession.limitMinutes)} limit.`
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
                      {resolveDisplayAppName(session.appName, session.appPackage)}
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
                    {Math.round(session.durationMs / 60000)} / {formatDisplayLimitCompact(session.limitMinutes)}
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
            {overview?.currentStreakDays
              ? "Today is currently clean across all monitored apps."
              : "A streak starts once every monitored app stays within its limit for the day."}
          </Text>
          <View className="mt-4 rounded-2xl border border-border bg-background px-4 py-4">
            <Text className="text-secondary text-sm font-['Inter_500Medium']">
              {overview?.currentStreakDays
                ? "Momentum is on your side. Keep nudges accepted and your monitored apps under their limits."
                : "One calm day is enough to start the streak. This makes the first win easy to explain in the demo."}
            </Text>
          </View>
        </View>
      </View>
    </Container>
  );
}
