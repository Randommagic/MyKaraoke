import { Stack } from "expo-router";

import { DesignColors } from "@/components/design/colors";

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: DesignColors.bg },
        headerTintColor: DesignColors.accent,
        headerTitleStyle: { color: DesignColors.textPrimary },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="backup" options={{ title: "백업 및 불러오기" }} />
      <Stack.Screen name="log" options={{ title: "로그" }} />
      <Stack.Screen name="dev" options={{ title: "개발자 메뉴" }} />
    </Stack>
  );
}
