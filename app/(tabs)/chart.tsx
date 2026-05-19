import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DesignColors } from "@/components/design/colors";
import { MarqueeText } from "@/components/design/MarqueeText";
import { ScreenTitle } from "@/components/design/ScreenTitle";
import { ThemedText } from "@/components/themed-text";
import { logDebug } from "@/lib/debug-log-buffer";
import { sanitizeKaraokeDigits } from "@/lib/song-form-helpers";
import {
  buildDefaultTjTopAndHotQuery,
  ensureTjChartLoaded,
  formatTjChartPeriodSubtitle,
  getTjChartSessionCache,
  songFromTjChartItem,
  TJ_CHART_CATEGORY_OPTIONS,
  type TjChartStrType,
  type TjTopChartSongItem,
} from "@/lib/tjmedia-chart";
import { loadSongs, saveSongs, type Song } from "@/lib/songs-storage";

type ChartProvider = "tj" | "ky";
type ChartCategoryId = "all" | TjChartStrType;

const CATEGORY_SCROLL_EDGE_THRESHOLD = 8;
const CATEGORY_FADE_WIDTH = 28;

function getRankTextStyle(rankStr: string): {
  fontSize: number;
  color: string;
  fontWeight: "600" | "500";
} {
  const n = Number.parseInt(rankStr.trim(), 10);
  if (n === 1) {
    return {
      fontSize: 17,
      color: DesignColors.accent,
      fontWeight: "600",
    };
  }
  if (n === 2) {
    return {
      fontSize: 16,
      color: DesignColors.chartRank2,
      fontWeight: "600",
    };
  }
  return {
    fontSize: 14,
    color: DesignColors.textMuted,
    fontWeight: "500",
  };
}

function ChartCategoryScroller({
  categoryId,
  onSelect,
}: {
  categoryId: ChartCategoryId;
  onSelect: (id: ChartCategoryId) => void;
}) {
  const [scrollX, setScrollX] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  const canScroll =
    contentWidth > viewportWidth + CATEGORY_SCROLL_EDGE_THRESHOLD;
  const showLeftFade = canScroll && scrollX > CATEGORY_SCROLL_EDGE_THRESHOLD;
  const showRightFade =
    canScroll &&
    scrollX + viewportWidth <
      contentWidth - CATEGORY_SCROLL_EDGE_THRESHOLD;

  return (
    <View style={styles.categoryScroller}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => setScrollX(e.nativeEvent.contentOffset.x)}
        onLayout={(e) => setViewportWidth(e.nativeEvent.layout.width)}
        onContentSizeChange={(w) => setContentWidth(w)}
        contentContainerStyle={styles.categoryScrollContent}
      >
        {TJ_CHART_CATEGORY_OPTIONS.map((opt) => {
          const selected = categoryId === opt.id;
          return (
            <Pressable
              key={String(opt.id)}
              onPress={() => onSelect(opt.id)}
              style={({ pressed }) => [
                styles.categoryChip,
                selected ? styles.categoryChipActive : styles.categoryChipInactive,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${opt.label} 차트`}
            >
              <Text
                style={[
                  styles.categoryChipLabel,
                  selected
                    ? styles.categoryChipLabelActive
                    : styles.categoryChipLabelInactive,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {showLeftFade ? (
        <LinearGradient
          colors={[DesignColors.bg, "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.categoryFade, styles.categoryFadeLeft]}
          pointerEvents="none"
        />
      ) : null}
      {showRightFade ? (
        <LinearGradient
          colors={["transparent", DesignColors.bg]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.categoryFade, styles.categoryFadeRight]}
          pointerEvents="none"
        />
      ) : null}
    </View>
  );
}

function chartCategoryToStrType(
  categoryId: ChartCategoryId,
): TjChartStrType | undefined {
  return categoryId === "all" ? undefined : categoryId;
}

function ChartRow({
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
      style={({ pressed }) => [
        styles.row,
        { opacity: pressed ? 0.75 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${rankLabel}위 ${item.indexTitle} ${item.indexSong}${isInList ? ", 이미 내 리스트에 있음" : ""}, 차트에서 선택`}
    >
      <View style={styles.rankCol}>
        <Text
          style={[styles.rankText, rankStyle]}
          numberOfLines={1}
        >
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
          <Ionicons
            name="musical-notes"
            size={20}
            color={DesignColors.textFaint}
          />
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
        <View
          style={styles.inListBadge}
          accessibilityLabel="내 리스트에 추가됨"
        >
          <Ionicons
            name="checkmark"
            size={16}
            color={DesignColors.inListCheck}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

export default function PopularChartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [provider, setProvider] = useState<ChartProvider>("tj");
  const [chartCategory, setChartCategory] = useState<ChartCategoryId>("all");
  const chartStrType = chartCategoryToStrType(chartCategory);
  const [loading, setLoading] = useState(
    () => getTjChartSessionCache(chartStrType) === null,
  );
  const [items, setItems] = useState<TjTopChartSongItem[]>(
    () => getTjChartSessionCache(chartStrType)?.items ?? [],
  );
  const [error, setError] = useState<string | null>(
    () => getTjChartSessionCache(chartStrType)?.error ?? null,
  );
  const [pendingAdd, setPendingAdd] = useState<TjTopChartSongItem | null>(null);
  const [duplicateExisting, setDuplicateExisting] = useState<Song | null>(null);
  const [savingAdd, setSavingAdd] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [mySongs, setMySongs] = useState<Song[]>([]);
  const [tjPeriod, setTjPeriod] = useState(() => {
    const cached = getTjChartSessionCache(chartStrType);
    const q = buildDefaultTjTopAndHotQuery(chartStrType);
    return {
      start: cached?.searchStartDate ?? q.searchStartDate,
      end: cached?.searchEndDate ?? q.searchEndDate,
    };
  });
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const tjPeriodSubtitle = useMemo(
    () =>
      formatTjChartPeriodSubtitle(tjPeriod.start, tjPeriod.end, chartStrType),
    [chartStrType, tjPeriod.end, tjPeriod.start],
  );

  const addedTjNumbers = useMemo(() => {
    const set = new Set<string>();
    for (const s of mySongs) {
      const tj = sanitizeKaraokeDigits(s.tjNumber);
      if (tj) set.add(tj);
    }
    return set;
  }, [mySongs]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const list = await loadSongs();
        if (!cancelled) setMySongs(list);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const showAddedToast = useCallback(() => {
    setToastVisible(true);
    toastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(2200),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setToastVisible(false));
  }, [toastOpacity]);

  useEffect(() => {
    if (provider !== "tj") {
      setLoading(false);
      return;
    }

    const strType = chartStrType;
    const cached = getTjChartSessionCache(strType);
    if (cached !== null) {
      setItems(cached.items);
      setError(cached.error);
      setTjPeriod({
        start: cached.searchStartDate,
        end: cached.searchEndDate,
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setItems([]);

    let cancelled = false;
    void ensureTjChartLoaded(strType).then(() => {
      if (cancelled) return;
      const next = getTjChartSessionCache(strType);
      if (next) {
        setItems(next.items);
        setError(next.error);
        setTjPeriod({
          start: next.searchStartDate,
          end: next.searchEndDate,
        });
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [provider, chartStrType]);

  const confirmAdd = useCallback(async () => {
    if (!pendingAdd || savingAdd) return;
    setSavingAdd(true);
    try {
      const existing = await loadSongs();
      const tjNum = sanitizeKaraokeDigits(String(pendingAdd.pro));
      if (tjNum) {
        const found = existing.find(
          (s) => sanitizeKaraokeDigits(s.tjNumber) === tjNum,
        );
        if (found) {
          setPendingAdd(null);
          setDuplicateExisting(found);
          return;
        }
      }
      const song = songFromTjChartItem(pendingAdd);
      const next = [song, ...existing];
      await saveSongs(next);
      setMySongs(next);
      logDebug(`[chart] TJ 차트에서 추가: ${song.title}`, "info");
      setPendingAdd(null);
      showAddedToast();
    } catch (e) {
      logDebug(
        `[chart] 리스트 추가 실패: ${e instanceof Error ? e.message : String(e)}`,
        "error",
      );
    } finally {
      setSavingAdd(false);
    }
  }, [pendingAdd, savingAdd, showAddedToast]);

  const formatDuplicateLine = (song: Song) => {
    const title = song.title.trim() || "(제목 없음)";
    const artist = song.artist.trim();
    const tj = sanitizeKaraokeDigits(song.tjNumber);
    const parts = [title];
    if (artist) parts.push(artist);
    if (tj) parts.push(`TJ ${tj}`);
    return parts.join(" · ");
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <ScreenTitle>인기 차트</ScreenTitle>
        <View style={styles.providerRow}>
          {(["tj", "ky"] as const).map((key) => {
            const selected = provider === key;
            const label = key === "tj" ? "TJ" : "KY";
            return (
              <Pressable
                key={key}
                onPress={() => setProvider(key)}
                style={({ pressed }) => [
                  styles.providerChip,
                  selected
                    ? styles.providerChipActive
                    : styles.providerChipInactive,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${label} 차트`}
              >
                <Text
                  style={[
                    styles.providerChipLabel,
                    selected
                      ? styles.providerChipLabelActive
                      : styles.providerChipLabelInactive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {provider === "tj" ? (
          <ChartCategoryScroller
            categoryId={chartCategory}
            onSelect={setChartCategory}
          />
        ) : null}
        <Text style={styles.periodText}>
          {provider === "tj" ? tjPeriodSubtitle : "KY — 준비중"}
        </Text>
      </View>

      {provider === "ky" ? (
        <View style={styles.centered}>
          <Text style={styles.kyPlaceholder}>KY 차트는 준비 중입니다.</Text>
        </View>
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={DesignColors.accent} />
        </View>
      ) : error ? (
        <View style={styles.pad}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => `${chartCategory}-${it.pro}-${it.rank}`}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const tjNum = sanitizeKaraokeDigits(String(item.pro));
            const isInList = Boolean(tjNum && addedTjNumbers.has(tjNum));
            return (
              <ChartRow
                item={item}
                isInList={isInList}
                onPress={() => setPendingAdd(item)}
              />
            );
          }}
        />
      )}

      <Modal
        visible={pendingAdd !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !savingAdd && setPendingAdd(null)}
      >
        <Pressable
          style={styles.bubbleBackdrop}
          onPress={() => !savingAdd && setPendingAdd(null)}
          accessibilityLabel="닫기"
        >
          <Pressable
            style={[styles.bubbleCard, styles.bubbleCardSurface]}
            onPress={(e) => e.stopPropagation()}
          >
            <ThemedText type="subtitle" style={styles.bubbleTitle}>
              내 리스트에 추가
            </ThemedText>
            <ThemedText style={styles.bubbleQuestion}>
              이 곡을 내 리스트에 추가하시겠습니까?
            </ThemedText>
            {pendingAdd ? (
              <ThemedText style={styles.bubbleSummary} numberOfLines={3}>
                {pendingAdd.indexTitle}
                {"\n"}
                {pendingAdd.indexSong}
                {"\n"}
                TJ {pendingAdd.pro}
              </ThemedText>
            ) : null}
            <View style={styles.bubbleActions}>
              <Pressable
                onPress={() => !savingAdd && setPendingAdd(null)}
                style={({ pressed }) => [
                  styles.bubbleBtn,
                  styles.bubbleBtnGhost,
                  { opacity: pressed ? 0.75 : 1 },
                ]}
                disabled={savingAdd}
                accessibilityRole="button"
                accessibilityLabel="취소"
              >
                <ThemedText style={{ fontWeight: "600" }}>취소</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => void confirmAdd()}
                style={({ pressed }) => [
                  styles.bubbleBtn,
                  styles.bubbleBtnPrimary,
                  { opacity: savingAdd ? 0.55 : pressed ? 0.88 : 1 },
                ]}
                disabled={savingAdd}
                accessibilityRole="button"
                accessibilityLabel="추가"
              >
                <ThemedText style={styles.bubbleBtnPrimaryLabel}>
                  {savingAdd ? "추가 중…" : "추가"}
                </ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={duplicateExisting !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDuplicateExisting(null)}
      >
        <Pressable
          style={styles.bubbleBackdrop}
          onPress={() => setDuplicateExisting(null)}
          accessibilityLabel="닫기"
        >
          <Pressable
            style={[styles.bubbleCard, styles.bubbleCardSurface]}
            onPress={(e) => e.stopPropagation()}
          >
            <ThemedText type="subtitle" style={styles.bubbleTitle}>
              이미 내 리스트에 있는 곡이에요
            </ThemedText>
            {duplicateExisting ? (
              <ThemedText style={styles.bubbleSummary} numberOfLines={3}>
                {formatDuplicateLine(duplicateExisting)}
              </ThemedText>
            ) : null}
            <View style={styles.bubbleActions}>
              <Pressable
                onPress={() => {
                  const id = duplicateExisting?.id;
                  setDuplicateExisting(null);
                  if (id) {
                    router.push({ pathname: "/song/[id]", params: { id } });
                  }
                }}
                style={({ pressed }) => [
                  styles.bubbleBtn,
                  styles.bubbleBtnPrimary,
                  { opacity: pressed ? 0.88 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="내 곡으로 이동"
              >
                <ThemedText style={styles.bubbleBtnPrimaryLabel}>
                  내 곡으로 이동
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setDuplicateExisting(null)}
                style={({ pressed }) => [
                  styles.bubbleBtn,
                  styles.bubbleBtnGhost,
                  { opacity: pressed ? 0.75 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="닫기"
              >
                <ThemedText style={{ fontWeight: "600" }}>닫기</ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {toastVisible ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            {
              opacity: toastOpacity,
              bottom: Math.max(insets.bottom, 12) + 56,
            },
          ]}
        >
          <ThemedText style={styles.toastText}>리스트에 추가됐어요</ThemedText>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: DesignColors.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 10,
  },
  providerRow: {
    flexDirection: "row",
    gap: 10,
  },
  providerChip: {
    paddingVertical: 7,
    paddingHorizontal: 22,
    borderRadius: 20,
  },
  providerChipInactive: {
    backgroundColor: DesignColors.bgCard,
    borderWidth: 1,
    borderColor: DesignColors.bgBorder,
  },
  providerChipActive: {
    backgroundColor: DesignColors.accent,
    borderWidth: 0,
  },
  providerChipLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  providerChipLabelInactive: {
    color: DesignColors.textSecondary,
  },
  providerChipLabelActive: {
    color: DesignColors.textOnAccent,
  },
  categoryScroller: {
    position: "relative",
    marginTop: 2,
  },
  categoryScrollContent: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 4,
  },
  categoryChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  categoryChipInactive: {
    backgroundColor: DesignColors.bgCard,
    borderColor: DesignColors.bgBorder,
  },
  categoryChipActive: {
    backgroundColor: DesignColors.filterChipActiveBg,
    borderColor: DesignColors.accent,
  },
  categoryChipLabel: {
    fontSize: 14,
  },
  categoryChipLabelInactive: {
    color: DesignColors.textSecondary,
    fontWeight: "500",
  },
  categoryChipLabelActive: {
    color: DesignColors.accent,
    fontWeight: "500",
  },
  categoryFade: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: CATEGORY_FADE_WIDTH,
    zIndex: 1,
  },
  categoryFadeLeft: {
    left: 0,
  },
  categoryFadeRight: {
    right: 0,
  },
  periodText: {
    fontSize: 11,
    color: DesignColors.textMuted,
    lineHeight: 16,
  },
  pad: {
    paddingHorizontal: 20,
  },
  error: {
    color: DesignColors.danger,
    fontSize: 14,
  },
  kyPlaceholder: {
    fontSize: 15,
    color: DesignColors.textMuted,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  listContent: {
    paddingBottom: 24,
  },
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
  bubbleBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  bubbleCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
  bubbleCardSurface: {
    backgroundColor: DesignColors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DesignColors.bgBorder,
  },
  bubbleTitle: {
    marginBottom: 8,
  },
  bubbleQuestion: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
    color: DesignColors.textPrimary,
  },
  bubbleSummary: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
    color: DesignColors.textSecondary,
  },
  bubbleActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  bubbleBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 88,
    alignItems: "center",
  },
  bubbleBtnGhost: {
    borderWidth: 1,
    borderColor: DesignColors.bgBorder,
  },
  bubbleBtnPrimary: {
    backgroundColor: DesignColors.accent,
  },
  bubbleBtnPrimaryLabel: {
    fontWeight: "700",
    color: DesignColors.textOnAccent,
  },
  toast: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: DesignColors.toastBg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  toastText: {
    color: DesignColors.toastText,
    fontSize: 14,
    fontWeight: "600",
  },
});
