import { api } from "@cue/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import React from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { Container } from "@/components/container";

const presets = [
  {
    category: "physical",
    title: "Physical",
    items: ["Walk outside", "Stretch for 5 minutes", "Do 20 push-ups"],
  },
  {
    category: "creative",
    title: "Creative",
    items: ["Sketch something", "Write a journal note", "Take one good photo"],
  },
  {
    category: "social",
    title: "Social",
    items: ["Text a friend", "Call family", "Send a voice note"],
  },
  {
    category: "mindful",
    title: "Mindful",
    items: ["Breathe for 2 minutes", "Sit without your phone", "Short meditation"],
  },
  {
    category: "productive",
    title: "Productive",
    items: ["Tidy your desk", "Plan tomorrow", "Clear one small task"],
  },
] as const;

export default function OnboardingAlternativesScreen() {
  const existingAlternatives = useQuery(api.alternatives.listForCurrentUser);
  const saveAlternatives = useMutation(api.alternatives.replaceForCurrentUser);
  const [selectedActivities, setSelectedActivities] = React.useState<Set<string>>(new Set());
  const [customAlternative, setCustomAlternative] = React.useState("");
  const [customIncluded, setCustomIncluded] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const initializedRef = React.useRef(false);

  React.useEffect(() => {
    if (initializedRef.current || existingAlternatives === undefined) {
      return;
    }

    const initialSelection = new Set<string>();
    let initialCustomAlternative = "";
    let hasCustomAlternative = false;

    if (existingAlternatives.length > 0) {
      for (const alternative of existingAlternatives) {
        if (alternative.category === "custom") {
          initialCustomAlternative = alternative.activity;
          hasCustomAlternative = true;
        } else {
          initialSelection.add(alternative.activity);
        }
      }
    } else {
      initialSelection.add("Walk outside");
      initialSelection.add("Breathe for 2 minutes");
      initialSelection.add("Plan tomorrow");
    }

    setSelectedActivities(initialSelection);
    setCustomAlternative(initialCustomAlternative);
    setCustomIncluded(hasCustomAlternative);
    initializedRef.current = true;
  }, [existingAlternatives]);

  const toggleActivity = (activity: string) => {
    setSelectedActivities((currentSelection) => {
      const nextSelection = new Set(currentSelection);

      if (nextSelection.has(activity)) {
        nextSelection.delete(activity);
      } else {
        nextSelection.add(activity);
      }

      return nextSelection;
    });
  };

  const trimmedCustomAlternative = customAlternative.trim();
  const totalSelectedCount = selectedActivities.size + (customIncluded && trimmedCustomAlternative ? 1 : 0);
  const canContinue = totalSelectedCount >= 3;

  const handleContinue = async () => {
    if (!canContinue || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      const selectedPresets = presets.flatMap((group) =>
        group.items
          .filter((activity) => selectedActivities.has(activity))
          .map((activity) => ({
            activity,
            category: group.category,
          }))
      );

      const alternatives = customIncluded && trimmedCustomAlternative
        ? [
            ...selectedPresets,
            {
              activity: trimmedCustomAlternative,
              category: "custom",
            },
          ]
        : selectedPresets;

      await saveAlternatives({ alternatives });
      router.push("/(onboarding)/style");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Container className="bg-background px-5 py-8">
      <View className="flex-1 gap-6">
        <View>
          <Text className="text-accent text-xs uppercase tracking-[1.8px] font-['Inter_600SemiBold']">
            Step 3
          </Text>
          <Text className="mt-4 text-3xl leading-10 text-foreground font-['Inter_700Bold']">
            Pick better things to do instead.
          </Text>
          <Text className="mt-3 text-base leading-7 text-secondary font-['Inter_400Regular']">
            Choose at least 3 fallback activities. Cue will use these later when it nudges you out
            of a distraction loop.
          </Text>
        </View>

        <View className="rounded-2xl border border-border bg-surface px-4 py-4">
          <Text className="text-muted text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
            Selected
          </Text>
          <Text className="mt-2 text-lg text-foreground font-['Inter_600SemiBold']">
            {totalSelectedCount} of 3 minimum
          </Text>
          <Text className="mt-1 text-sm leading-6 text-secondary font-['Inter_400Regular']">
            Mix a few presets now. You can always expand and personalize this later.
          </Text>
        </View>

        <View className="gap-4">
          {presets.map((group) => (
            <View
              key={group.category}
              className="rounded-2xl border border-border bg-surface px-4 py-4"
            >
              <Text className="text-muted text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
                {group.title}
              </Text>
              <View className="mt-3 gap-2">
                {group.items.map((activity) => {
                  const isSelected = selectedActivities.has(activity);

                  return (
                    <Pressable
                      key={activity}
                      onPress={() => toggleActivity(activity)}
                      className={`rounded-xl border px-4 py-3 ${isSelected ? "border-brand bg-brand/12" : "border-border bg-elevated"}`}
                      style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
                    >
                      <View className="flex-row items-center justify-between gap-3">
                        <Text className="flex-1 text-sm leading-6 text-foreground font-['Inter_500Medium']">
                          {activity}
                        </Text>
                        <Text
                          className={`text-xs font-['Inter_600SemiBold'] ${isSelected ? "text-success" : "text-secondary"}`}
                        >
                          {isSelected ? "Picked" : "Add"}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        <View className="rounded-2xl border border-border bg-surface px-4 py-4">
          <Text className="text-muted text-xs uppercase tracking-[1.6px] font-['Inter_600SemiBold']">
            One custom idea
          </Text>
          <TextInput
            value={customAlternative}
            onChangeText={setCustomAlternative}
            placeholder="Example: Make tea and stand on the balcony"
            placeholderTextColor="#64748b"
            className="mt-3 rounded-xl border border-border bg-elevated px-4 py-3 text-foreground"
          />
          <Pressable
            onPress={() => setCustomIncluded((currentValue) => !currentValue)}
            className={`mt-3 rounded-xl border px-4 py-3 ${customIncluded ? "border-brand bg-brand/12" : "border-border bg-elevated"}`}
            style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
          >
            <Text className="text-center text-sm text-foreground font-['Inter_600SemiBold']">
              {customIncluded ? "Custom alternative included" : "Include custom alternative"}
            </Text>
          </Pressable>
        </View>

        <View className="mt-auto flex-row gap-3 pt-2">
          <Pressable
            onPress={() => router.back()}
            className="flex-1 rounded-xl border border-border bg-surface px-4 py-4"
            style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
          >
            <Text className="text-center text-base text-secondary font-['Inter_600SemiBold']">
              Back
            </Text>
          </Pressable>
          <Pressable
            onPress={handleContinue}
            disabled={!canContinue || isSaving}
            className="flex-1 rounded-xl bg-brand-strong px-4 py-4"
            style={({ pressed }) => [{ opacity: pressed || !canContinue || isSaving ? 0.92 : 1 }]}
          >
            <Text className="text-center text-base text-foreground font-['Inter_600SemiBold']">
              {isSaving ? "Saving..." : "Continue"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Container>
  );
}
