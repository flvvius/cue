package expo.modules.cueusageaccess

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

private const val PREFS_NAME = "cue_usage_access_prefs"
private const val PREF_BLOCKING_CONFIG = "blocking_config_json"
private const val PREF_BLOCKING_SNAPSHOT = "blocking_snapshot_json"

data class BlockingRule(
  val appPackage: String,
  val appName: String,
  val limitMinutes: Double,
)

data class ActiveBreakConfig(
  val appPackage: String,
  val endsAt: Long,
)

data class BlockingConfig(
  val enabled: Boolean,
  val defaultLimitMinutes: Double,
  val rulesByPackage: Map<String, BlockingRule>,
  val excludedPackages: Set<String>,
  val sessionResetCutoffs: Map<String, Long>,
  val activeBreak: ActiveBreakConfig?,
)

data class BlockingSnapshot(
  val appPackage: String,
  val appName: String,
  val limitMinutes: Double,
  val sessionStartTime: Long,
  val blockedAt: Long,
  val thresholdBucket: String,
  val reason: String,
)

object CueBlockingConfigStore {
  fun save(context: Context, configJson: String) {
    context
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(PREF_BLOCKING_CONFIG, configJson)
      .apply()
  }

  fun clear(context: Context) {
    context
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .remove(PREF_BLOCKING_CONFIG)
      .apply()
  }

  fun saveSnapshot(context: Context, snapshot: BlockingSnapshot) {
    val payload = JSONObject()
      .put("appPackage", snapshot.appPackage)
      .put("appName", snapshot.appName)
      .put("limitMinutes", snapshot.limitMinutes)
      .put("sessionStartTime", snapshot.sessionStartTime)
      .put("blockedAt", snapshot.blockedAt)
      .put("thresholdBucket", snapshot.thresholdBucket)
      .put("reason", snapshot.reason)

    context
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(PREF_BLOCKING_SNAPSHOT, payload.toString())
      .apply()
  }

  fun clearSnapshot(context: Context) {
    context
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .remove(PREF_BLOCKING_SNAPSHOT)
      .apply()
  }

  fun loadSnapshot(context: Context): BlockingSnapshot? {
    val rawJson = context
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getString(PREF_BLOCKING_SNAPSHOT, null)
      ?: return null

    return runCatching {
      parseSnapshot(rawJson)
    }.getOrNull()
  }

  fun load(context: Context): BlockingConfig? {
    val rawJson = context
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getString(PREF_BLOCKING_CONFIG, null)
      ?: return null

    return runCatching {
      parse(rawJson)
    }.getOrNull()
  }

  private fun parse(rawJson: String): BlockingConfig {
    val payload = JSONObject(rawJson)
    val rules = mutableMapOf<String, BlockingRule>()
    val limits = payload.optJSONArray("appLimits") ?: JSONArray()

    for (index in 0 until limits.length()) {
      val item = limits.optJSONObject(index) ?: continue
      val appPackage = item.optString("appPackage").trim()
      if (appPackage.isBlank()) {
        continue
      }

      rules[appPackage] = BlockingRule(
        appPackage = appPackage,
        appName = item.optString("appName", appPackage).trim().ifBlank { appPackage },
        limitMinutes = item.optDouble("limitMinutes", payload.optDouble("defaultLimitMinutes", 20.0)).coerceAtLeast(0.05),
      )
    }

    val excludedPackages = mutableSetOf<String>()
    val excludedArray = payload.optJSONArray("excludedPackages") ?: JSONArray()
    for (index in 0 until excludedArray.length()) {
      val appPackage = excludedArray.optString(index).trim()
      if (appPackage.isNotBlank()) {
        excludedPackages.add(appPackage)
      }
    }

    val sessionResetCutoffs = mutableMapOf<String, Long>()
    val resetCutoffPayload = payload.optJSONObject("sessionResetCutoffs")
    if (resetCutoffPayload != null) {
      val iterator = resetCutoffPayload.keys()
      while (iterator.hasNext()) {
        val key = iterator.next()
        val value = resetCutoffPayload.optLong(key, 0L)
        if (key.isNotBlank() && value > 0L) {
          sessionResetCutoffs[key] = value
        }
      }
    }

    val activeBreakPayload = payload.optJSONObject("activeBreak")
    val activeBreak = activeBreakPayload
      ?.takeIf { it.optString("appPackage").isNotBlank() && it.optLong("endsAt", 0L) > 0L }
      ?.let {
        ActiveBreakConfig(
          appPackage = it.optString("appPackage"),
          endsAt = it.optLong("endsAt"),
        )
      }

    return BlockingConfig(
      enabled = payload.optBoolean("enabled", true),
      defaultLimitMinutes = payload.optDouble("defaultLimitMinutes", 20.0).coerceAtLeast(0.05),
      rulesByPackage = rules,
      excludedPackages = excludedPackages,
      sessionResetCutoffs = sessionResetCutoffs,
      activeBreak = activeBreak,
    )
  }

  private fun parseSnapshot(rawJson: String): BlockingSnapshot {
    val payload = JSONObject(rawJson)
    return BlockingSnapshot(
      appPackage = payload.optString("appPackage"),
      appName = payload.optString("appName"),
      limitMinutes = payload.optDouble("limitMinutes", 1.0).coerceAtLeast(0.05),
      sessionStartTime = payload.optLong("sessionStartTime", 0L),
      blockedAt = payload.optLong("blockedAt", 0L),
      thresholdBucket = payload.optString("thresholdBucket", "at_limit"),
      reason = payload.optString("reason", "limit"),
    )
  }
}
