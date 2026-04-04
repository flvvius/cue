import { requireOptionalNativeModule } from "expo";

export type CueUsageAccessNativeModule = {
  isUsageAccessGranted(): boolean;
  openUsageAccessSettings(): Promise<void>;
  getRecentlyUsedApps(sinceMs: number, limit: number): Promise<{
    appPackage: string;
    appName: string;
    lastTimeUsed: number;
    totalTimeInForegroundMs: number;
    isSystemApp: boolean;
  }[]>;
  getUsageEvents(sinceMs: number, limit: number): Promise<{
    appPackage: string;
    appName: string;
    timestamp: number;
    eventType: "foreground" | "background";
    isSystemApp: boolean;
  }[]>;
};

export default requireOptionalNativeModule<CueUsageAccessNativeModule>("CueUsageAccess");
