type BreakWindow = {
  from: string;
  to: string;
  breakAfterMinutes: number;
};

type RecommendationLike = {
  breakSchedule?: BreakWindow[];
};

function parseClockValue(value: string) {
  const [hourText, minuteText] = value.split(":");
  const hours = Number(hourText);
  const minutes = Number(minuteText);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
}

function matchesWindow(nowMinutes: number, window: BreakWindow) {
  const startMinutes = parseClockValue(window.from);
  const endMinutes = parseClockValue(window.to);

  if (startMinutes === null || endMinutes === null) {
    return false;
  }

  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }

  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

export function resolveBreakDurationMinutes(
  recommendation?: RecommendationLike | null,
  now = new Date(),
) {
  const breakSchedule = recommendation?.breakSchedule ?? [];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const matchingWindow = breakSchedule.find((window) => matchesWindow(nowMinutes, window));

  return matchingWindow?.breakAfterMinutes ?? 5;
}
