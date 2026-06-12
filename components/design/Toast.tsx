/**
 * 공용 토스트 — fade-in 200ms → 유지 2200ms → fade-out 200ms.
 *
 * 사용:
 * ```tsx
 * const toast = useToast();
 * toast.show("저장했어요");
 * // 화면 최상단 형제로:
 * <Toast controller={toast} />
 * ```
 */
import { useCallback, useRef, useState } from "react";
import { Animated, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DesignColors } from "@/components/design/colors";
import {
  FontSize,
  FontWeight,
  Radius,
  Shadow,
  Spacing,
} from "@/components/design/tokens";
import { ThemedText } from "@/components/themed-text";

const FADE_IN_MS = 200;
const HOLD_MS = 2200;
const FADE_OUT_MS = 200;

export interface ToastController {
  visible: boolean;
  message: string;
  opacity: Animated.Value;
  show: (message: string) => void;
}

export function useToast(): ToastController {
  const opacity = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");

  const show = useCallback(
    (next: string) => {
      setMessage(next);
      setVisible(true);
      opacity.setValue(0);
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: FADE_IN_MS,
          useNativeDriver: true,
        }),
        Animated.delay(HOLD_MS),
        Animated.timing(opacity, {
          toValue: 0,
          duration: FADE_OUT_MS,
          useNativeDriver: true,
        }),
      ]).start(() => setVisible(false));
    },
    [opacity],
  );

  return { visible, message, opacity, show };
}

export function Toast({
  controller,
  /** 안전 영역 위로 추가로 띄울 거리(px). 탭 바 위면 56 등. */
  offset = Spacing.xl3,
}: {
  controller: ToastController;
  offset?: number;
}) {
  const insets = useSafeAreaInsets();
  if (!controller.visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        {
          opacity: controller.opacity,
          bottom: Math.max(insets.bottom, Spacing.xl) + offset,
        },
      ]}
    >
      <ThemedText style={styles.toastText}>{controller.message}</ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: Spacing.xl4,
    paddingVertical: Spacing.xl,
    borderRadius: Radius.pill,
    backgroundColor: DesignColors.toastBg,
    zIndex: 60,
    ...Shadow.modal,
  },
  toastText: {
    color: DesignColors.toastText,
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    textAlign: "center",
  },
});
