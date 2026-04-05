import React from "react";
import { Platform } from "react-native";

type NotificationsModule = typeof import("expo-notifications");

type SocialEvent = {
  _id: string;
  actorName: string;
  type: "break_ended_early";
  appPackage: string;
  appName: string;
  createdAt: number;
};

const SOCIAL_CHANNEL_ID = "cue-live-impact";

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
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });
        notificationHandlerConfigured = true;
      }

      return module;
    })
    .catch(() => null);

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

  await module.setNotificationChannelAsync(SOCIAL_CHANNEL_ID, {
    name: "Cue live impact",
    importance: module.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 120, 200],
    lockscreenVisibility: module.AndroidNotificationVisibility.PUBLIC,
  });
}

function buildNotificationBody(event: SocialEvent) {
  if (event.type === "break_ended_early") {
    return `${event.actorName} ended a break early on ${event.appName}.`;
  }

  return `${event.actorName} triggered a live Cue event.`;
}

export function useSocialEventNotifications(events: SocialEvent[]) {
  const [isReady, setIsReady] = React.useState(false);
  const seenEventIdsRef = React.useRef(new Set<string>());
  const hasBootstrappedRef = React.useRef(false);

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
    const eventIds = events.map((event) => String(event._id));

    if (!hasBootstrappedRef.current) {
      eventIds.forEach((eventId) => seenEventIdsRef.current.add(eventId));
      hasBootstrappedRef.current = true;
      return;
    }

    if (!isReady) {
      eventIds.forEach((eventId) => seenEventIdsRef.current.add(eventId));
      return;
    }

    const newEvents = events.filter((event) => !seenEventIdsRef.current.has(String(event._id)));
    if (!newEvents.length) {
      return;
    }

    newEvents.forEach((event) => seenEventIdsRef.current.add(String(event._id)));

    void loadNotificationsModule().then(async (module) => {
      if (!module || typeof module.scheduleNotificationAsync !== "function") {
        return;
      }

      for (const event of newEvents) {
        await module.scheduleNotificationAsync({
          content: {
            title: "Cue live impact",
            body: buildNotificationBody(event),
            ...(Platform.OS === "android" ? { channelId: SOCIAL_CHANNEL_ID } : null),
            data: {
              socialEventId: String(event._id),
              type: event.type,
              appPackage: event.appPackage,
            },
          },
          trigger: null,
        });
      }
    });
  }, [events, isReady]);
}
