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

type CueUsageAccessModuleShape = {
  isUsageAccessGranted?: () => boolean;
  openUsageAccessSettings?: () => Promise<void>;
  getRecentlyUsedApps?: (
    sinceMs: number,
    limit: number,
  ) => Promise<RecentUsageApp[]>;
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

function hasRecentAppsMethod(module: CueUsageAccessModuleShape | null) {
  return Boolean(module && typeof module.getRecentlyUsedApps === "function");
}

type UsageAccessState = {
  granted: boolean;
  isAvailable: boolean;
  isRelevant: boolean;
};

function readUsageAccessState(): UsageAccessState {
  if (Platform.OS !== "android") {
    return {
      granted: true,
      isAvailable: false,
      isRelevant: false,
    };
  }

  const module = getUsageAccessModule();
  if (!hasUsageAccessMethods(module)) {
    return {
      granted: false,
      isAvailable: false,
      isRelevant: true,
    };
  }

  return {
    granted: module!.isUsageAccessGranted!(),
    isAvailable: true,
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

  return {
    ...state,
    openSettings,
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
