import "expo-dev-client";
import "@/global.css";
import { api } from "@cue/backend/convex/_generated/api";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { ClerkProvider, useAuth, useUser } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { env } from "@cue/env/native";
import { ConvexReactClient, useMutation, useQuery } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { Stack, useRouter, useSegments } from "expo-router";
import { HeroUINativeProvider } from "heroui-native";
import React from "react";
import { Platform } from "react-native";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { AppThemeProvider } from "@/contexts/app-theme-context";
import { useAndroidUsageAccess } from "@/lib/usage-access";

export const unstable_settings = {
  initialRouteName: "(drawer)",
};

const convex = new ConvexReactClient(env.EXPO_PUBLIC_CONVEX_URL, {
  unsavedChangesWarning: false,
});

function UserBootstrap() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const ensureCurrentUser = useMutation(api.users.ensureCurrent);
  const bootstrappedKeyRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) {
      bootstrappedKeyRef.current = null;
      return;
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const nextKey = `${user.id}:${user.fullName ?? ""}:${timezone}`;
    if (bootstrappedKeyRef.current === nextKey) {
      return;
    }

    bootstrappedKeyRef.current = nextKey;
    void ensureCurrentUser({
      name: user.fullName ?? user.primaryEmailAddress?.emailAddress ?? "Cue user",
      timezone,
    });
  }, [ensureCurrentUser, isLoaded, isSignedIn, user]);

  return null;
}

function NavigationGate() {
  const { isLoaded, isSignedIn } = useAuth();
  const currentUser = useQuery(api.users.current);
  const router = useRouter();
  const segments = useSegments();
  const usageAccess = useAndroidUsageAccess();

  React.useEffect(() => {
    if (!isLoaded) {
      return;
    }

    const topLevel = segments[0];
    const inAuth = topLevel === "(auth)";
    const inOnboarding = topLevel === "(onboarding)";
    const inCallback = topLevel === "sso-callback";

    if (!isSignedIn) {
      if (!inAuth && !inCallback) {
        router.replace("/(auth)/sign-in");
      }
      return;
    }

    if (currentUser === undefined || currentUser === null) {
      return;
    }

    const needsAndroidUsageAccess = Platform.OS === "android" &&
      usageAccess.isRelevant &&
      usageAccess.isAvailable &&
      !usageAccess.granted;

    if (needsAndroidUsageAccess) {
      const inPermissionStep = inOnboarding && segments[1] === "permission";

      if (!inPermissionStep) {
        router.replace({
          pathname: "/(onboarding)/permission",
          params: {
            next: currentUser.onboardingComplete ? "home" : "exclusions",
          },
        });
      }
      return;
    }

    if (!currentUser.onboardingComplete) {
      if (!inOnboarding) {
        router.replace("/(onboarding)");
      }
      return;
    }

    if (inOnboarding || inAuth || inCallback) {
      router.replace("/(drawer)");
      return;
    }
  }, [currentUser, isLoaded, isSignedIn, router, segments, usageAccess.granted, usageAccess.isAvailable, usageAccess.isRelevant]);

  if (!isLoaded || (isSignedIn && (currentUser === undefined || currentUser === null))) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#f8fafc" />
      </View>
    );
  }

  return <StackLayout />;
}

function StackLayout() {
  return (
    <Stack screenOptions={{}}>
      <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
      <Stack.Screen name="sso-callback" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ title: "Modal", presentation: "modal" }} />
    </Stack>
  );
}

export default function Layout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ClerkProvider tokenCache={tokenCache} publishableKey={env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <UserBootstrap />
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <AppThemeProvider>
              <HeroUINativeProvider>
                <NavigationGate />
              </HeroUINativeProvider>
            </AppThemeProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
