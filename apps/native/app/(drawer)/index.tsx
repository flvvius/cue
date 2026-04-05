import { Redirect } from "expo-router";

export default function DrawerIndexRedirect() {
  return <Redirect href="/(drawer)/(tabs)" />;
}
