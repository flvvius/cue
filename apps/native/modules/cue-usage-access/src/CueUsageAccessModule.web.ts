import type { CueUsageAccessNativeModule } from "./CueUsageAccessModule";

const CueUsageAccessModule: CueUsageAccessNativeModule = {
  isOverlayPermissionGranted() {
    return false;
  },
  isUsageAccessGranted() {
    return false;
  },
  async openOverlaySettings() {},
  async openUsageAccessSettings() {},
  async setBlockingConfig() {},
  async startBlockingMonitor() {},
  async stopBlockingMonitor() {},
  async getRecentlyUsedApps() {
    return [];
  },
  async getUsageEvents() {
    return [];
  },
};

export default CueUsageAccessModule;
