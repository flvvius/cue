export type ThresholdBucket = "safe" | "approaching" | "at_limit" | "exceeded";

export const APPROACHING_THRESHOLD = 0.8;
export const AT_LIMIT_THRESHOLD = 1;
export const EXCEEDED_THRESHOLD = 1.2;

export function resolveThresholdBucket(progress: number): ThresholdBucket {
  if (progress >= EXCEEDED_THRESHOLD) {
    return "exceeded";
  }

  if (progress >= AT_LIMIT_THRESHOLD) {
    return "at_limit";
  }

  if (progress >= APPROACHING_THRESHOLD) {
    return "approaching";
  }

  return "safe";
}
