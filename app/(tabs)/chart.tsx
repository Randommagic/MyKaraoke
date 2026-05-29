import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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

function ChartModalSongPreview({
  title,
  artist,
  tjPro,
  imageUri,
}: {
  title: string;
  artist: string;
  tjPro?: string | number;
  imageUri?: string | null;
}) {
  const uri = imageUri?.trim();
  const displayTitle = title.trim() || "(제목 없음)";
  const displayArtist = artist.trim();
  const tj = tjPro ? sanitizeKaraokeDigits(String(tjPro)) : "";

  return (
    <View style={styles.modalSongPreview}>
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.modalSongThumb}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.modalSongThumb, styles.thumbPlaceholder]}>
          <Ionicons
            name="musical-notes"
            size={20}
            color={DesignColors.textFaint}
          />
        </View>
      )}
      <View style={styles.modalSongText}>
        <Text style={styles.modalSongTitle} numberOfLines={2}>
          {displayTitle}
        </Text>
        {displayArtist ? (
          <Text style={styles.modalSongArtist} numberOfLines={1}>
            {displayArtist}
          </Text>
        ) : null}
        {tj ? (
          <View style={styles.modalTjPill}>
            <Text style={styles.modalTjPillLabel}>TJ {tj}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
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
  const [addedSong, setAddedSong] = useState<{
    song: Song;
    imageUri?: string | null;
  } | null>(null);
  const [savingAdd, setSavingAdd] = useState(false);
  const [mySongs, setMySongs] = useState<Song[]>([]);
  const [tjPeriod, setTjPeriod] = useState(() => {
    const cached = getTjChartSessionCache(chartStrType);
    const q = buildDefaultTjTopAndHotQuery(chartStrType);
    return {
      start: cached?.searchStartDate ?? q.searchStartDate,
      end: cached?.searchEndDate ?? q.searchEndDate,
    };
  });
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
      setAddedSong({
        song,
        imageUri: pendingAdd.imgthumb_path,
      });
    } catch (e) {
      logDebug(
        `[chart] 리스트 추가 실패: ${e instanceof Error ? e.message : String(e)}`,
        "error",
      );
    } finally {
      setSavingAdd(false);
    }
  }, [pendingAdd, savingAdd]);

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
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => !savingAdd && setPendingAdd(null)}
            accessibilityLabel="닫기"
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>내 리스트에 추가</Text>
            <Text style={styles.modalMessage}>
              이 곡을 내 노래 목록에 넣을까요?
            </Text>
            {pendingAdd ? (
              <ChartModalSongPreview
                title={pendingAdd.indexTitle}
                artist={pendingAdd.indexSong}
                tjPro={pendingAdd.pro}
                imageUri={pendingAdd.imgthumb_path}
              />
            ) : null}
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => !savingAdd && setPendingAdd(null)}
                style={({ pressed }) => [
                  styles.modalCancelBtn,
                  { opacity: pressed ? 0.65 : 1 },
                ]}
                disabled={savingAdd}
                accessibilityRole="button"
                accessibilityLabel="취소"
              >
                <Text style={styles.modalCancelLabel}>취소</Text>
              </Pressable>
              <Pressable
                onPress={() => void confirmAdd()}
                style={({ pressed }) => [
                  styles.modalConfirmBtn,
                  { opacity: savingAdd ? 0.55 : pressed ? 0.88 : 1 },
                ]}
                disabled={savingAdd}
                accessibilityRole="button"
                accessibilityLabel="추가"
              >
                <Text style={styles.modalConfirmLabel}>
                  {savingAdd ? "추가 중…" : "추가"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={duplicateExisting !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDuplicateExisting(null)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setDuplicateExisting(null)}
            accessibilityLabel="닫기"
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>이미 내 리스트에 있어요</Text>
            <Text style={styles.modalMessage}>
              아래 곡이 목록에 등록되어 있습니다.
            </Text>
            {duplicateExisting ? (
              <ChartModalSongPreview
                title={duplicateExisting.title}
                artist={duplicateExisting.artist}
                tjPro={duplicateExisting.tjNumber}
              />
            ) : null}
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setDuplicateExisting(null)}
                style={({ pressed }) => [
                  styles.modalCancelBtn,
                  { opacity: pressed ? 0.65 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="닫기"
              >
                <Text style={styles.modalCancelLabel}>닫기</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const id = duplicateExisting?.id;
                  setDuplicateExisting(null);
                  if (id) {
                    router.push({ pathname: "/song/[id]", params: { id } });
                  }
                }}
                style={({ pressed }) => [
                  styles.modalConfirmBtn,
                  { opacity: pressed ? 0.88 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="내 곡으로 이동"
              >
                <Text style={styles.modalConfirmLabel}>내 곡으로 이동</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={addedSong !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setAddedSong(null)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setAddedSong(null)}
            accessibilityLabel="닫기"
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>리스트에 추가됐어요</Text>
            <Text style={styles.modalMessage}>
              내 노래 목록에 저장했습니다.
            </Text>
            {addedSong ? (
              <ChartModalSongPreview
                title={addedSong.song.title}
                artist={addedSong.song.artist}
                tjPro={addedSong.song.tjNumber}
                imageUri={addedSong.imageUri}
              />
            ) : null}
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setAddedSong(null)}
                style={({ pressed }) => [
                  styles.modalCancelBtn,
                  { opacity: pressed ? 0.65 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="닫기"
              >
                <Text style={styles.modalCancelLabel}>닫기</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const id = addedSong?.song.id;
                  setAddedSong(null);
                  if (id) {
                    router.push({ pathname: "/song/[id]", params: { id } });
                  }
                }}
                style={({ pressed }) => [
                  styles.modalConfirmBtn,
                  { opacity: pressed ? 0.88 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="해당 곡으로 이동"
              >
                <Text style={styles.modalConfirmLabel}>해당 곡으로 이동</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: DesignColors.scrim,
  },
  modalCard: {
    backgroundColor: DesignColors.bgCard,
    borderWidth: 1,
    borderColor: DesignColors.bgBorder,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
    maxWidth: 400,
    width: "100%",
    alignSelf: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: DesignColors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    lineHeight: 21,
    color: DesignColors.textSecondary,
    marginBottom: 16,
  },
  modalSongPreview: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: DesignColors.inputSurface,
    borderWidth: 1,
    borderColor: DesignColors.bgBorder,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  modalSongThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: DesignColors.bgCard,
  },
  modalSongText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  modalSongTitle: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
    color: DesignColors.textPrimary,
    letterSpacing: -0.2,
  },
  modalSongArtist: {
    fontSize: 13,
    lineHeight: 18,
    color: DesignColors.textSecondary,
  },
  modalTjPill: {
    alignSelf: "flex-start",
    marginTop: 2,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: DesignColors.filterChipActiveBg,
  },
  modalTjPillLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: DesignColors.accent,
    letterSpacing: 0.2,
  },
  modalActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  modalCancelLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: DesignColors.textMuted,
  },
  modalConfirmBtn: {
    backgroundColor: DesignColors.accent,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
    minWidth: 72,
    alignItems: "center",
  },
  modalConfirmLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: DesignColors.textOnAccent,
  },
});
