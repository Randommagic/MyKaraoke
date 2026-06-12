import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChartModalSongPreview } from "@/components/chart/ChartModalSongPreview";
import { ChartRow } from "@/components/chart/ChartRow";
import { Button } from "@/components/design/Button";
import { DesignColors } from "@/components/design/colors";
import { EdgeFadeScroller } from "@/components/design/EdgeFadeScroller";
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

const CATEGORY_FADE_WIDTH = 28;

function ChartCategoryScroller({
  categoryId,
  onSelect,
}: {
  categoryId: ChartCategoryId;
  onSelect: (id: ChartCategoryId) => void;
}) {
  return (
    <EdgeFadeScroller
      fadeWidth={CATEGORY_FADE_WIDTH}
      style={styles.categoryScroller}
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
    </EdgeFadeScroller>
  );
}

function chartCategoryToStrType(
  categoryId: ChartCategoryId,
): TjChartStrType | undefined {
  return categoryId === "all" ? undefined : categoryId;
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
              <Button
                label="취소"
                variant="text"
                onPress={() => setPendingAdd(null)}
                disabled={savingAdd}
              />
              <Button
                label="추가"
                onPress={() => void confirmAdd()}
                loading={savingAdd}
              />
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
              <Button
                label="닫기"
                variant="text"
                onPress={() => setDuplicateExisting(null)}
              />
              <Button
                label="내 곡으로 이동"
                onPress={() => {
                  const id = duplicateExisting?.id;
                  setDuplicateExisting(null);
                  if (id) {
                    router.push({ pathname: "/song/[id]", params: { id } });
                  }
                }}
              />
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
              <Button
                label="닫기"
                variant="text"
                onPress={() => setAddedSong(null)}
              />
              <Button
                label="해당 곡으로 이동"
                onPress={() => {
                  const id = addedSong?.song.id;
                  setAddedSong(null);
                  if (id) {
                    router.push({ pathname: "/song/[id]", params: { id } });
                  }
                }}
              />
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
  modalActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
});
