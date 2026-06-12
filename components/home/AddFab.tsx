import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddManual: () => void;
  onAddFromChart: () => void;
  onAddFromYoutube: () => void;
}) {
  const insets = useSafeAreaInsets();

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
              <Ionicons name="logo-youtube" size={22} color="#FF0000" />
              <ThemedText type="defaultSemiBold">YouTube에서 추가</ThemedText>
            </Pressable>
          </View>
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
    shadowColor: "#000",
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
  main: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: DesignColors.bg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
    elevation: 8,
  },
});
