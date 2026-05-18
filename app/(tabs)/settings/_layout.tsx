import { Stack } from "expo-router";

import { useThemeColor } from "@/hooks/use-theme-color";

export default function SettingsLayout() {
  const tint = useThemeColor({}, "tint");
  const text = useThemeColor({}, "text");
  const backgroundColor = useThemeColor(
    { light: "#fff", dark: "#000" },
    "background",
  );

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor },
        headerTintColor: tint,
        headerTitleStyle: { color: text },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="backup" options={{ title: "백업 및 불러오기" }} />
      <Stack.Screen name="log" options={{ title: "로그" }} />
    </Stack>
  );
}
