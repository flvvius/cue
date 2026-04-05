export function formatDisplayLimitMinutes(limitMinutes: number | null | undefined) {
  if (typeof limitMinutes !== "number" || !Number.isFinite(limitMinutes)) {
    return "0 minutes";
  }

  if (limitMinutes <= 1) {
    return "1 minute";
  }

  const rounded = Number.isInteger(limitMinutes) ? limitMinutes : Math.round(limitMinutes * 10) / 10;
  return `${rounded} ${rounded === 1 ? "minute" : "minutes"}`;
}

export function formatDisplayLimitCompact(limitMinutes: number | null | undefined) {
  if (typeof limitMinutes !== "number" || !Number.isFinite(limitMinutes)) {
    return "0 min";
  }

  if (limitMinutes <= 1) {
    return "1 min";
  }

  const rounded = Number.isInteger(limitMinutes) ? limitMinutes : Math.round(limitMinutes * 10) / 10;
  return `${rounded} min`;
}
