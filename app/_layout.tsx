import 'react-native-gesture-handler';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { ConfirmDialogProvider } from '@/components/design/confirm-dialog-context';
import { YoutubeShareIntentProvider } from '@/components/youtube-share-intent-provider';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { installGlobalConsoleCapture, installUnhandledErrorLogging } from '@/lib/debug-log-buffer';
import { installPretendard, PRETENDARD_FONTS } from '@/lib/pretendard';
import { prefetchTjTopChartInBackground } from '@/lib/tjmedia-chart';

export const unstable_settings = {
  anchor: '(tabs)',
};

// 폰트 로드 완료까지 스플래시 유지
void SplashScreen.preventAutoHideAsync();

// Text/TextInput 기본 폰트를 Pretendard로 매핑 (모듈 로드 시 1회)
installPretendard();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts(PRETENDARD_FONTS);

  useEffect(() => {
    installGlobalConsoleCapture();
    installUnhandledErrorLogging();
    const task = InteractionManager.runAfterInteractions(() => {
      prefetchTjTopChartInBackground();
    });
    return () => task.cancel();
  }, []);

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <YoutubeShareIntentProvider>
            <ConfirmDialogProvider>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="song/[id]"
                  options={{ headerShown: false }}
                />
              </Stack>
              <StatusBar style="auto" />
            </ConfirmDialogProvider>
          </YoutubeShareIntentProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
