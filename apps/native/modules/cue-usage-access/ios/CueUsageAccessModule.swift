import ExpoModulesCore

public class CueUsageAccessModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CueUsageAccess")

    Function("isUsageAccessGranted") {
      false
    }

    AsyncFunction("openUsageAccessSettings") {
      return
    }

    AsyncFunction("getRecentlyUsedApps") { (_: Double, _: Int) -> [[String: Any]] in
      []
    }
  }
}
