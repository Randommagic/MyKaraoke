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
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DesignColors } from "@/components/design/colors";
import { MarqueeText } from "@/components/design/MarqueeText";
import { ScreenTitle } from "@/components/design/ScreenTitle";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";
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

function ChartCategoryScroller({
  categoryId,
  onSelect,
  tint,
  textColor,
  borderColor,
  colorScheme,
  screenBg,
}: {
  categoryId: ChartCategoryId;
  onSelect: (id: ChartCategoryId) => void;
  tint: string;
  textColor: string;
  borderColor: string;
  colorScheme: "light" | "dark";
  screenBg: string;
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

  const chipBgUnselected =
    colorScheme === "dark" ? "#2c2c2e" : DesignColors.bgCard;

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
                {
                  borderColor: selected ? tint : borderColor,
                  backgroundColor: selected ? `${tint}22` : chipBgUnselected,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${opt.label} 차트`}
            >
              <ThemedText
                style={{
                  fontSize: 14,
                  fontWeight: selected ? "700" : "500",
                  color: selected ? tint : textColor,
                }}
              >
                {opt.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
      {showLeftFade ? (
        <LinearGradient
          colors={[screenBg, "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.categoryFade, styles.categoryFadeLeft]}
          pointerEvents="none"
        />
      ) : null}
      {showRightFade ? (
        <LinearGradient
          colors={["transparent", screenBg]}
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
  borderColor,
  subColor,
  rankColor,
  titleColor,
  isInList,
  onPress,
}: {
  item: TjTopChartSongItem;
  borderColor: string;
  subColor: string;
  rankColor: string;
  titleColor: string;
  isInList: boolean;
  onPress: () => void;
}) {
  const uri = item.imgthumb_path?.trim();
  const rankLabel = item.rank?.trim() || "—";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: borderColor, opacity: pressed ? 0.75 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${rankLabel}위 ${item.indexTitle} ${item.indexSong}${isInList ? ", 이미 내 리스트에 있음" : ""}, 차트에서 선택`}
    >
      <View style={styles.rankCol}>
        <ThemedText
          style={[styles.rankText, { color: rankColor }]}
          numberOfLines={1}
        >
          {rankLabel}
        </ThemedText>
      </View>
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.thumb}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]} />
      )}
      <View style={styles.rowText}>
        <MarqueeText
          text={item.indexTitle}
          color={titleColor}
          style={styles.chartTitle}
        />
        <ThemedText
          style={[styles.artist, { color: subColor }]}
          numberOfLines={1}
        >
          {item.indexSong}
        </ThemedText>
      </View>
      {isInList ? (
        <View
          style={styles.inListCheckWrap}
          accessibilityLabel="내 리스트에 추가됨"
        >
          <Ionicons
            name="checkmark-circle"
            size={22}
            color={DesignColors.accent}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

export default function PopularChartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? "light";
  const tint = useThemeColor({}, "tint");
  const screenBg = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const borderColor = useThemeColor(
    { light: "#e5e5ea", dark: "#3a3a3c" },
    "icon",
  );
  const subColor = useThemeColor({ light: "#636366", dark: "#98989d" }, "icon");

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

  const chipMuted = useThemeColor(
    { light: "#8e8e93", dark: "#8e8e93" },
    "icon",
  );

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
    <ThemedView style={[styles.root, { paddingTop: insets.top + 12 }]}>
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
                  {
                    borderColor: selected ? tint : borderColor,
                    backgroundColor: selected
                      ? `${tint}22`
                      : colorScheme === "dark"
                        ? "#2c2c2e"
                        : "#f5f5f5",
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${label} 차트`}
              >
                <ThemedText
                  style={{
                    fontSize: 15,
                    fontWeight: selected ? "700" : "500",
                    color: selected ? tint : textColor,
                  }}
                >
                  {label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
        {provider === "tj" ? (
          <ChartCategoryScroller
            categoryId={chartCategory}
            onSelect={setChartCategory}
            tint={tint}
            textColor={textColor}
            borderColor={borderColor}
            colorScheme={colorScheme}
            screenBg={screenBg}
          />
        ) : null}
        <ThemedText style={[styles.sub, { color: chipMuted }]}>
          {provider === "tj" ? tjPeriodSubtitle : "KY — 준비중"}
        </ThemedText>
      </View>

      {provider === "ky" ? (
        <View style={styles.centered}>
          <ThemedText style={styles.kyPlaceholder}>
            KY 차트는 준비 중입니다.
          </ThemedText>
        </View>
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={tint} />
        </View>
      ) : error ? (
        <View style={styles.pad}>
          <ThemedText style={styles.error}>{error}</ThemedText>
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
                borderColor={borderColor}
                subColor={subColor}
                rankColor={textColor}
                titleColor={textColor}
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
            style={[
              styles.bubbleCard,
              {
                backgroundColor: colorScheme === "dark" ? "#2c2c2e" : "#fff",
                borderColor: borderColor,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <ThemedText type="subtitle" style={styles.bubbleTitle}>
              내 리스트에 추가
            </ThemedText>
            <ThemedText style={[styles.bubbleQuestion, { color: textColor }]}>
              이 곡을 내 리스트에 추가하시겠습니까?
            </ThemedText>
            {pendingAdd ? (
              <ThemedText
                style={[styles.bubbleSummary, { color: subColor }]}
                numberOfLines={3}
              >
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
                  { borderColor: borderColor, opacity: pressed ? 0.75 : 1 },
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
                  {
                    backgroundColor: tint,
                    opacity: savingAdd ? 0.55 : pressed ? 0.88 : 1,
                  },
                ]}
                disabled={savingAdd}
                accessibilityRole="button"
                accessibilityLabel="추가"
              >
                <ThemedText
                  style={{ fontWeight: "700", color: "#fff" }}
                >
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
            style={[
              styles.bubbleCard,
              {
                backgroundColor: colorScheme === "dark" ? "#2c2c2e" : "#fff",
                borderColor: borderColor,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <ThemedText type="subtitle" style={styles.bubbleTitle}>
              이미 내 리스트에 있는 곡이에요
            </ThemedText>
            {duplicateExisting ? (
              <ThemedText
                style={[styles.bubbleSummary, { color: subColor }]}
                numberOfLines={3}
              >
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
                  {
                    backgroundColor: tint,
                    opacity: pressed ? 0.88 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="내 곡으로 이동"
              >
                <ThemedText style={{ fontWeight: "700", color: "#fff" }}>
                  내 곡으로 이동
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setDuplicateExisting(null)}
                style={({ pressed }) => [
                  styles.bubbleBtn,
                  styles.bubbleBtnGhost,
                  { borderColor: borderColor, opacity: pressed ? 0.75 : 1 },
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
              backgroundColor: colorScheme === "dark" ? "#3a3a3c" : "#323232",
            },
          ]}
        >
          <ThemedText style={styles.toastText}>리스트에 추가됐어요</ThemedText>
        </Animated.View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  providerRow: {
    flexDirection: "row",
    gap: 10,
  },
  providerChip: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
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
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
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
  sub: {
    fontSize: 13,
  },
  pad: {
    paddingHorizontal: 16,
  },
  error: {
    color: "#c62828",
    fontSize: 14,
  },
  kyPlaceholder: {
    fontSize: 15,
    opacity: 0.75,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  rankCol: {
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    fontSize: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: "#2c2c2e20",
  },
  thumbPlaceholder: {
    backgroundColor: "#c6c6c833",
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  artist: {
    fontSize: 14,
  },
  inListCheckWrap: {
    marginLeft: 2,
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
    borderWidth: StyleSheet.hairlineWidth,
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
  bubbleTitle: {
    marginBottom: 8,
  },
  bubbleQuestion: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  bubbleSummary: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
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
  },
  bubbleBtnPrimary: {},
  toast: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  toastText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
