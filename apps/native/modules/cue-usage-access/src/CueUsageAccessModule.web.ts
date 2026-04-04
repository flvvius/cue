import type { CueUsageAccessNativeModule } from "./CueUsageAccessModule";

const CueUsageAccessModule: CueUsageAccessNativeModule = {
  isUsageAccessGranted() {
    return false;
  },
  async openUsageAccessSettings() {},
  async getRecentlyUsedApps() {
    return [];
  },
};

export default CueUsageAccessModule;
