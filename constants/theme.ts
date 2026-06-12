/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

import { DesignColors } from '@/components/design/colors';

const tintColorLight = DesignColors.accent;
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: DesignColors.textPrimary,
    background: DesignColors.bg,
    tint: tintColorLight,
    icon: DesignColors.textSecondary,
    tabIconDefault: DesignColors.textMuted,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'Pretendard-Regular',
    serif: 'ui-serif',
    rounded: 'Pretendard-Medium',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'Pretendard-Regular',
    serif: 'serif',
    rounded: 'Pretendard-Medium',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
