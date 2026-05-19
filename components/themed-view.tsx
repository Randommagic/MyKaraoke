import { View, type ViewProps } from 'react-native';

import { DesignColors } from '@/components/design/colors';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
  const backgroundColor = lightColor ?? darkColor ?? DesignColors.bg;

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
