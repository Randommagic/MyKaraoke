import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DesignColors } from "@/components/design/colors";
import { ThemedText } from "@/components/themed-text";

/**
 * 홈 우하단 곡 추가 FAB + 스피드다이얼 메뉴(직접/차트/YouTube).
 *
 * 열림 상태는 부모가 보유하는 controlled 컴포넌트 — 화면 이탈 시 부모가
 * 닫아줄 수 있게 하기 위함.
 */
export function AddFab({
  open,
  onOpenChange,
  onAddManual,
  onAddFromChart,
  onAddFromYoutube,
  pulse = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddManual: () => void;
  onAddFromChart: () => void;
  onAddFromYoutube: () => void;
  /** 곡이 없을 때 + 버튼에 은은한 펄스로 추가를 유도 */
  pulse?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const pulseProgress = useSharedValue(0);

  // 메뉴가 닫혀 있고 pulse가 켜졌을 때만 링 반복
  const pulseActive = pulse && !open;
  useEffect(() => {
    if (pulseActive) {
      pulseProgress.value = withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      );
    } else {
      cancelAnimation(pulseProgress);
      pulseProgress.value = 0;
    }
    return () => cancelAnimation(pulseProgress);
  }, [pulseActive, pulseProgress]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: (1 - pulseProgress.value) * 0.45,
    transform: [{ scale: 1 + pulseProgress.value * 1.15 }],
  }));

  const runAndClose = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <>
      {open ? (
        <Pressable
          style={styles.scrim}
          onPress={() => onOpenChange(false)}
          accessibilityLabel="메뉴 닫기"
        />
      ) : null}

      <View
        style={[styles.stack, { bottom: Math.max(insets.bottom, 10) + 8 }]}
        pointerEvents="box-none"
      >
        {open ? (
          <View style={styles.bubble} accessibilityRole="menu">
            <Pressable
              onPress={() => runAndClose(onAddManual)}
              style={({ pressed }) => [
                styles.bubbleRow,
                { opacity: pressed ? 0.75 : 1 },
              ]}
              accessibilityRole="menuitem"
              accessibilityLabel="직접 추가"
            >
              <Ionicons
                name="create-outline"
                size={22}
                color={DesignColors.accent}
              />
              <ThemedText type="defaultSemiBold">직접 추가</ThemedText>
            </Pressable>
            <View style={styles.divider} />
            <Pressable
              onPress={() => runAndClose(onAddFromChart)}
              style={({ pressed }) => [
                styles.bubbleRow,
                { opacity: pressed ? 0.75 : 1 },
              ]}
              accessibilityRole="menuitem"
              accessibilityLabel="인기 차트에서 추가"
            >
              <Ionicons
                name="stats-chart"
                size={22}
                color={DesignColors.chartRank2}
              />
              <ThemedText type="defaultSemiBold">인기 차트에서 추가</ThemedText>
            </Pressable>
            <View style={styles.divider} />
            <Pressable
              onPress={() => runAndClose(onAddFromYoutube)}
              style={({ pressed }) => [
                styles.bubbleRow,
                { opacity: pressed ? 0.75 : 1 },
              ]}
              accessibilityRole="menuitem"
              accessibilityLabel="YouTube에서 추가"
            >
              <Ionicons name="logo-youtube" size={22} color={DesignColors.youtube} />
              <ThemedText type="defaultSemiBold">YouTube에서 추가</ThemedText>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.mainWrap}>
          {pulseActive ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.pulseRing, pulseStyle]}
            />
          ) : null}
          <Pressable
            onPress={() => onOpenChange(!open)}
            style={({ pressed }) => [
              styles.main,
              {
                backgroundColor: DesignColors.accent,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
            accessibilityLabel="곡 추가 메뉴 열기"
            accessibilityState={{ expanded: open }}
          >
            <Ionicons name="add" size={34} color={DesignColors.textOnAccent} />
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.22)",
    zIndex: 40,
  },
  stack: {
    position: "absolute",
    right: 20,
    zIndex: 50,
    alignItems: "flex-end",
    gap: 12,
  },
  bubble: {
    minWidth: 208,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DesignColors.bgBorder,
    backgroundColor: DesignColors.bgCard,
    overflow: "hidden",
    shadowColor: DesignColors.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  bubbleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: DesignColors.bgBorder,
    opacity: 0.85,
  },
  mainWrap: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: DesignColors.accent,
  },
  main: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: DesignColors.bg,
    shadowColor: DesignColors.textPrimary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
    elevation: 8,
  },
});
