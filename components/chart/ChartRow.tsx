import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DesignColors } from "@/components/design/colors";
import { MarqueeText } from "@/components/design/MarqueeText";
import type { TjTopChartSongItem } from "@/lib/tjmedia-chart";

/** 순위 숫자 스타일 — 1·2위 강조, 나머지는 muted. */
function getRankTextStyle(rankStr: string): {
  fontSize: number;
  color: string;
  fontWeight: "600" | "500";
} {
  const n = Number.parseInt(rankStr.trim(), 10);
  if (n === 1) {
    return { fontSize: 17, color: DesignColors.accent, fontWeight: "600" };
  }
  if (n === 2) {
    return { fontSize: 16, color: DesignColors.chartRank2, fontWeight: "600" };
  }
  return { fontSize: 14, color: DesignColors.textMuted, fontWeight: "500" };
}

/** 인기 차트 목록의 한 행(순위·썸네일·제목·가수, 내 리스트 여부 뱃지). */
export function ChartRow({
  item,
  isInList,
  onPress,
}: {
  item: TjTopChartSongItem;
  isInList: boolean;
  onPress: () => void;
}) {
  const uri = item.imgthumb_path?.trim();
  const rankLabel = item.rank?.trim() || "—";
  const rankStyle = getRankTextStyle(rankLabel);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.75 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={`${rankLabel}위 ${item.indexTitle} ${item.indexSong}${isInList ? ", 이미 내 리스트에 있음" : ""}, 차트에서 선택`}
    >
      <View style={styles.rankCol}>
        <Text style={[styles.rankText, rankStyle]} numberOfLines={1}>
          {rankLabel}
        </Text>
      </View>
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.thumb}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Ionicons name="musical-notes" size={20} color={DesignColors.textFaint} />
        </View>
      )}
      <View style={styles.rowText}>
        <MarqueeText
          text={item.indexTitle}
          color={DesignColors.textPrimary}
          style={styles.chartTitle}
        />
        <Text style={styles.artist} numberOfLines={1}>
          {item.indexSong}
        </Text>
      </View>
      {isInList ? (
        <View style={styles.inListBadge} accessibilityLabel="내 리스트에 추가됨">
          <Ionicons name="checkmark" size={16} color={DesignColors.inListCheck} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: DesignColors.listDivider,
    gap: 12,
  },
  rankCol: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    fontVariant: ["tabular-nums"],
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: DesignColors.bgCard,
  },
  thumbPlaceholder: {
    backgroundColor: DesignColors.bgCard,
    borderWidth: 1,
    borderColor: DesignColors.bgBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  artist: {
    fontSize: 12,
    color: DesignColors.textSecondary,
    lineHeight: 16,
  },
  inListBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: DesignColors.inListBadgeBg,
    justifyContent: "center",
    alignItems: "center",
  },
});
