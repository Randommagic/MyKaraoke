/**
 * 홈 빈 화면 — 곡이 하나도 없을 때 목록 대신 표시.
 * 마이크 아이콘 + 안내 + 우하단 FAB를 가리키는 아래 방향 화살표.
 */
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { DesignColors } from "@/components/design/colors";
import { FontSize, FontWeight, Spacing } from "@/components/design/tokens";
import { UI_STRINGS } from "@/lib/ui-strings";

export function EmptyState() {
  return (
    <View style={styles.root}>
      <View style={styles.iconCircle}>
        <Ionicons name="mic-outline" size={40} color={DesignColors.accent} />
      </View>
      <Text style={styles.title}>{UI_STRINGS.onboarding.emptyTitle}</Text>
      <Text style={styles.desc}>{UI_STRINGS.onboarding.emptyDesc}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl5,
    paddingBottom: 80,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: DesignColors.filterChipActiveBg,
    marginBottom: Spacing.xl4,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: DesignColors.textPrimary,
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  desc: {
    fontSize: FontSize.base,
    lineHeight: 21,
    color: DesignColors.textSecondary,
    textAlign: "center",
  },
});
