import { useSignIn } from "@clerk/expo";
import { type Href, Link, useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { GoogleAuthButton } from "@/components/google-auth-button";

function pushDecoratedUrl(
  router: ReturnType<typeof useRouter>,
  decorateUrl: (url: string) => string,
  href: string,
) {
  const url = decorateUrl(href);
  const nextHref = url.startsWith("http") ? new URL(url).pathname : url;
  router.push(nextHref as Href);
}

export default function Page() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);

  const emailCodeFactor = signIn.supportedSecondFactors.find(
    (factor) => factor.strategy === "email_code",
  );
  const requiresEmailCode =
    signIn.status === "needs_client_trust" ||
    (signIn.status === "needs_second_factor" && !!emailCodeFactor);

  const handleSubmit = async () => {
    setStatusMessage(null);

    const { error } = await signIn.password({
      emailAddress,
      password,
    });

    if (error) {
      console.error(JSON.stringify(error, null, 2));
      setStatusMessage(error.longMessage ?? "Unable to sign in. Please try again.");
      return;
    }

    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) {
            console.log(session.currentTask);
            return;
          }

          pushDecoratedUrl(router, decorateUrl, "/");
        },
      });
    } else if (signIn.status === "needs_second_factor" || signIn.status === "needs_client_trust") {
      if (emailCodeFactor) {
        await signIn.mfa.sendEmailCode();
        setStatusMessage(`We sent a verification code to ${emailCodeFactor.safeIdentifier}.`);
      } else {
        console.error("Second factor is required, but email_code is not available:", signIn);
        setStatusMessage(
          "A second factor is required, but this screen only supports email codes right now.",
        );
      }
    } else {
      console.error("Sign-in attempt not complete:", signIn);
      setStatusMessage("Sign-in could not be completed. Check the logs for more details.");
    }
  };

  const handleVerify = async () => {
    setStatusMessage(null);

    await signIn.mfa.verifyEmailCode({ code });

    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) {
            console.log(session.currentTask);
            return;
          }

          pushDecoratedUrl(router, decorateUrl, "/");
        },
      });
    } else {
      console.error("Sign-in attempt not complete:", signIn);
      setStatusMessage("That code did not complete sign-in. Please try again.");
    }
  };

  if (requiresEmailCode) {
    return (
      <View style={styles.container}>
        <View style={styles.panel}>
          <Text style={styles.eyebrow}>Cue</Text>
          <Text style={styles.title}>Verify your account</Text>
          <Text style={styles.subtitle}>
            Calm verification, then you’re back to the dashboard.
          </Text>
          {statusMessage && <Text style={styles.helper}>{statusMessage}</Text>}
          <TextInput
            style={styles.input}
            value={code}
            placeholder="Enter your verification code"
            placeholderTextColor="#64748b"
            onChangeText={(value) => setCode(value)}
            keyboardType="numeric"
          />
          {errors.fields.code && <Text style={styles.error}>{errors.fields.code.message}</Text>}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              fetchStatus === "fetching" && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleVerify}
            disabled={fetchStatus === "fetching"}
          >
            <Text style={styles.buttonText}>Verify</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
            onPress={() => signIn.mfa.sendEmailCode()}
          >
            <Text style={styles.secondaryButtonText}>I need a new code</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.panel}>
        <Text style={styles.eyebrow}>Cue</Text>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.subtitle}>
          Return to a calmer dashboard with usage limits already in place.
        </Text>
        {statusMessage && <Text style={styles.helper}>{statusMessage}</Text>}
        <GoogleAuthButton />
        <Text style={styles.divider}>or continue with email</Text>
        <Text style={styles.label}>Email address</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          value={emailAddress}
          placeholder="Enter email"
          placeholderTextColor="#64748b"
          onChangeText={(value) => setEmailAddress(value)}
          keyboardType="email-address"
        />
        {errors.fields.identifier && (
          <Text style={styles.error}>{errors.fields.identifier.message}</Text>
        )}
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          placeholder="Enter password"
          placeholderTextColor="#64748b"
          secureTextEntry={true}
          onChangeText={(value) => setPassword(value)}
        />
        {errors.fields.password && <Text style={styles.error}>{errors.fields.password.message}</Text>}
        <Pressable
          style={({ pressed }) => [
            styles.button,
            (!emailAddress || !password || fetchStatus === "fetching") && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleSubmit}
          disabled={!emailAddress || !password || fetchStatus === "fetching"}
        >
          <Text style={styles.buttonText}>Sign in</Text>
        </Pressable>
        <View style={styles.linkContainer}>
          <Text style={styles.linkCopy}>Don't have an account? </Text>
          <Link href="/sign-up">
            <Text style={styles.linkText}>Sign up</Text>
          </Link>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    backgroundColor: "#020617",
  },
  panel: {
    gap: 12,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 16,
    padding: 20,
  },
  eyebrow: {
    color: "#fbbf24",
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    fontFamily: "Inter_600SemiBold",
  },
  title: {
    fontSize: 24,
    color: "#f8fafc",
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
  },
  label: {
    color: "#94a3b8",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  input: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: "#f8fafc",
    backgroundColor: "#1e293b",
    fontFamily: "Inter_400Regular",
  },
  button: {
    backgroundColor: "#6366f1",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#1e293b",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  secondaryButtonText: {
    color: "#94a3b8",
    fontFamily: "Inter_600SemiBold",
  },
  linkContainer: {
    flexDirection: "row",
    gap: 4,
    marginTop: 12,
    alignItems: "center",
  },
  linkCopy: {
    color: "#94a3b8",
    fontFamily: "Inter_400Regular",
  },
  linkText: {
    color: "#fbbf24",
    fontFamily: "Inter_600SemiBold",
  },
  error: {
    color: "#f87171",
    fontSize: 12,
    marginTop: -8,
    fontFamily: "Inter_400Regular",
  },
  helper: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
  },
  divider: {
    color: "#64748b",
    fontSize: 13,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
  },
});
