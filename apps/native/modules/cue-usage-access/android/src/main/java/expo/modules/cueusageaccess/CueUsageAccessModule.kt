package expo.modules.cueusageaccess

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import java.util.Locale

class CueUsageAccessModule : Module() {
  private fun prettifyFallbackSegment(rawSegment: String): String {
    return rawSegment
      .replace('_', ' ')
      .replace('-', ' ')
      .split(' ')
      .filter { it.isNotBlank() }
      .joinToString(" ") { segment ->
        segment.replaceFirstChar { character ->
          if (character.isLowerCase()) {
            character.titlecase(Locale.ROOT)
          } else {
            character.toString()
          }
        }
      }
  }

  private fun fallbackAppName(packageName: String): String {
    val genericSegments = setOf(
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
    )

    val selectedSegment = packageName
      .split('.')
      .asReversed()
      .firstOrNull { segment ->
        segment.isNotBlank() && segment.lowercase(Locale.ROOT) !in genericSegments
      }
      ?: packageName.substringAfterLast('.', packageName)

    return prettifyFallbackSegment(selectedSegment).ifBlank { packageName }
  }

  private fun resolveAppInfo(context: Context, packageName: String): Map<String, Any>? {
    return try {
      val applicationInfo = context.packageManager.getApplicationInfo(packageName, 0)
      val resolvedLabel = context.packageManager.getApplicationLabel(applicationInfo).toString().trim()
      val appName = if (resolvedLabel.isBlank()) fallbackAppName(packageName) else resolvedLabel
      val isSystemApp =
        (applicationInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0 ||
          (applicationInfo.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0

      mapOf(
        "appName" to appName,
        "isSystemApp" to isSystemApp,
      )
    } catch (_: Exception) {
      mapOf(
        "appName" to fallbackAppName(packageName),
        "isSystemApp" to false,
      )
    }
  }

  private fun normalizeEventType(eventType: Int): String? {
    return when (eventType) {
      UsageEvents.Event.ACTIVITY_RESUMED,
      UsageEvents.Event.MOVE_TO_FOREGROUND -> "foreground"

      UsageEvents.Event.ACTIVITY_PAUSED,
      UsageEvents.Event.ACTIVITY_STOPPED,
      UsageEvents.Event.MOVE_TO_BACKGROUND -> "background"

      else -> null
    }
  }

  internal fun hasUsageAccess(context: Context): Boolean {
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

    Function("isOverlayPermissionGranted") {
      val context = appContext.reactContext?.applicationContext
        ?: throw IllegalStateException("React context is not available")

      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
        true
      } else {
        Settings.canDrawOverlays(context)
      }
    }

    Function("isUsageAccessGranted") {
      val context = appContext.reactContext?.applicationContext
        ?: throw IllegalStateException("React context is not available")

      hasUsageAccess(context)
    }

    Function("getBlockingSnapshot") {
      val context = appContext.reactContext?.applicationContext
        ?: throw IllegalStateException("React context is not available")

      CueBlockingConfigStore.loadSnapshot(context)?.let { snapshot ->
        mapOf(
          "appPackage" to snapshot.appPackage,
          "appName" to snapshot.appName,
          "limitMinutes" to snapshot.limitMinutes,
          "sessionStartTime" to snapshot.sessionStartTime,
          "blockedAt" to snapshot.blockedAt,
          "thresholdBucket" to snapshot.thresholdBucket,
          "reason" to snapshot.reason,
        )
      }
    }

    AsyncFunction("openUsageAccessSettings") {
      val context = appContext.reactContext?.applicationContext
        ?: throw IllegalStateException("React context is not available")

      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }

      context.startActivity(intent)
    }

    AsyncFunction("openOverlaySettings") {
      val context = appContext.reactContext?.applicationContext
        ?: throw IllegalStateException("React context is not available")

      val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:${context.packageName}")
      ).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }

      context.startActivity(intent)
    }

    AsyncFunction("setBlockingConfig") { configJson: String ->
      val context = appContext.reactContext?.applicationContext
        ?: throw IllegalStateException("React context is not available")

      CueBlockingConfigStore.save(context, configJson)
    }

    AsyncFunction("startBlockingMonitor") {
      val context = appContext.reactContext?.applicationContext
        ?: throw IllegalStateException("React context is not available")

      CueBlockingMonitorService.start(context)
    }

    AsyncFunction("stopBlockingMonitor") {
      val context = appContext.reactContext?.applicationContext
        ?: throw IllegalStateException("React context is not available")

      CueBlockingMonitorService.stop(context)
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
      val now = System.currentTimeMillis()
      val startTime = sinceMs.toLong().coerceAtMost(now)

      val recentApps = usageStatsManager
        .queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startTime, now)
        .asSequence()
        .filter { usageStat ->
          usageStat.packageName != context.packageName &&
            usageStat.lastTimeUsed >= startTime
        }
        .mapNotNull { usageStat ->
          val appInfo = resolveAppInfo(context, usageStat.packageName) ?: return@mapNotNull null
          val appName = appInfo["appName"] as String
          val isSystemApp = appInfo["isSystemApp"] as Boolean

          mapOf(
            "appPackage" to usageStat.packageName,
            "appName" to appName,
            "lastTimeUsed" to usageStat.lastTimeUsed,
            "totalTimeInForegroundMs" to usageStat.totalTimeInForeground,
            "isSystemApp" to isSystemApp,
            "sortKey" to appName.lowercase(Locale.ROOT),
          )
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

    AsyncFunction("getUsageEvents") { sinceMs: Double, limit: Int ->
      val context = appContext.reactContext?.applicationContext
        ?: throw IllegalStateException("React context is not available")

      if (!hasUsageAccess(context)) {
        return@AsyncFunction emptyList<Map<String, Any>>()
      }

      val usageStatsManager =
        context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
          ?: return@AsyncFunction emptyList<Map<String, Any>>()

      val now = System.currentTimeMillis()
      val startTime = sinceMs.toLong().coerceAtMost(now)
      val usageEvents = usageStatsManager.queryEvents(startTime, now)
      val event = UsageEvents.Event()
      val appInfoCache = mutableMapOf<String, Map<String, Any>?>()
      val rawEvents = mutableListOf<Map<String, Any>>()
      val safeLimit = limit.coerceAtLeast(1)

      while (usageEvents.hasNextEvent()) {
        usageEvents.getNextEvent(event)

        val packageName = event.packageName ?: continue
        if (packageName == context.packageName) {
          continue
        }

        val normalizedEventType = normalizeEventType(event.eventType) ?: continue
        val appInfo = appInfoCache.getOrPut(packageName) {
          resolveAppInfo(context, packageName)
        } ?: continue

        rawEvents.add(
          mapOf(
            "appPackage" to packageName,
            "appName" to (appInfo["appName"] as String),
            "timestamp" to event.timeStamp,
            "eventType" to normalizedEventType,
            "isSystemApp" to (appInfo["isSystemApp"] as Boolean),
          )
        )
      }

      rawEvents
        .takeLast(safeLimit)
        .sortedBy { it["timestamp"] as Long }
    }
  }
}
