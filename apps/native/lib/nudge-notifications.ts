import type { Id } from "@cue/backend/convex/_generated/dataModel";
import React from "react";
import { Platform } from "react-native";

type NotificationsModule = typeof import("expo-notifications");

type ActiveNudge = {
  _id: Id<"nudges">;
  triggerApp: string;
  message: string;
  alternative?: string;
} | null | undefined;

const NUDGE_CHANNEL_ID = "cue-nudges";
const notificationIdsByNudgeId = new Map<string, string>();
const clearedNudgeIds = new Set<string>();

let notificationsModulePromise: Promise<NotificationsModule | null> | null = null;
let notificationHandlerConfigured = false;

function hasNotificationsNativeModule() {
  try {
    const expoModulesCore = require("expo-modules-core") as {
      requireOptionalNativeModule?: (moduleName: string) => unknown;
    };

    return expoModulesCore.requireOptionalNativeModule?.("ExpoPushTokenManager") != null;
  } catch {
    return false;
  }
}

async function loadNotificationsModule() {
  if (notificationsModulePromise) {
    return notificationsModulePromise;
  }

  if (!hasNotificationsNativeModule()) {
    notificationsModulePromise = Promise.resolve(null);
    return notificationsModulePromise;
  }

  notificationsModulePromise = import("expo-notifications")
    .then((module) => {
      if (!notificationHandlerConfigured && typeof module.setNotificationHandler === "function") {
        module.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: false,
            shouldSetBadge: false,
          }),
        });
        notificationHandlerConfigured = true;
      }

      return module;
    })
    .catch((error) => {
      console.warn("Cue notifications unavailable in this build yet.", error);
      return null;
    });

  return notificationsModulePromise;
}

async function ensureNotificationPermissions(module: NotificationsModule) {
  if (
    typeof module.getPermissionsAsync !== "function" ||
    typeof module.requestPermissionsAsync !== "function"
  ) {
    return false;
  }

  const existingPermissions = await module.getPermissionsAsync();

  if (existingPermissions.granted) {
    return true;
  }

  const requestedPermissions = await module.requestPermissionsAsync();
  return requestedPermissions.granted;
}

async function ensureNotificationChannel(module: NotificationsModule) {
  if (Platform.OS !== "android" || typeof module.setNotificationChannelAsync !== "function") {
    return;
  }

  await module.setNotificationChannelAsync(NUDGE_CHANNEL_ID, {
    name: "Cue nudges",
    importance: module.AndroidImportance.HIGH,
    vibrationPattern: [0, 150, 100, 150],
    lockscreenVisibility: module.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function clearNotificationForNudge(nudgeId: string) {
  clearedNudgeIds.add(nudgeId);

  const module = await loadNotificationsModule();
  if (
    !module ||
    typeof module.dismissNotificationAsync !== "function" ||
    typeof module.cancelScheduledNotificationAsync !== "function"
  ) {
    return;
  }

  const notificationId = notificationIdsByNudgeId.get(nudgeId);
  if (!notificationId) {
    return;
  }

  notificationIdsByNudgeId.delete(nudgeId);

  await Promise.allSettled([
    module.dismissNotificationAsync(notificationId),
    module.cancelScheduledNotificationAsync(notificationId),
  ]);
}

export function useNudgeNotifications(activeNudge: ActiveNudge) {
  const [isReady, setIsReady] = React.useState(false);
  const notifiedNudgeIdsRef = React.useRef(new Set<string>());

  React.useEffect(() => {
    let isMounted = true;

    const setupNotifications = async () => {
      const module = await loadNotificationsModule();
      if (!module) {
        if (isMounted) {
          setIsReady(false);
        }
        return;
      }

      await ensureNotificationChannel(module);
      const granted = await ensureNotificationPermissions(module);

      if (isMounted) {
        setIsReady(granted);
      }
    };

    void setupNotifications();

    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (!isReady || !activeNudge) {
      return;
    }

    const nudgeId = String(activeNudge._id);
    clearedNudgeIds.delete(nudgeId);

    if (notifiedNudgeIdsRef.current.has(nudgeId)) {
      return;
    }

    notifiedNudgeIdsRef.current.add(nudgeId);

    void loadNotificationsModule()
      .then(async (module) => {
        if (!module) {
          notifiedNudgeIdsRef.current.delete(nudgeId);
          return;
        }

        if (
          typeof module.scheduleNotificationAsync !== "function" ||
          typeof module.dismissNotificationAsync !== "function" ||
          typeof module.cancelScheduledNotificationAsync !== "function"
        ) {
          notifiedNudgeIdsRef.current.delete(nudgeId);
          return;
        }

        const notificationId = await module.scheduleNotificationAsync({
          content: {
            title: "Cue nudge",
            body: activeNudge.message,
            ...(Platform.OS === "android" ? { channelId: NUDGE_CHANNEL_ID } : null),
            data: {
              nudgeId,
              triggerApp: activeNudge.triggerApp,
            },
          },
          trigger: null,
        });

        if (clearedNudgeIds.has(nudgeId)) {
          await Promise.allSettled([
            module.dismissNotificationAsync(notificationId),
            module.cancelScheduledNotificationAsync(notificationId),
          ]);
          return;
        }

        notificationIdsByNudgeId.set(nudgeId, notificationId);
      })
      .catch((error) => {
        notifiedNudgeIdsRef.current.delete(nudgeId);
        console.error("Failed to schedule cue notification", error);
      });
  }, [activeNudge, isReady]);
}
