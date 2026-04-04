import { useAuth, useUser } from "@clerk/expo";
import { api } from "@cue/backend/convex/_generated/api";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { Button, Chip, Separator, Spinner, Surface, useThemeColor } from "heroui-native";
import { Text, View } from "react-native";

import { Container } from "@/components/container";
import { SignOutButton } from "@/components/sign-out-button";

export default function Home() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const healthCheck = useQuery(api.healthCheck.get);
  const privateData = useQuery(api.privateData.get);
  const successColor = useThemeColor("success");
  const dangerColor = useThemeColor("danger");

  const isConnected = healthCheck === "OK";
  const isLoading = healthCheck === undefined;

  return (
    <Container className="px-4 pb-4">
      <View className="py-6 mb-5">
        <Text className="text-3xl font-semibold text-foreground tracking-tight">
          Better T Stack
        </Text>
        <Text className="text-muted text-sm mt-1">Full-stack TypeScript starter</Text>
      </View>

      <Surface variant="secondary" className="p-4 rounded-xl">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-foreground font-medium">System Status</Text>
          <Chip variant="secondary" color={isConnected ? "success" : "danger"} size="sm">
            <Chip.Label>{isConnected ? "LIVE" : "OFFLINE"}</Chip.Label>
          </Chip>
        </View>

        <Separator className="mb-3" />

        <Surface variant="tertiary" className="p-3 rounded-lg">
          <View className="flex-row items-center">
            <View
              className={`w-2 h-2 rounded-full mr-3 ${isConnected ? "bg-success" : "bg-muted"}`}
            />
            <View className="flex-1">
              <Text className="text-foreground text-sm font-medium">Convex Backend</Text>
              <Text className="text-muted text-xs mt-0.5">
                {isLoading
                  ? "Checking connection..."
                  : isConnected
                    ? "Connected to API"
                    : "API Disconnected"}
              </Text>
            </View>
            {isLoading && <Spinner size="sm" />}
            {!isLoading && isConnected && (
              <Ionicons name="checkmark-circle" size={18} color={successColor} />
            )}
            {!isLoading && !isConnected && (
              <Ionicons name="close-circle" size={18} color={dangerColor} />
            )}
          </View>
        </Surface>
      </Surface>

      {!isLoaded ? (
        <View className="mt-4 items-center">
          <Spinner size="sm" />
        </View>
      ) : isSignedIn ? (
        <Surface variant="secondary" className="mt-5 p-4 rounded-xl">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-foreground font-medium">
                {user?.emailAddresses[0]?.emailAddress ?? "Signed in"}
              </Text>
              <Text className="text-muted text-xs mt-0.5">
                Private: {privateData?.message ?? "Loading private data..."}
              </Text>
            </View>
            <SignOutButton />
          </View>
        </Surface>
      ) : (
        <View className="mt-4 gap-3">
          <Button variant="secondary" onPress={() => router.push("/(auth)/sign-in")}>
            <Button.Label>Sign In</Button.Label>
          </Button>
          <Button variant="tertiary" onPress={() => router.push("/(auth)/sign-up")}>
            <Button.Label>Sign Up</Button.Label>
          </Button>
        </View>
      )}
    </Container>
  );
}
