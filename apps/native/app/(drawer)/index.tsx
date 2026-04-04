import { useAuth, useUser } from "@clerk/expo";
import { api } from "@cue/backend/convex/_generated/api";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { Spinner, useThemeColor } from "heroui-native";
import { Pressable, Text, View } from "react-native";

import { Container } from "@/components/container";
import { useUsageSessionSync } from "@/lib/session-sync";
import { SignOutButton } from "@/components/sign-out-button";

export default function Home() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const healthCheck = useQuery(api.healthCheck.get);
  const privateData = useQuery(api.privateData.get);
  const usageSummary = useQuery(api.usageSessions.summaryForCurrentUser);
  const sessionSyncStatus = useUsageSessionSync();
  const successColor = useThemeColor("success");
  const dangerColor = useThemeColor("danger");

  const isConnected = healthCheck === "OK";
  const isLoading = healthCheck === undefined;

  return (
    <Container className="bg-background px-5 pb-8">
      <View className="pt-8 pb-6">
        <Text className="text-[32px] text-foreground tracking-tight font-['Inter_700Bold']">
          Cue
        </Text>
        <Text className="mt-2 max-w-[320px] text-secondary text-base leading-6 font-['Inter_400Regular']">
          Calm limits, clear nudges, and a screen-time experience that feels protective instead of punishing.
        </Text>
      </View>

      <View className="rounded-2xl border border-brand/30 bg-brand/12 px-4 py-4">
        <Text className="text-accent text-xs uppercase tracking-[1.8px] font-['Inter_600SemiBold']">
          Demo Focus
        </Text>
        <Text className="mt-2 text-foreground text-xl leading-7 font-['Inter_600SemiBold']">
          Everything begins limited by default. Users only choose what to exclude.
        </Text>
        <Text className="mt-3 text-secondary text-sm leading-6 font-['Inter_400Regular']">
          That keeps the product opinionated, calm, and easier to demo. The AI takes care of the session limits for the rest.
        </Text>
      </View>

      <View className="mt-4 rounded-2xl border border-border bg-surface px-4 py-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-secondary text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
              System Pulse
            </Text>
            <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
              Convex connection
            </Text>
          </View>
          <View
            className={`rounded-full border px-3 py-1 ${isConnected ? "border-success/30 bg-success/12" : "border-danger/30 bg-danger/12"}`}
          >
            <Text
              className={`text-xs uppercase tracking-[1.4px] font-['Inter_600SemiBold'] ${isConnected ? "text-success" : "text-danger"}`}
            >
              {isConnected ? "Live" : "Offline"}
            </Text>
          </View>
        </View>
        <View className="mt-4 flex-row items-center rounded-2xl bg-elevated px-4 py-4">
          <View
            className={`mr-3 h-2.5 w-2.5 rounded-full ${isConnected ? "bg-success" : "bg-danger"}`}
          />
          <View className="flex-1">
            <Text className="text-foreground text-sm font-['Inter_600SemiBold']">
              {isLoading ? "Checking backend..." : isConnected ? "Connected to API" : "Connection lost"}
            </Text>
            <Text className="mt-1 text-muted text-xs leading-5 font-['Inter_400Regular']">
              Private session guidance and live nudges will flow through this channel.
            </Text>
          </View>
          {isLoading && <Spinner size="sm" />}
          {!isLoading && isConnected && (
            <Ionicons name="checkmark-circle" size={18} color={successColor} />
          )}
          {!isLoading && !isConnected && (
            <Ionicons name="alert-circle" size={18} color={dangerColor} />
          )}
        </View>
      </View>

      {isSignedIn && (
        <View className="mt-4 rounded-2xl border border-border bg-surface px-4 py-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-secondary text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
                Usage pipeline
              </Text>
              <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
                Raw events to Convex
              </Text>
            </View>
            <View
              className={`rounded-full border px-3 py-1 ${
                sessionSyncStatus.bridgeReady
                  ? "border-success/30 bg-success/12"
                  : "border-warning/30 bg-warning/12"
              }`}
            >
              <Text
                className={`text-xs uppercase tracking-[1.4px] font-['Inter_600SemiBold'] ${
                  sessionSyncStatus.bridgeReady ? "text-success" : "text-warning"
                }`}
              >
                {sessionSyncStatus.bridgeReady ? "Ready" : "Rebuild"}
              </Text>
            </View>
          </View>

          <View className="mt-4 gap-3">
            <View className="rounded-2xl bg-elevated px-4 py-4">
              <Text className="text-foreground text-sm font-['Inter_600SemiBold']">
                {sessionSyncStatus.isSyncing
                  ? "Syncing usage events..."
                  : sessionSyncStatus.lastSyncedAt
                    ? "Usage sessions synced"
                    : "Waiting for first sync"}
              </Text>
              <Text className="mt-1 text-muted text-xs leading-5 font-['Inter_400Regular']">
                {sessionSyncStatus.bridgeReady
                  ? `Received ${sessionSyncStatus.lastReceived} sessions, inserted ${sessionSyncStatus.lastInserted}, skipped ${sessionSyncStatus.lastSkipped}.`
                  : "The installed Android dev build needs one more rebuild to include the raw event bridge."}
              </Text>
            </View>

            {usageSummary && (
              <View className="flex-row gap-3">
                <View className="flex-1 rounded-2xl bg-elevated px-4 py-4">
                  <Text className="text-muted text-xs uppercase tracking-[1.4px] font-['Inter_600SemiBold']">
                    Today
                  </Text>
                  <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
                    {usageSummary.todayTotalMinutes} min
                  </Text>
                </View>
                <View className="flex-1 rounded-2xl bg-elevated px-4 py-4">
                  <Text className="text-muted text-xs uppercase tracking-[1.4px] font-['Inter_600SemiBold']">
                    Sessions
                  </Text>
                  <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
                    {usageSummary.totalSessions}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {!isLoaded ? (
        <View className="mt-4 items-center">
          <Spinner size="sm" />
        </View>
      ) : isSignedIn ? (
        <View className="mt-4 rounded-2xl border border-border bg-surface px-4 py-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-secondary text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
                Signed in
              </Text>
              <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
                {user?.emailAddresses[0]?.emailAddress ?? "Signed in"}
              </Text>
              <Text className="mt-2 text-secondary text-sm leading-6 font-['Inter_400Regular']">
                {privateData?.message ?? "Loading private data..."}
              </Text>
            </View>
            <SignOutButton />
          </View>
        </View>
      ) : (
        <View className="mt-4 gap-3">
          <Pressable
            style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
            onPress={() => router.push("/(auth)/sign-in")}
            className="rounded-xl bg-brand-strong px-4 py-4"
          >
            <Text className="text-center text-foreground text-base font-['Inter_600SemiBold']">
              Sign in
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
            onPress={() => router.push("/(auth)/sign-up")}
            className="rounded-xl border border-border bg-surface px-4 py-4"
          >
            <Text className="text-center text-secondary text-base font-['Inter_600SemiBold']">
              Create account
            </Text>
          </Pressable>
        </View>
      )}
    </Container>
  );
}
