import { useSSO } from "@clerk/expo";
import { makeRedirectUri } from "expo-auth-session";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  label?: string;
};

export function GoogleAuthButton({ label = "Continue with Google" }: Props) {
  const { startSSOFlow } = useSSO();
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handlePress = async () => {
    if (isLoading) {
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const { createdSessionId, setActive, authSessionResult } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: makeRedirectUri({ path: "sso-callback" }),
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace("/");
        return;
      }

      if (authSessionResult?.type === "cancel" || authSessionResult?.type === "dismiss") {
        return;
      }

      setErrorMessage("Google sign-in could not be completed. Please try again.");
    } catch (error) {
      console.error(JSON.stringify(error, null, 2));
      setErrorMessage("Google sign-in could not be completed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          (isLoading || pressed) && styles.buttonPressed,
          isLoading && styles.buttonDisabled,
        ]}
        onPress={handlePress}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#111111" />
        ) : (
          <>
            <Text style={styles.googleMark}>G</Text>
            <Text style={styles.buttonText}>{label}</Text>
          </>
        )}
      </Pressable>
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  button: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#d4d4d8",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  googleMark: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4285F4",
  },
  buttonText: {
    color: "#111111",
    fontSize: 15,
    fontWeight: "600",
  },
  error: {
    color: "#d32f2f",
    fontSize: 12,
  },
});
