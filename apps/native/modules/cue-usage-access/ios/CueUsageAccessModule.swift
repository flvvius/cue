import ExpoModulesCore

public class CueUsageAccessModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CueUsageAccess")

    Function("isOverlayPermissionGranted") {
      false
    }

    Function("isUsageAccessGranted") {
      false
    }

    AsyncFunction("openOverlaySettings") {
      return
    }

    AsyncFunction("openUsageAccessSettings") {
      return
    }

    AsyncFunction("setBlockingConfig") { (_: String) in
      return
    }

    AsyncFunction("startBlockingMonitor") {
      return
    }

    AsyncFunction("stopBlockingMonitor") {
      return
    }

    AsyncFunction("getRecentlyUsedApps") { (_: Double, _: Int) -> [[String: Any]] in
      []
    }

    AsyncFunction("getUsageEvents") { (_: Double, _: Int) -> [[String: Any]] in
      []
    }
  }
}
