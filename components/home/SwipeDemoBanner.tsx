/**
 * 첫 곡이 생긴 직후 목록 상단에 1회 노출되는 스와이프 안내 배너.
 * SwipeHintDemo를 감싸 제목·설명·닫기를 덧붙인다.
 */
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DesignColors } from "@/components/design/colors";
import { FontSize, FontWeight, Radius, Spacing } from "@/components/design/tokens";
import { SwipeHintDemo, type DemoSong } from "@/components/onboarding/SwipeHintDemo";
import { UI_STRINGS } from "@/lib/ui-strings";

export function SwipeDemoBanner({ onDone, demoSong }: { onDone: () => void; demoSong?: DemoSong }) {
  return (
    <View style={styles.banner}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{UI_STRINGS.onboarding.sheetTitle}</Text>
        <Pressable
          onPress={onDone}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          accessibilityRole="button"
          accessibilityLabel="닫기"
        >
          <Ionicons name="close" size={20} color={DesignColors.textSecondary} />
        </Pressable>
      </View>
      <Text style={styles.desc}>{UI_STRINGS.onboarding.sheetSubtitle}</Text>
      <SwipeHintDemo autoPlay loop demoSong={demoSong} />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: DesignColors.filterChipActiveBg,
    borderWidth: 1,
    borderColor: DesignColors.bgBorder,
    borderRadius: Radius.modal,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  title: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: DesignColors.textPrimary,
  },
  desc: {
    fontSize: FontSize.sm,
    lineHeight: 19,
    color: DesignColors.textSecondary,
    marginBottom: Spacing.lg,
  },
});
