/**
 * 범용 버튼. variant로 색을, size로 크기를 고른다.
 * 모달 확인/취소, 폼 저장 등 화면마다 인라인으로 만들던 버튼을 통일.
 *
 * variant: primary(액센트) · ghost(카드+보더) · text(투명) · destructive(삭제)
 * size:    sm(pill) · md(기본) · lg(큰 액션)
 */
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { DesignColors } from "@/components/design/colors";
import { FontSize, FontWeight, Radius } from "@/components/design/tokens";

export type ButtonVariant = "primary" | "ghost" | "text" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<
  ButtonVariant,
  { bg: string; text: string; border: string }
> = {
  primary: {
    bg: DesignColors.accent,
    text: DesignColors.textOnAccent,
    border: "transparent",
  },
  ghost: {
    bg: DesignColors.bgCard,
    text: DesignColors.textSecondary,
    border: DesignColors.bgBorder,
  },
  text: {
    bg: "transparent",
    text: DesignColors.textMuted,
    border: "transparent",
  },
  destructive: {
    bg: DesignColors.swipeDeleteBg,
    text: DesignColors.swipeDeleteText,
    border: DesignColors.swipeDeleteText,
  },
};

const SIZE: Record<
  ButtonSize,
  { fontSize: number; padV: number; padH: number; radius: number }
> = {
  sm: { fontSize: FontSize.sm, padV: 7, padH: 12, radius: Radius.pill },
  md: { fontSize: FontSize.lg, padV: 10, padH: 18, radius: Radius.md },
  lg: { fontSize: 17, padV: 13, padH: 24, radius: Radius.card },
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  /** true면 라벨 대신 스피너 표시 + 입력 비활성 */
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = VARIANT[variant];
  const s = SIZE[size];
  const blocked = disabled || loading;

  return (
    <Pressable
      onPress={blocked ? undefined : onPress}
      disabled={blocked}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          paddingVertical: s.padV,
          paddingHorizontal: s.padH,
          borderRadius: s.radius,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? "stretch" : undefined,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: blocked }}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <Text style={[styles.label, { color: v.text, fontSize: s.fontSize }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    minWidth: 72,
  },
  label: {
    fontWeight: FontWeight.semibold,
  },
});
