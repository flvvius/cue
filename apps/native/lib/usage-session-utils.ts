import type { RawUsageEvent } from "@/lib/usage-access";

export type ComputedUsageSession = {
  appPackage: string;
  appName: string;
  startTime: number;
  endTime: number;
  durationMs: number;
};

export function computeSessionsFromUsageEvents(
  events: RawUsageEvent[],
  minimumDurationMs = 2000,
): ComputedUsageSession[] {
  const sortedEvents = [...events].sort((left, right) => left.timestamp - right.timestamp);
  const activeSessions = new Map<string, RawUsageEvent>();
  const sessions: ComputedUsageSession[] = [];

  for (const event of sortedEvents) {
    const activeSession = activeSessions.get(event.appPackage);

    if (event.eventType === "foreground") {
      if (!activeSession || event.timestamp >= activeSession.timestamp) {
        activeSessions.set(event.appPackage, event);
      }
      continue;
    }

    if (!activeSession) {
      continue;
    }

    const durationMs = event.timestamp - activeSession.timestamp;
    activeSessions.delete(event.appPackage);

    if (durationMs < minimumDurationMs) {
      continue;
    }

    sessions.push({
      appPackage: event.appPackage,
      appName: activeSession.appName,
      startTime: activeSession.timestamp,
      endTime: event.timestamp,
      durationMs,
    });
  }

  return sessions;
}

export function mergeSessionsForEnforcement(
  sessions: ComputedUsageSession[],
  mergeWindowMs = 2 * 60 * 1000,
): ComputedUsageSession[] {
  const groupedSessions = new Map<string, ComputedUsageSession[]>();

  for (const session of sessions) {
    const existingSessions = groupedSessions.get(session.appPackage) ?? [];
    existingSessions.push(session);
    groupedSessions.set(session.appPackage, existingSessions);
  }

  return [...groupedSessions.values()]
    .flatMap((group) => {
      const sortedGroup = [...group].sort((left, right) => left.startTime - right.startTime);
      const mergedGroup: ComputedUsageSession[] = [];

      for (const session of sortedGroup) {
        const previousSession = mergedGroup[mergedGroup.length - 1];

        if (!previousSession) {
          mergedGroup.push({ ...session });
          continue;
        }

        if (session.startTime - previousSession.endTime <= mergeWindowMs) {
          previousSession.endTime = Math.max(previousSession.endTime, session.endTime);
          previousSession.durationMs = previousSession.endTime - previousSession.startTime;
          continue;
        }

        mergedGroup.push({ ...session });
      }

      return mergedGroup;
    })
    .sort((left, right) => right.endTime - left.endTime);
}
