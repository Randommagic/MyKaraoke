import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";

import { DesignColors } from "@/components/design/colors";

/** 탭 화면 상단 페이지 제목 (홈·차트·설정 등 통일 스타일) */
export const screenTitleStyle = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: "500",
    lineHeight: 28,
    color: DesignColors.textPrimary,
    letterSpacing: -0.5,
  },
});

export function ScreenTitle({
  children,
  style,
}: {
  children: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      style={[screenTitleStyle.title, style]}
      accessibilityRole="header"
    >
      {children}
    </Text>
  );
}
