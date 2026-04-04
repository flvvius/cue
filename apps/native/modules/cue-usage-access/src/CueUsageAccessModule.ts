import { requireOptionalNativeModule } from "expo";

export type CueUsageAccessNativeModule = {
  isOverlayPermissionGranted(): boolean;
  isUsageAccessGranted(): boolean;
  openOverlaySettings(): Promise<void>;
  openUsageAccessSettings(): Promise<void>;
  setBlockingConfig(configJson: string): Promise<void>;
  startBlockingMonitor(): Promise<void>;
  stopBlockingMonitor(): Promise<void>;
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
