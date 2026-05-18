import 'react-native-gesture-handler';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { ConfirmDialogProvider } from '@/components/design/confirm-dialog-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { installGlobalConsoleCapture, installUnhandledErrorLogging } from '@/lib/debug-log-buffer';
import { prefetchTjTopChartInBackground } from '@/lib/tjmedia-chart';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    installGlobalConsoleCapture();
    installUnhandledErrorLogging();
    const task = InteractionManager.runAfterInteractions(() => {
      prefetchTjTopChartInBackground();
    });
    return () => task.cancel();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <ConfirmDialogProvider>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="song/[id]"
                options={{ title: "곡 정보", headerShown: true }}
              />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
            <StatusBar style="auto" />
          </ConfirmDialogProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
