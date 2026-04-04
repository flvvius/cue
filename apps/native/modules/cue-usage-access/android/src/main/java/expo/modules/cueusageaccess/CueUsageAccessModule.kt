package expo.modules.cueusageaccess

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.os.Build
import android.os.Process
import android.provider.Settings
import java.util.Locale

class CueUsageAccessModule : Module() {
  private fun hasUsageAccess(context: Context): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as? AppOpsManager ?: return false

    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        context.packageName
      )
    } else {
      @Suppress("DEPRECATION")
      appOps.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        context.packageName
      )
    }

    return mode == AppOpsManager.MODE_ALLOWED
  }

  override fun definition() = ModuleDefinition {
    Name("CueUsageAccess")

    Function("isUsageAccessGranted") {
      val context = appContext.reactContext?.applicationContext
        ?: throw IllegalStateException("React context is not available")

      hasUsageAccess(context)
    }

    AsyncFunction("openUsageAccessSettings") {
      val context = appContext.reactContext?.applicationContext
        ?: throw IllegalStateException("React context is not available")

      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }

      context.startActivity(intent)
    }

    AsyncFunction("getRecentlyUsedApps") { sinceMs: Double, limit: Int ->
      val context = appContext.reactContext?.applicationContext
        ?: throw IllegalStateException("React context is not available")

      if (!hasUsageAccess(context)) {
        return@AsyncFunction emptyList<Map<String, Any>>()
      }

      val usageStatsManager =
        context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
          ?: return@AsyncFunction emptyList<Map<String, Any>>()
      val packageManager = context.packageManager
      val now = System.currentTimeMillis()
      val startTime = sinceMs.toLong().coerceAtMost(now)

      val recentApps = usageStatsManager
        .queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startTime, now)
        .asSequence()
        .filter { usageStat ->
          usageStat.packageName != context.packageName &&
            usageStat.lastTimeUsed > 0 &&
            usageStat.totalTimeInForeground > 0
        }
        .mapNotNull { usageStat ->
          try {
            val applicationInfo = packageManager.getApplicationInfo(usageStat.packageName, 0)
            val appName = packageManager.getApplicationLabel(applicationInfo).toString().trim()
            val isSystemApp =
              (applicationInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0 ||
                (applicationInfo.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0

            if (appName.isBlank()) {
              null
            } else {
              mapOf(
                "appPackage" to usageStat.packageName,
                "appName" to appName,
                "lastTimeUsed" to usageStat.lastTimeUsed,
                "totalTimeInForegroundMs" to usageStat.totalTimeInForeground,
                "isSystemApp" to isSystemApp,
                "sortKey" to appName.lowercase(Locale.ROOT),
              )
            }
          } catch (_: Exception) {
            null
          }
        }
        .groupBy { it["appPackage"] as String }
        .values
        .map { entries ->
          entries.maxByOrNull { (it["lastTimeUsed"] as Long) }!!
        }
        .sortedByDescending { it["lastTimeUsed"] as Long }
        .take(limit.coerceAtLeast(1))
        .map { app ->
          app.filterKeys { key -> key != "sortKey" }
        }
        .toList()

      recentApps
    }
  }
}
