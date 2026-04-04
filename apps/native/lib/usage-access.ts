import React from "react";
import { AppState, Platform } from "react-native";

import CueUsageAccessModule from "@/modules/cue-usage-access/src/CueUsageAccessModule";

export type RecentUsageApp = {
  appPackage: string;
  appName: string;
  lastTimeUsed: number;
  totalTimeInForegroundMs: number;
  isSystemApp: boolean;
};

export type RawUsageEvent = {
  appPackage: string;
  appName: string;
  timestamp: number;
  eventType: "foreground" | "background";
  isSystemApp: boolean;
};

export type BlockingConfig = {
  enabled: boolean;
  defaultLimitMinutes: number;
  excludedPackages: string[];
  sessionResetCutoffs: Record<string, number>;
  appLimits: {
    appPackage: string;
    appName: string;
    limitMinutes: number;
  }[];
  activeBreak?: {
    appPackage: string;
    endsAt: number;
  } | null;
};

type CueUsageAccessModuleShape = {
  isOverlayPermissionGranted?: () => boolean;
  isUsageAccessGranted?: () => boolean;
  openOverlaySettings?: () => Promise<void>;
  openUsageAccessSettings?: () => Promise<void>;
  setBlockingConfig?: (configJson: string) => Promise<void>;
  startBlockingMonitor?: () => Promise<void>;
  stopBlockingMonitor?: () => Promise<void>;
  getRecentlyUsedApps?: (
    sinceMs: number,
    limit: number,
  ) => Promise<RecentUsageApp[]>;
  getUsageEvents?: (
    sinceMs: number,
    limit: number,
  ) => Promise<RawUsageEvent[]>;
};

function getUsageAccessModule(): CueUsageAccessModuleShape | null {
  if (!CueUsageAccessModule) {
    return null;
  }

  const maybeModule = CueUsageAccessModule as CueUsageAccessModuleShape & {
    default?: CueUsageAccessModuleShape;
  };

  if (typeof maybeModule.getRecentlyUsedApps === "function") {
    return maybeModule;
  }

  if (maybeModule.default && typeof maybeModule.default.getRecentlyUsedApps === "function") {
    return maybeModule.default;
  }

  return maybeModule;
}

function hasUsageAccessMethods(module: CueUsageAccessModuleShape | null) {
  return Boolean(
    module &&
      typeof module.isUsageAccessGranted === "function" &&
      typeof module.openUsageAccessSettings === "function",
  );
}

function hasOverlayMethods(module: CueUsageAccessModuleShape | null) {
  return Boolean(
    module &&
      typeof module.isOverlayPermissionGranted === "function" &&
      typeof module.openOverlaySettings === "function",
  );
}

function hasBlockingMonitorMethods(module: CueUsageAccessModuleShape | null) {
  return Boolean(
    module &&
      typeof module.setBlockingConfig === "function" &&
      typeof module.startBlockingMonitor === "function" &&
      typeof module.stopBlockingMonitor === "function",
  );
}

function hasRecentAppsMethod(module: CueUsageAccessModuleShape | null) {
  return Boolean(module && typeof module.getRecentlyUsedApps === "function");
}

function hasUsageEventsMethod(module: CueUsageAccessModuleShape | null) {
  return Boolean(module && typeof module.getUsageEvents === "function");
}

type UsageAccessState = {
  granted: boolean;
  overlayGranted: boolean;
  isAvailable: boolean;
  overlayAvailable: boolean;
  isRelevant: boolean;
};

function readUsageAccessState(): UsageAccessState {
  if (Platform.OS !== "android") {
    return {
      granted: true,
      overlayGranted: true,
      isAvailable: false,
      overlayAvailable: false,
      isRelevant: false,
    };
  }

  const module = getUsageAccessModule();
  if (!hasUsageAccessMethods(module)) {
    return {
      granted: false,
      overlayGranted: hasOverlayMethods(module) ? module!.isOverlayPermissionGranted!() : false,
      isAvailable: false,
      overlayAvailable: hasOverlayMethods(module),
      isRelevant: true,
    };
  }

  return {
    granted: module!.isUsageAccessGranted!(),
    overlayGranted: hasOverlayMethods(module) ? module!.isOverlayPermissionGranted!() : false,
    isAvailable: true,
    overlayAvailable: hasOverlayMethods(module),
    isRelevant: true,
  };
}

export function useAndroidUsageAccess() {
  const [state, setState] = React.useState<UsageAccessState>(() => readUsageAccessState());

  const refresh = React.useCallback(() => {
    setState(readUsageAccessState());
  }, []);

  React.useEffect(() => {
    refresh();

    if (Platform.OS !== "android") {
      return;
    }

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        refresh();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refresh]);

  const openSettings = React.useCallback(async () => {
    const module = getUsageAccessModule();
    if (Platform.OS !== "android" || !hasUsageAccessMethods(module)) {
      return;
    }

    await module!.openUsageAccessSettings!();
  }, []);

  const openOverlaySettings = React.useCallback(async () => {
    const module = getUsageAccessModule();
    if (Platform.OS !== "android" || !hasOverlayMethods(module)) {
      return;
    }

    await module!.openOverlaySettings!();
  }, []);

  return {
    ...state,
    openSettings,
    openOverlaySettings,
    refresh,
  };
}

export async function getRecentlyUsedApps(options?: {
  days?: number;
  limit?: number;
}): Promise<RecentUsageApp[]> {
  const module = getUsageAccessModule();
  if (Platform.OS !== "android" || !hasRecentAppsMethod(module)) {
    return [];
  }

  const days = Math.max(1, options?.days ?? 7);
  const limit = Math.max(1, options?.limit ?? 24);
  const now = Date.now();
  const sinceMs = now - days * 24 * 60 * 60 * 1000;

  return await module!.getRecentlyUsedApps!(sinceMs, limit);
}

export function hasRecentAppsAccessBridge() {
  return hasRecentAppsMethod(getUsageAccessModule());
}

export async function getUsageEvents(options?: {
  hours?: number;
  limit?: number;
}): Promise<RawUsageEvent[]> {
  const module = getUsageAccessModule();
  if (Platform.OS !== "android" || !hasUsageEventsMethod(module)) {
    return [];
  }

  const hours = Math.max(1, options?.hours ?? 12);
  const limit = Math.max(1, options?.limit ?? 5000);
  const now = Date.now();
  const sinceMs = now - hours * 60 * 60 * 1000;

  return await module!.getUsageEvents!(sinceMs, limit);
}

export function hasUsageEventsBridge() {
  return hasUsageEventsMethod(getUsageAccessModule());
}

export async function setBlockingConfig(config: BlockingConfig) {
  const module = getUsageAccessModule();
  if (Platform.OS !== "android" || !hasBlockingMonitorMethods(module)) {
    return;
  }

  await module!.setBlockingConfig!(JSON.stringify(config));
}

export async function startBlockingMonitor() {
  const module = getUsageAccessModule();
  if (Platform.OS !== "android" || !hasBlockingMonitorMethods(module)) {
    return;
  }

  await module!.startBlockingMonitor!();
}

export async function stopBlockingMonitor() {
  const module = getUsageAccessModule();
  if (Platform.OS !== "android" || !hasBlockingMonitorMethods(module)) {
    return;
  }

  await module!.stopBlockingMonitor!();
}

export function hasBlockingMonitorBridge() {
  return hasBlockingMonitorMethods(getUsageAccessModule());
}
