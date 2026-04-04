import { api } from "@cue/backend/convex/_generated/api";
import { useAuth } from "@clerk/expo";
import { useQuery } from "convex/react";
import { useSegments } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type RecommendationSummary = {
  appPackage: string;
  appName: string;
  sessionLimitMinutes: number;
  breakSchedule: Array<{
    from: string;
    to: string;
    breakAfterMinutes: number;
  }>;
  effectiveDate: string;
};

function buildRecommendationSignature(recommendations: RecommendationSummary[]) {
  return JSON.stringify(
    [...recommendations]
      .sort((left, right) => left.appPackage.localeCompare(right.appPackage))
      .map((recommendation) => ({
        appPackage: recommendation.appPackage,
        sessionLimitMinutes: recommendation.sessionLimitMinutes,
        effectiveDate: recommendation.effectiveDate,
        breakSchedule: recommendation.breakSchedule,
      })),
  );
}

function buildRecommendationMessage(
  previousRecommendations: RecommendationSummary[],
  nextRecommendations: RecommendationSummary[],
) {
  if (previousRecommendations.length > 0 && nextRecommendations.length === 0) {
    return "Recommendations cleared. Cue is using your default limit again.";
  }

  const previousByPackage = new Map(
    previousRecommendations.map((recommendation) => [recommendation.appPackage, recommendation]),
  );

  for (const recommendation of nextRecommendations) {
    const previousRecommendation = previousByPackage.get(recommendation.appPackage);
    if (!previousRecommendation) {
      return `New limit for ${recommendation.appName}: ${recommendation.sessionLimitMinutes} minutes.`;
    }

    if (
      previousRecommendation.sessionLimitMinutes !== recommendation.sessionLimitMinutes ||
      buildRecommendationSignature([previousRecommendation]) !== buildRecommendationSignature([recommendation])
    ) {
      return `${recommendation.appName} updated to ${recommendation.sessionLimitMinutes} minutes with refreshed break windows.`;
    }
  }

  return "Cue recommendations updated in real time.";
}

export function LiveRecommendationHost() {
  const { isLoaded, isSignedIn } = useAuth();
  const currentUser = useQuery(api.users.current);
  const overview = useQuery(api.dashboard.overviewForCurrentUser);
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const previousSignatureRef = React.useRef<string | null>(null);
  const previousRecommendationsRef = React.useRef<RecommendationSummary[]>([]);
  const dismissTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!overview) {
      return;
    }

    const nextRecommendations = overview.recommendations ?? [];
    const nextSignature = buildRecommendationSignature(nextRecommendations);

    if (previousSignatureRef.current === null) {
      previousSignatureRef.current = nextSignature;
      previousRecommendationsRef.current = nextRecommendations;
      return;
    }

    if (previousSignatureRef.current === nextSignature) {
      return;
    }

    const nextMessage = buildRecommendationMessage(
      previousRecommendationsRef.current,
      nextRecommendations,
    );

    previousSignatureRef.current = nextSignature;
    previousRecommendationsRef.current = nextRecommendations;
    setMessage(nextMessage);

    if (dismissTimeoutRef.current) {
      clearTimeout(dismissTimeoutRef.current);
    }

    dismissTimeoutRef.current = setTimeout(() => {
      setMessage(null);
    }, 6000);
  }, [overview]);

  const topLevel = segments[0];
  const shouldHide =
    !message ||
    !isLoaded ||
    !isSignedIn ||
    currentUser === undefined ||
    currentUser === null ||
    !currentUser.onboardingComplete ||
    topLevel === "(auth)" ||
    topLevel === "(onboarding)" ||
    topLevel === "sso-callback" ||
    topLevel === "break-timer";

  if (shouldHide) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-4 z-10"
      style={{ top: Math.max(insets.top, 16) }}
    >
      <Pressable
        className="rounded-2xl border px-5 py-4"
        onPress={() => setMessage(null)}
        style={{
          backgroundColor: "#0f172a",
          borderColor: "#fbbf24",
          borderWidth: 1,
          elevation: 8,
        }}
      >
        <Text className="text-accent text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
          Live update
        </Text>
        <Text className="mt-2 text-sm leading-6 text-foreground font-['Inter_500Medium']">
          {message}
        </Text>
      </Pressable>
    </View>
  );
}
