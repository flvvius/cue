import { api } from "@cue/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { Text, View } from "react-native";

import { Container } from "@/components/container";

export default function SettingsTab() {
  const currentUser = useQuery(api.users.current);
  const excludedApps = useQuery(api.excludedApps.listForCurrentUser);
  const alternatives = useQuery(api.alternatives.listForCurrentUser);

  return (
    <Container className="bg-background px-5 py-8">
      <View className="flex-1 gap-4">
        <View className="rounded-2xl border border-border bg-surface p-5">
          <Text className="text-secondary text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
            Settings
          </Text>
          <Text className="mt-2 text-foreground text-2xl font-['Inter_600SemiBold']">
            Current defaults
          </Text>
          <Text className="mt-3 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            A simple debug-friendly settings surface so you can verify what onboarding has already saved.
          </Text>
        </View>

        <View className="rounded-2xl border border-border bg-surface p-5">
          <Text className="text-muted text-xs uppercase tracking-[1.4px] font-['Inter_600SemiBold']">
            Nudge style
          </Text>
          <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
            {currentUser?.nudgeStyle ?? "Loading..."}
          </Text>
          <Text className="mt-4 text-muted text-xs uppercase tracking-[1.4px] font-['Inter_600SemiBold']">
            Default limit
          </Text>
          <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
            {currentUser?.defaultSessionLimitMinutes ?? 0} minutes
          </Text>
        </View>

        <View className="rounded-2xl border border-border bg-surface p-5">
          <Text className="text-muted text-xs uppercase tracking-[1.4px] font-['Inter_600SemiBold']">
            Excluded apps
          </Text>
          <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
            {excludedApps?.length ?? 0}
          </Text>
          <Text className="mt-2 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            {(excludedApps ?? []).slice(0, 4).map((app) => app.appName).join(", ") || "None yet"}
          </Text>
        </View>

        <View className="rounded-2xl border border-border bg-surface p-5">
          <Text className="text-muted text-xs uppercase tracking-[1.4px] font-['Inter_600SemiBold']">
            Alternatives
          </Text>
          <Text className="mt-2 text-foreground text-lg font-['Inter_600SemiBold']">
            {alternatives?.length ?? 0}
          </Text>
          <Text className="mt-2 text-secondary text-sm leading-6 font-['Inter_400Regular']">
            {(alternatives ?? []).slice(0, 4).map((alternative) => alternative.activity).join(", ") || "None yet"}
          </Text>
        </View>
      </View>
    </Container>
  );
}
