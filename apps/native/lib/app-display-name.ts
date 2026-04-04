const genericSegments = new Set([
  "android",
  "app",
  "apps",
  "mobile",
  "client",
  "phone",
  "tablet",
  "debug",
  "release",
  "prod",
  "main",
]);

function prettifySegment(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function fallbackFromPackage(appPackage: string) {
  const selectedSegment = appPackage
    .split(".")
    .reverse()
    .find((segment) => segment && !genericSegments.has(segment.toLowerCase()));

  return prettifySegment(selectedSegment ?? appPackage.split(".").pop() ?? appPackage);
}

export function resolveDisplayAppName(appName?: string | null, appPackage?: string | null) {
  const normalizedName = appName?.trim() ?? "";

  if (
    normalizedName &&
    normalizedName.toLowerCase() !== "android" &&
    !normalizedName.includes(".")
  ) {
    return normalizedName;
  }

  if (appPackage?.trim()) {
    return fallbackFromPackage(appPackage.trim());
  }

  return normalizedName || "This app";
}
