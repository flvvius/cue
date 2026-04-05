package expo.modules.cueusageaccess

import android.app.AppOpsManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.pm.ServiceInfo
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.os.Process
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.core.app.ServiceCompat
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

private const val BLOCKING_CHANNEL_ID = "cue-blocking-monitor"
private const val BLOCKING_NOTIFICATION_ID = 33014
private const val MERGE_WINDOW_MS = 2 * 60 * 1000L

private fun formatLimitLabel(limitMinutes: Double): String {
  return if (limitMinutes < 1.0) {
    val seconds = (limitMinutes * 60).toInt().coerceAtLeast(1)
    "$seconds-second"
  } else if (limitMinutes % 1.0 == 0.0) {
    "${limitMinutes.toInt()}-minute"
  } else {
    String.format(Locale.US, "%.2f-minute", limitMinutes)
  }
}

class CueBlockingMonitorService : Service() {
  private data class TrackedSession(
    val startTime: Long,
    val appName: String,
    var lastForegroundAt: Long,
    var lastBackgroundAt: Long? = null,
    var isActive: Boolean = true,
  )

  private val executor: ScheduledExecutorService = Executors.newSingleThreadScheduledExecutor()
  private val overlayHandler = android.os.Handler(Looper.getMainLooper())
  private val trackedSessions = mutableMapOf<String, TrackedSession>()
  private val appInfoCache = mutableMapOf<String, Pair<String, Boolean>>()
  private var windowManager: WindowManager? = null
  private var overlayView: View? = null
  private var overlayTitleView: TextView? = null
  private var overlayBodyView: TextView? = null
  private var lastProcessedTimestamp = 0L
  private var currentForegroundPackage: String? = null
  private var isInitialized = false
  private var sessionResetCutoffs: Map<String, Long> = emptyMap()

  override fun onCreate() {
    super.onCreate()
    windowManager = getSystemService(WINDOW_SERVICE) as? WindowManager
    createNotificationChannel()
    val notification = buildForegroundNotification()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      ServiceCompat.startForeground(
        this,
        BLOCKING_NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
      )
    } else {
      startForeground(BLOCKING_NOTIFICATION_ID, notification)
    }
    executor.scheduleWithFixedDelay(
      { runCatching { pollBlockingState() } },
      0L,
      1500L,
      TimeUnit.MILLISECONDS,
    )
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    return START_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    executor.shutdownNow()
    hideOverlay()
    super.onDestroy()
  }

  private fun buildForegroundNotification() =
    NotificationCompat.Builder(this, BLOCKING_CHANNEL_ID)
      .setContentTitle("Cue blocking monitor")
      .setContentText("Watching for over-limit apps.")
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val channel = NotificationChannel(
      BLOCKING_CHANNEL_ID,
      "Cue blocking monitor",
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = "Keeps Cue's app blocker running in the background."
      setShowBadge(false)
    }

    val manager = getSystemService(NotificationManager::class.java)
    manager?.createNotificationChannel(channel)
  }

  private fun pollBlockingState() {
    val config = CueBlockingConfigStore.load(this)
    if (config == null || !config.enabled) {
      clearBlockedState()
      return
    }

    if (!hasUsageAccess(this) || !Settings.canDrawOverlays(this)) {
      clearBlockedState()
      return
    }

    val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
      ?: run {
        clearBlockedState()
        return
      }

    val now = System.currentTimeMillis()
    sessionResetCutoffs = config.sessionResetCutoffs

    if (!isInitialized) {
      initializeTracking(usageStatsManager, now)
      isInitialized = true
    } else {
      processUsageEvents(usageStatsManager, lastProcessedTimestamp, now)
    }

    val activePackage = currentForegroundPackage
    if (activePackage == null || activePackage == packageName || config.excludedPackages.contains(activePackage)) {
      clearBlockedState()
      return
    }

    if (resolveIsSystemApp(activePackage)) {
      clearBlockedState()
      return
    }

    val activeSession = trackedSessions[activePackage]
    if (activeSession == null || !activeSession.isActive) {
      clearBlockedState()
      return
    }

    val resetCutoff = sessionResetCutoffs[activePackage]
    if (resetCutoff != null && activeSession.startTime < resetCutoff) {
      trackedSessions.remove(activePackage)
      currentForegroundPackage = null
      clearBlockedState()
      return
    }

    val breakBlock = config.activeBreak
      ?.takeIf { it.appPackage == activePackage && now < it.endsAt }
    val limitMinutes = config.rulesByPackage[activePackage]?.limitMinutes ?: config.defaultLimitMinutes
    val sessionDurationMs = (now - activeSession.startTime).coerceAtLeast(0L)
    val limitDurationMs = (limitMinutes * 60_000.0).toLong().coerceAtLeast(1L)
    val isOverLimit = sessionDurationMs >= limitDurationMs

    if (!isOverLimit && breakBlock == null) {
      clearBlockedState()
      return
    }

    val appName = config.rulesByPackage[activePackage]?.appName
      ?: activeSession.appName
      ?: fallbackAppName(activePackage)

    val bodyText = if (breakBlock != null) {
      val remainingMinutes = ((breakBlock.endsAt - now).coerceAtLeast(0L) / 60000L) + 1L
      "Cue is holding $appName closed while your break finishes. About $remainingMinutes minute${if (remainingMinutes == 1L) "" else "s"} left."
    } else {
      "You've hit your ${formatLimitLabel(limitMinutes)} limit on $appName. Close it now or open Cue to take a reset."
    }

    val thresholdBucket = when {
      sessionDurationMs >= (limitDurationMs * 12L / 10L) -> "exceeded"
      sessionDurationMs >= limitDurationMs -> "at_limit"
      else -> "approaching"
    }

    CueBlockingConfigStore.saveSnapshot(
      this,
      BlockingSnapshot(
        appPackage = activePackage,
        appName = appName,
        limitMinutes = limitMinutes,
        sessionStartTime = activeSession.startTime,
        blockedAt = now,
        thresholdBucket = thresholdBucket,
        reason = if (breakBlock != null) "break" else "limit",
      ),
    )

    showOverlay(
      title = "Time to step away from $appName",
      body = bodyText,
    )
  }

  private fun clearBlockedState() {
    CueBlockingConfigStore.clearSnapshot(this)
    hideOverlay()
  }

  private fun initializeTracking(usageStatsManager: UsageStatsManager, now: Long) {
    trackedSessions.clear()
    currentForegroundPackage = null
    val historicalStart = now - 6 * 60 * 60 * 1000L
    processUsageEvents(usageStatsManager, historicalStart, now)
  }

  private fun processUsageEvents(
    usageStatsManager: UsageStatsManager,
    startTime: Long,
    endTime: Long,
  ) {
    val usageEvents = usageStatsManager.queryEvents(startTime, endTime)
    val event = UsageEvents.Event()
    var maxTimestamp = lastProcessedTimestamp

    while (usageEvents.hasNextEvent()) {
      usageEvents.getNextEvent(event)
      val packageName = event.packageName ?: continue
      if (packageName == this.packageName) {
        continue
      }

      val normalizedEventType = normalizeEventType(event.eventType) ?: continue
      val timestamp = event.timeStamp
      if (timestamp > maxTimestamp) {
        maxTimestamp = timestamp
      }

      val resetCutoff = sessionResetCutoffs[packageName]
      if (resetCutoff != null && timestamp < resetCutoff) {
        continue
      }

      val appName = resolveAppName(packageName)
      processEvent(packageName, appName, normalizedEventType, timestamp)
    }

    lastProcessedTimestamp = if (maxTimestamp == 0L) endTime else maxTimestamp + 1L
  }

  private fun processEvent(
    packageName: String,
    appName: String,
    eventType: String,
    timestamp: Long,
  ) {
    if (eventType == "foreground") {
      val previousForegroundPackage = currentForegroundPackage
      if (previousForegroundPackage != null && previousForegroundPackage != packageName) {
        trackedSessions[previousForegroundPackage]?.let { previousSession ->
          if (previousSession.isActive) {
            previousSession.isActive = false
            previousSession.lastBackgroundAt = timestamp
          }
        }
      }

      val previousSession = trackedSessions[packageName]
      val shouldMerge = previousSession != null &&
        !previousSession.isActive &&
        previousSession.lastBackgroundAt != null &&
        timestamp - previousSession.lastBackgroundAt!! <= MERGE_WINDOW_MS

      trackedSessions[packageName] = TrackedSession(
        startTime = if (shouldMerge) previousSession!!.startTime else timestamp,
        appName = appName,
        lastForegroundAt = timestamp,
        lastBackgroundAt = null,
        isActive = true,
      )
      currentForegroundPackage = packageName
      return
    }

    trackedSessions[packageName]?.let { session ->
      session.isActive = false
      session.lastBackgroundAt = timestamp
    }

    if (currentForegroundPackage == packageName) {
      currentForegroundPackage = null
    }
  }

  private fun showOverlay(title: String, body: String) {
    overlayHandler.post {
      val manager = windowManager ?: return@post

      if (overlayView == null) {
        val root = FrameLayout(this).apply {
          setBackgroundColor(Color.parseColor("#F40F172A"))
        }

        val content = LinearLayout(this).apply {
          orientation = LinearLayout.VERTICAL
          setBackgroundColor(Color.parseColor("#0F172A"))
          setPadding(48, 48, 48, 48)
          elevation = 24f
        }

        val titleView = TextView(this).apply {
          setTextColor(Color.parseColor("#F8FAFC"))
          textSize = 24f
        }

        val bodyView = TextView(this).apply {
          setTextColor(Color.parseColor("#CBD5E1"))
          textSize = 16f
          setLineSpacing(0f, 1.2f)
        }

        val buttons = LinearLayout(this).apply {
          orientation = LinearLayout.VERTICAL
          setPadding(0, 32, 0, 0)
        }

        val homeButton = Button(this).apply {
          text = "Leave this app"
          setOnClickListener {
            hideOverlay()
            val homeIntent = Intent(Intent.ACTION_MAIN).apply {
              addCategory(Intent.CATEGORY_HOME)
              flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            startActivity(homeIntent)
          }
        }

        val cueButton = Button(this).apply {
          text = "Open Cue"
          setOnClickListener {
            hideOverlay()
            val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
            launchIntent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            if (launchIntent != null) {
              startActivity(launchIntent)
            }
          }
        }

        buttons.addView(homeButton)
        buttons.addView(cueButton)
        content.addView(titleView)
        content.addView(bodyView)
        content.addView(buttons)

        val container = FrameLayout.LayoutParams(
          FrameLayout.LayoutParams.MATCH_PARENT,
          FrameLayout.LayoutParams.WRAP_CONTENT,
          Gravity.CENTER,
        ).apply {
          leftMargin = 32
          rightMargin = 32
        }

        root.addView(content, container)

        val layoutParams = WindowManager.LayoutParams(
          WindowManager.LayoutParams.MATCH_PARENT,
          WindowManager.LayoutParams.MATCH_PARENT,
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
          } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
          },
          WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
          PixelFormat.TRANSLUCENT,
        ).apply {
          gravity = Gravity.CENTER
        }

        runCatching {
          manager.addView(root, layoutParams)
          overlayView = root
          overlayTitleView = titleView
          overlayBodyView = bodyView
        }
      }

      overlayTitleView?.text = title
      overlayBodyView?.text = body
      overlayView?.visibility = View.VISIBLE
    }
  }

  private fun hideOverlay() {
    overlayHandler.post {
      val manager = windowManager ?: return@post
      val view = overlayView ?: return@post
      runCatching {
        manager.removeView(view)
      }
      overlayView = null
      overlayTitleView = null
      overlayBodyView = null
    }
  }

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
    val genericSegments = setOf("android", "app", "apps", "mobile", "client", "phone", "tablet")
    val selectedSegment = packageName
      .split('.')
      .asReversed()
      .firstOrNull { segment ->
        segment.isNotBlank() && segment.lowercase(Locale.ROOT) !in genericSegments
      }
      ?: packageName.substringAfterLast('.', packageName)

    return prettifyFallbackSegment(selectedSegment).ifBlank { packageName }
  }

  private fun resolveAppName(packageName: String): String {
    return appInfoCache.getOrPut(packageName) {
      try {
        val applicationInfo = packageManager.getApplicationInfo(packageName, 0)
        val resolvedLabel = packageManager.getApplicationLabel(applicationInfo).toString().trim()
        val appName = if (resolvedLabel.isBlank()) fallbackAppName(packageName) else resolvedLabel
        val isSystemApp =
          (applicationInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0 ||
            (applicationInfo.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0
        appName to isSystemApp
      } catch (_: Exception) {
        fallbackAppName(packageName) to false
      }
    }.first
  }

  private fun resolveIsSystemApp(packageName: String): Boolean {
    resolveAppName(packageName)
    return appInfoCache[packageName]?.second ?: false
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

  private fun hasUsageAccess(context: Context): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as? AppOpsManager ?: return false

    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        context.packageName,
      )
    } else {
      @Suppress("DEPRECATION")
      appOps.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        context.packageName,
      )
    }

    return mode == AppOpsManager.MODE_ALLOWED
  }

  companion object {
    fun start(context: Context) {
      val intent = Intent(context, CueBlockingMonitorService::class.java)
      ContextCompat.startForegroundService(context, intent)
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, CueBlockingMonitorService::class.java))
    }
  }
}
