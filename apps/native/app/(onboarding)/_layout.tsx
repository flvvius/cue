import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="permission" />
      <Stack.Screen name="exclusions" />
      <Stack.Screen name="limit" />
      <Stack.Screen name="alternatives" />
      <Stack.Screen name="style" />
      <Stack.Screen name="review" />
    </Stack>
  );
}
