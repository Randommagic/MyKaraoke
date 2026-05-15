import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { YoutubeImportModal } from "@/components/youtube-import-modal";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { logDebug } from "@/lib/debug-log-buffer";
import {
  formatSongListTitleLine,
  formatTranspose,
  formatTransposeForSongCard,
  GENDER_OPTIONS,
  isSungToday,
  localYmd,
  READINESS_VISUAL,
  sanitizeKaraokeDigits,
} from "@/lib/song-form-helpers";
import {
  createSongId,
  loadSongs,
  saveSongs,
  SONG_READINESS_OPTIONS,
  type Song,
  type SongGenderKey,
  type SongReadiness,
} from "@/lib/songs-storage";

type ReadinessFilter = "all" | SongReadiness;

const READINESS_FILTER_CHIPS: { value: ReadinessFilter; label: string }[] = [
  { value: "all", label: "전체" },
  ...SONG_READINESS_OPTIONS.map((o) => ({
    value: o.value as ReadinessFilter,
    label: o.label,
  })),
];

const ROW_TITLE_FONT = {
  fontSize: 15,
  lineHeight: 19,
  fontWeight: "600" as const,
};

const MARQUEE_PX_PER_SEC = 32;
const MARQUEE_DURATION_MIN_MS = 2000;
const MARQUEE_DURATION_MAX_MS = 35000;
const SWIPE_SUNG_ACTION_WIDTH = 148;

function SongRowTitleMarquee({ title }: { title: string }) {
  const textColor = useThemeColor({}, "text");
  const anim = useRef(new Animated.Value(0)).current;
  const [containerW, setContainerW] = useState(0);
  const [textW, setTextW] = useState<number | null>(null);
  const [measureEpoch, setMeasureEpoch] = useState(0);

  /** ScrollView·onLayout 등 여러 소스에서 오는 값 중 더 큰 쪽을 쓰면(웹+네이티브) 실제 글자 폭에 가깝게 맞출 수 있음 */
  const commitMeasuredWidth = useCallback((w: number) => {
    if (w <= 0 || !Number.isFinite(w)) return;
    setTextW((prev) => {
      if (prev == null) return w;
      return w > prev ? w : prev;
    });
  }, []);

  useEffect(() => {
    setTextW(null);
    anim.setValue(0);
    setMeasureEpoch((n) => n + 1);
  }, [title, anim]);

  useEffect(() => {
    if (textW == null || containerW <= 0) return;
    const overflow = textW - containerW;
    if (overflow <= 0) return;

    /** effect가 다시 돌 때 translate가 중간값이면, 같은 duration으로 남은 거리만 움직여 체감 속도가 극도로 느려짐 */
    anim.stopAnimation();
    anim.setValue(0);

    const distance = overflow + 28;
    const rawDuration = (distance / MARQUEE_PX_PER_SEC) * 1000;
    const duration = Math.min(
      MARQUEE_DURATION_MAX_MS,
      Math.max(MARQUEE_DURATION_MIN_MS, rawDuration),
    );
    const useNativeDriver = Platform.OS !== "web";
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(800),
        Animated.timing(anim, {
          toValue: -distance,
          duration,
          easing: Easing.linear,
          useNativeDriver,
        }),
        Animated.delay(300),
        Animated.timing(anim, {
          toValue: 0,
          duration: 0,
          useNativeDriver,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      anim.stopAnimation();
    };
  }, [title, containerW, textW, anim]);

  const measured = textW != null;
  const needsMarquee = measured && containerW > 0 && textW! > containerW;
  /** 마퀴 행만 고정 폭(말줄임 방지). 일반 행은 부모 폭에 맡김 — react-native-web은 onTextLayout이 없어 ScrollView 측정이 필수 */
  const marqueeTextWidthStyle =
    measured && needsMarquee ? { width: textW! } : null;

  return (
    <View
      style={styles.rowTitleMarqueeWrap}
      collapsable={false}
      onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}
    >
      <View
        style={styles.rowTitleMeasureHost}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        collapsable={false}
      >
        <ScrollView
          key={measureEpoch}
          horizontal
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          style={styles.rowTitleMeasureScroll}
          contentContainerStyle={styles.rowTitleMeasureScrollInner}
          onContentSizeChange={(cw) => commitMeasuredWidth(cw)}
        >
          <Text
            onLayout={(e) =>
              commitMeasuredWidth(e.nativeEvent.layout.width)
            }
            onTextLayout={(e) => {
              const lines = e.nativeEvent.lines;
              if (!lines.length) return;
              commitMeasuredWidth(
                Math.max(...lines.map((line) => line.width)),
              );
            }}
            style={[
              styles.rowTitleMarqueeText,
              ROW_TITLE_FONT,
              { color: textColor },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
        </ScrollView>
      </View>
      {needsMarquee ? (
        <Animated.View
          style={[
            styles.rowTitleMarqueeTrack,
            { transform: [{ translateX: anim }] },
          ]}
        >
          <Text
            style={[
              styles.rowTitleMarqueeText,
              ROW_TITLE_FONT,
              { color: textColor },
              marqueeTextWidthStyle,
            ]}
            numberOfLines={1}
            ellipsizeMode="clip"
          >
            {title}
          </Text>
        </Animated.View>
      ) : (
        <Text
          style={[
            styles.rowTitleMarqueeText,
            ROW_TITLE_FONT,
            { color: textColor },
          ]}
          numberOfLines={1}
          ellipsizeMode={measured ? undefined : "tail"}
        >
          {title}
        </Text>
      )}
    </View>
  );
}

function SongRowDetails({
  item,
  iconMuted,
}: {
  item: Song;
  iconMuted: string;
}) {
  const sungToday = isSungToday(item.lastSungAt);
  const showReadinessTag = item.readiness !== "none";
  const readinessLabel =
    SONG_READINESS_OPTIONS.find((o) => o.value === item.readiness)?.label ?? "";
  const transposeLabel = formatTransposeForSongCard(item.transposeSemitones);
  const rv = READINESS_VISUAL[item.readiness];
  const genderKey = item.genderKey;
  const genderShort =
    genderKey === "male" ? "남" : genderKey === "female" ? "여" : null;
  const genderColor =
    genderKey === "male"
      ? "#1565c0"
      : genderKey === "female"
        ? "#c62828"
        : undefined;

  const hasOtherSecondary =
    showReadinessTag || genderShort != null || transposeLabel != null;
  const hasSecondary = sungToday || hasOtherSecondary;

  const extras = (
    <>
      {genderShort ? (
        <Text style={{ color: genderColor, fontWeight: "700" }}>
          {genderShort}
        </Text>
      ) : null}
      {genderShort && transposeLabel ? (
        <Text style={{ color: iconMuted }}> · </Text>
      ) : null}
      {transposeLabel ? (
        <Text style={{ color: iconMuted, fontWeight: "600" }}>
          {transposeLabel}
        </Text>
      ) : null}
    </>
  );

  return (
    <View style={styles.rowTextBlock}>
      <SongRowTitleMarquee title={formatSongListTitleLine(item)} />
      {hasSecondary ? (
        <View style={styles.rowReadinessLine}>
          <View style={styles.rowReadinessLeft}>
            {hasOtherSecondary ? (
              <View style={styles.rowReadinessMain}>
                {showReadinessTag ? (
                  <Ionicons
                    name={rv.icon}
                    size={16}
                    color={rv.color}
                    style={styles.rowReadinessIcon}
                  />
                ) : null}
                <Text
                  style={[styles.rowReadinessLabel, { color: iconMuted }]}
                  numberOfLines={2}
                >
                  {showReadinessTag ? readinessLabel : null}
                  {showReadinessTag && (genderShort || transposeLabel) ? (
                    <Text style={{ color: iconMuted }}> · </Text>
                  ) : null}
                  {genderShort || transposeLabel ? extras : null}
                </Text>
              </View>
            ) : null}
          </View>
          {sungToday ? (
            <View style={styles.rowSungTodayBadge}>
              <Ionicons name="mic" size={16} color="#2e7d32" />
              <Text style={styles.rowSungTodayText}>오늘</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function SwipeableSongRow({
  item,
  idx,
  songCount,
  rowBg,
  borderColor,
  iconMuted,
  onOpenDetail,
  onMoveUp,
  onMoveDown,
  onToggleSungToday,
  registerSwipeRef,
  closeOtherSwipes,
}: {
  item: Song;
  idx: number;
  songCount: number;
  rowBg: string;
  borderColor: string;
  iconMuted: string;
  onOpenDetail: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleSungToday: () => void;
  registerSwipeRef: (id: string, ref: Swipeable | null) => void;
  closeOtherSwipes: (id: string) => void;
}) {
  const swipeRef = useRef<Swipeable | null>(null);
  const sungToday = isSungToday(item.lastSungAt);

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
  ) => (
    <Animated.View
      style={[
        styles.swipeSungAction,
        {
          backgroundColor: sungToday ? "#757575" : "#2e7d32",
          opacity: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.65, 1],
            extrapolate: "clamp",
          }),
        },
      ]}
    >
      {sungToday ? (
        <Ionicons name="close" size={28} color="#fff" />
      ) : (
        <>
          <Ionicons name="mic" size={22} color="#fff" />
          <Text style={styles.swipeSungActionLabel}>오늘 불렀음</Text>
        </>
      )}
    </Animated.View>
  );

  return (
    <Swipeable
      ref={(r) => {
        swipeRef.current = r;
        registerSwipeRef(item.id, r);
      }}
      renderRightActions={renderRightActions}
      onSwipeableWillOpen={() => closeOtherSwipes(item.id)}
      onSwipeableOpen={(direction) => {
        if (direction !== "right") return;
        if (Platform.OS !== "web") {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onToggleSungToday();
        swipeRef.current?.close();
      }}
      friction={2}
      overshootLeft={false}
      overshootRight={false}
      rightThreshold={SWIPE_SUNG_ACTION_WIDTH * 0.45}
      enableTrackpadTwoFingerGesture
    >
      <Pressable
        style={[styles.row, { borderBottomColor: borderColor, backgroundColor: rowBg }]}
        onPress={onOpenDetail}
        accessibilityRole="button"
        accessibilityLabel={`${formatSongListTitleLine(item)} 상세 보기`}
      >
        <View style={styles.rowMain}>
          <View style={styles.reorderColumn}>
            <Pressable
              onPress={onMoveUp}
              disabled={idx <= 0}
              style={({ pressed }) => [
                styles.reorderBtn,
                {
                  opacity: idx <= 0 ? 0.35 : pressed ? 0.6 : 1,
                },
              ]}
              accessibilityLabel="한 칸 위로"
            >
              <Ionicons name="chevron-up" size={18} color={iconMuted} />
            </Pressable>
            <Pressable
              onPress={onMoveDown}
              disabled={idx >= songCount - 1}
              style={({ pressed }) => [
                styles.reorderBtn,
                {
                  opacity:
                    idx >= songCount - 1 ? 0.35 : pressed ? 0.6 : 1,
                },
              ]}
              accessibilityLabel="한 칸 아래로"
            >
              <Ionicons name="chevron-down" size={18} color={iconMuted} />
            </Pressable>
          </View>
          <SongRowDetails item={item} iconMuted={iconMuted} />
        </View>
      </Pressable>
    </Swipeable>
  );
}

/** 수정 모드와 구분해, 새 곡 추가용 모달 상태로 사용 */
const CREATE_MODAL_ID = "__create__";

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const insets = useSafeAreaInsets();

  const screenBg = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const tint = useThemeColor({}, "tint");
  const iconMuted = useThemeColor({}, "icon");
  const listRowSeparator = useThemeColor(
    { light: "#e5e5ea", dark: "#3a3a3c" },
    "icon",
  );

  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalSongId, setModalSongId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftArtist, setDraftArtist] = useState("");
  const [draftTjNumber, setDraftTjNumber] = useState("");
  const [draftKyNumber, setDraftKyNumber] = useState("");
  const [draftMemo, setDraftMemo] = useState("");
  const [draftYoutubeUrl, setDraftYoutubeUrl] = useState("");
  const [draftGender, setDraftGender] = useState<SongGenderKey>("unset");
  const [draftReadiness, setDraftReadiness] = useState<SongReadiness>("none");
  const [draftTranspose, setDraftTranspose] = useState(0);
  const [readinessFilter, setReadinessFilter] =
    useState<ReadinessFilter>("all");
  const [youtubeImportVisible, setYoutubeImportVisible] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const modalScrollMaxHeight = useMemo(
    () => Math.min(Dimensions.get("window").height * 0.52, 480),
    [],
  );

  const persist = useCallback(async (next: Song[]) => {
    try {
      await saveSongs(next);
      setSongs(next);
      logDebug(`[home] 목록 저장 완료 (${next.length}곡)`, "info");
    } catch (e) {
      logDebug(
        `[home] 목록 저장 실패: ${e instanceof Error ? e.message : String(e)}`,
        "error",
      );
      console.error("[persist]", e);
      throw e;
    }
  }, []);

  const handleYoutubeImportAdd = useCallback(
    async (imported: Song[]) => {
      if (imported.length === 0) return;
      try {
        await persist([...imported, ...songs]);
        setYoutubeImportVisible(false);
      } catch {
        logDebug("[home] YouTube 일괄 추가 저장 실패", "warn");
      }
    },
    [persist, songs],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await loadSongs();
      if (!cancelled) {
        setSongs(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** 다른 탭 갔다 오면 디스크 기준으로 다시 맞춤 (상태·화면 불일치 완화) */
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const list = await loadSongs();
        if (!cancelled) setSongs(list);
      })();
      return () => {
        cancelled = true;
        setAddMenuOpen(false);
      };
    }, []),
  );

  const openCreateModal = useCallback(() => {
    setModalSongId(CREATE_MODAL_ID);
    setDraftTitle("");
    setDraftArtist("");
    setDraftTjNumber("");
    setDraftKyNumber("");
    setDraftMemo("");
    setDraftYoutubeUrl("");
    setDraftGender("unset");
    setDraftReadiness("none");
    setDraftTranspose(0);
  }, []);

  const closeModal = useCallback(() => {
    setModalSongId(null);
  }, []);

  const handleSaveModal = useCallback(async () => {
    if (modalSongId !== CREATE_MODAL_ID) return;
    const title = draftTitle.trim();
    if (!title) return;
    const transpose = Math.max(-12, Math.min(12, draftTranspose));
    const artist = draftArtist.trim();
    const tjNumber = sanitizeKaraokeDigits(draftTjNumber);
    const kyNumber = sanitizeKaraokeDigits(draftKyNumber);
    const memo = draftMemo.trim();
    const youtubeUrl = draftYoutubeUrl.trim();
    try {
      const song: Song = {
        id: createSongId(),
        title,
        artist,
        tjNumber,
        kyNumber,
        memo,
        youtubeUrl,
        lastSungAt: "",
        readiness: draftReadiness,
        genderKey: draftGender,
        transposeSemitones: transpose,
      };
      await persist([song, ...songs]);
      closeModal();
    } catch {
      logDebug("[home] 저장 후 모달 유지(저장 실패)", "warn");
    }
  }, [
    closeModal,
    draftArtist,
    draftGender,
    draftReadiness,
    draftKyNumber,
    draftMemo,
    draftYoutubeUrl,
    draftTjNumber,
    draftTitle,
    draftTranspose,
    modalSongId,
    persist,
    songs,
  ]);

  const bumpTranspose = useCallback((delta: number) => {
    setDraftTranspose((v) => Math.max(-12, Math.min(12, v + delta)));
  }, []);

  const handleMoveSongByArrows = useCallback(
    (songId: string, direction: -1 | 1) => {
      const index = songs.findIndex((s) => s.id === songId);
      if (index < 0) return;
      const to = index + direction;
      if (to < 0 || to >= songs.length) return;
      const next = [...songs];
      const [removed] = next.splice(index, 1);
      next.splice(to, 0, removed);
      void persist(next).catch(() => {});
    },
    [persist, songs],
  );

  const swipeRowRefs = useRef<Map<string, Swipeable>>(new Map());

  const registerSwipeRef = useCallback((id: string, ref: Swipeable | null) => {
    if (ref) swipeRowRefs.current.set(id, ref);
    else swipeRowRefs.current.delete(id);
  }, []);

  const closeOtherSwipes = useCallback((openId: string) => {
    swipeRowRefs.current.forEach((ref, id) => {
      if (id !== openId) ref.close();
    });
  }, []);

  const toggleSungToday = useCallback(
    async (songId: string) => {
      const today = localYmd(new Date());
      const next = songs.map((s) => {
        if (s.id !== songId) return s;
        return {
          ...s,
          lastSungAt: s.lastSungAt.trim() === today ? "" : today,
        };
      });
      try {
        await persist(next);
        logDebug(`[home] 오늘 불렀음 토글: ${songId}`, "info");
      } catch {
        logDebug("[home] 오늘 불렀음 저장 실패", "warn");
      }
    },
    [persist, songs],
  );

  const inputSurfaceStyle = useMemo(
    () => ({
      borderColor: iconMuted,
      color: textColor,
      backgroundColor: colorScheme === "dark" ? "#1c1c1e" : "#f2f2f7",
    }),
    [colorScheme, iconMuted, textColor],
  );

  const filteredSongs = useMemo(() => {
    if (readinessFilter === "all") return songs;
    return songs.filter((s) => s.readiness === readinessFilter);
  }, [readinessFilter, songs]);

  const readinessFilterCounts = useMemo(() => {
    const by: Record<SongReadiness, number> = {
      none: 0,
      can_full: 0,
      will_try: 0,
      need_practice: 0,
    };
    for (const s of songs) {
      by[s.readiness] += 1;
    }
    return { all: songs.length, by };
  }, [songs]);

  if (loading) {
    return (
      <ThemedView style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={tint} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.screen, { paddingTop: insets.top }]}>
      <ThemedText type="title" style={styles.headline}>
        메모
      </ThemedText>

      <View style={styles.readinessFilterWrap}>
        {READINESS_FILTER_CHIPS.map((chip) => {
          const selected = readinessFilter === chip.value;
          const isAll = chip.value === "all";
          const chipVisual = isAll
            ? null
            : READINESS_VISUAL[chip.value as SongReadiness];
          const count = isAll
            ? readinessFilterCounts.all
            : readinessFilterCounts.by[chip.value as SongReadiness];
          return (
            <Pressable
              key={chip.value}
              onPress={() => setReadinessFilter(chip.value)}
              style={({ pressed }) => [
                styles.readinessFilterChip,
                {
                  borderColor: selected ? tint : iconMuted,
                  backgroundColor: selected
                    ? `${tint}18`
                    : colorScheme === "dark"
                      ? "#2c2c2e"
                      : "#f5f5f5",
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              {!isAll && chipVisual ? (
                <Ionicons
                  name={chipVisual.icon}
                  size={16}
                  color={chipVisual.color}
                  style={styles.readinessFilterChipIcon}
                />
              ) : null}
              <ThemedText
                style={{
                  fontSize: 13,
                  fontWeight: selected ? "700" : "500",
                  color: selected ? tint : textColor,
                }}
              >
                {chip.label}
              </ThemedText>
              <View
                style={[
                  styles.readinessFilterBadge,
                  {
                    backgroundColor: selected
                      ? `${tint}33`
                      : colorScheme === "dark"
                        ? "#3a3a3c"
                        : "#e5e5ea",
                  },
                ]}
              >
                <ThemedText
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: selected ? tint : textColor,
                  }}
                >
                  {count}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={filteredSongs}
        keyExtractor={(item) => item.id}
        style={styles.listFlex}
        contentContainerStyle={styles.listContent}
        removeClippedSubviews={false}
        ListEmptyComponent={
          <ThemedText
            style={{ color: iconMuted, textAlign: "center", marginTop: 24 }}
          >
            {readinessFilter === "all"
              ? "등록된 곡이 없습니다. 우하단 + 버튼에서 새 곡을 추가해 보세요."
              : "이 준비도에 해당하는 곡이 없습니다. 필터를 바꿔 보세요."}
          </ThemedText>
        }
        renderItem={({ item }) => {
          const idx = songs.findIndex((s) => s.id === item.id);
          return (
            <SwipeableSongRow
              item={item}
              idx={idx}
              songCount={songs.length}
              rowBg={screenBg}
              borderColor={listRowSeparator}
              iconMuted={iconMuted}
              onOpenDetail={() =>
                router.push({ pathname: "/song/[id]", params: { id: item.id } })
              }
              onMoveUp={() => handleMoveSongByArrows(item.id, -1)}
              onMoveDown={() => handleMoveSongByArrows(item.id, 1)}
              onToggleSungToday={() => void toggleSungToday(item.id)}
              registerSwipeRef={registerSwipeRef}
              closeOtherSwipes={closeOtherSwipes}
            />
          );
        }}
      />

      {addMenuOpen ? (
        <Pressable
          style={styles.fabScrim}
          onPress={() => setAddMenuOpen(false)}
          accessibilityLabel="메뉴 닫기"
        />
      ) : null}

      <View
        style={[styles.fabStack, { bottom: Math.max(insets.bottom, 10) + 8 }]}
        pointerEvents="box-none"
      >
        {addMenuOpen ? (
          <View
            style={[
              styles.fabBubble,
              {
                backgroundColor: colorScheme === "dark" ? "#2c2c2e" : "#fff",
                borderColor: iconMuted,
              },
            ]}
            accessibilityRole="menu"
          >
            <Pressable
              onPress={() => {
                setAddMenuOpen(false);
                openCreateModal();
              }}
              style={({ pressed }) => [
                styles.fabBubbleRow,
                { opacity: pressed ? 0.75 : 1 },
              ]}
              accessibilityRole="menuitem"
              accessibilityLabel="직접 추가"
            >
              <Ionicons name="create-outline" size={22} color={tint} />
              <ThemedText type="defaultSemiBold" style={{ color: textColor }}>
                직접 추가
              </ThemedText>
            </Pressable>
            <View
              style={[styles.fabBubbleDivider, { backgroundColor: iconMuted }]}
            />
            <Pressable
              onPress={() => {
                setAddMenuOpen(false);
                setYoutubeImportVisible(true);
              }}
              style={({ pressed }) => [
                styles.fabBubbleRow,
                { opacity: pressed ? 0.75 : 1 },
              ]}
              accessibilityRole="menuitem"
              accessibilityLabel="YouTube에서 추가"
            >
              <Ionicons name="logo-youtube" size={22} color="#FF0000" />
              <ThemedText type="defaultSemiBold" style={{ color: textColor }}>
                YouTube에서 추가
              </ThemedText>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          onPress={() => setAddMenuOpen((o) => !o)}
          style={({ pressed }) => [
            styles.fabMain,
            { backgroundColor: tint, opacity: pressed ? 0.88 : 1 },
          ]}
          accessibilityLabel="곡 추가 메뉴 열기"
          accessibilityState={{ expanded: addMenuOpen }}
        >
          <Ionicons name="add" size={34} color="#fff" />
        </Pressable>
      </View>

      <Modal
        visible={modalSongId === CREATE_MODAL_ID}
        animationType="fade"
        transparent
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={closeModal} />
          <View style={[styles.modalCard, { backgroundColor: screenBg }]}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              새 곡 추가
            </ThemedText>

            <ScrollView
              style={{ maxHeight: modalScrollMaxHeight }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              <ThemedText style={styles.fieldLabel}>노래 제목</ThemedText>
              <TextInput
                value={draftTitle}
                onChangeText={setDraftTitle}
                placeholder="제목"
                placeholderTextColor={iconMuted}
                style={[styles.modalInput, inputSurfaceStyle]}
                autoFocus
              />

              <ThemedText style={styles.fieldLabel}>가수</ThemedText>
              <TextInput
                value={draftArtist}
                onChangeText={setDraftArtist}
                placeholder="가수명"
                placeholderTextColor={iconMuted}
                style={[styles.modalInput, inputSurfaceStyle]}
              />

              <ThemedText style={styles.fieldLabel}>곡 번호</ThemedText>
              <View style={styles.modalNumberRow}>
                <View style={styles.modalNumberCol}>
                  <ThemedText style={styles.modalNumberBrand}>태진</ThemedText>
                  <TextInput
                    value={draftTjNumber}
                    onChangeText={(text) =>
                      setDraftTjNumber(sanitizeKaraokeDigits(text))
                    }
                    placeholder="번호"
                    placeholderTextColor={iconMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                    style={[
                      styles.modalInput,
                      inputSurfaceStyle,
                      styles.modalNumberInput,
                    ]}
                  />
                </View>
                <View style={styles.modalNumberCol}>
                  <ThemedText style={styles.modalNumberBrand}>금영</ThemedText>
                  <TextInput
                    value={draftKyNumber}
                    onChangeText={(text) =>
                      setDraftKyNumber(sanitizeKaraokeDigits(text))
                    }
                    placeholder="번호"
                    placeholderTextColor={iconMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                    style={[
                      styles.modalInput,
                      inputSurfaceStyle,
                      styles.modalNumberInput,
                    ]}
                  />
                </View>
              </View>

              <ThemedText style={styles.fieldLabel}>남/여 키</ThemedText>
              <View style={styles.segmentRow}>
                {GENDER_OPTIONS.map((opt) => {
                  const selected = draftGender === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setDraftGender(opt.value)}
                      style={[
                        styles.segment,
                        {
                          borderColor: selected ? tint : iconMuted,
                          backgroundColor: selected
                            ? `${tint}22`
                            : "transparent",
                        },
                      ]}
                    >
                      <ThemedText
                        style={{
                          fontWeight: selected ? "700" : "500",
                          color: selected ? tint : textColor,
                        }}
                      >
                        {opt.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <ThemedText style={styles.fieldLabel}>준비도</ThemedText>
              <View style={styles.segmentRow}>
                {SONG_READINESS_OPTIONS.map((opt) => {
                  const selected = draftReadiness === opt.value;
                  const rv = READINESS_VISUAL[opt.value];
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setDraftReadiness(opt.value)}
                      style={[
                        styles.segment,
                        styles.modalReadinessSegment,
                        {
                          borderColor: selected ? tint : iconMuted,
                          backgroundColor: selected
                            ? `${tint}22`
                            : "transparent",
                        },
                      ]}
                    >
                      <Ionicons name={rv.icon} size={20} color={rv.color} />
                      <ThemedText
                        style={{
                          marginTop: 6,
                          fontWeight: selected ? "700" : "500",
                          color: selected ? tint : textColor,
                          fontSize: 11,
                          textAlign: "center",
                        }}
                        numberOfLines={2}
                      >
                        {opt.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <ThemedText style={styles.fieldLabel}>
                음정 (키 업/다운)
              </ThemedText>
              <View style={styles.transposeRow}>
                <Pressable
                  onPress={() => bumpTranspose(-1)}
                  style={[styles.stepBtn, { borderColor: iconMuted }]}
                >
                  <ThemedText type="defaultSemiBold">−</ThemedText>
                </Pressable>
                <View style={styles.transposeValue}>
                  <ThemedText
                    type="defaultSemiBold"
                    style={{ textAlign: "center" }}
                  >
                    {formatTranspose(draftTranspose)}
                  </ThemedText>
                  <ThemedText
                    style={{
                      color: iconMuted,
                      fontSize: 12,
                      textAlign: "center",
                    }}
                  >
                    반음 ±12까지
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => bumpTranspose(1)}
                  style={[styles.stepBtn, { borderColor: iconMuted }]}
                >
                  <ThemedText type="defaultSemiBold">+</ThemedText>
                </Pressable>
              </View>

              <ThemedText style={styles.fieldLabel}>메모</ThemedText>
              <TextInput
                value={draftMemo}
                onChangeText={setDraftMemo}
                placeholder="간단히 적어두기"
                placeholderTextColor={iconMuted}
                multiline
                textAlignVertical="top"
                style={[
                  styles.modalInput,
                  styles.modalMemoInput,
                  inputSurfaceStyle,
                ]}
              />

              <ThemedText style={styles.fieldLabel}>YouTube 링크</ThemedText>
              <TextInput
                value={draftYoutubeUrl}
                onChangeText={setDraftYoutubeUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={[styles.modalInput, inputSurfaceStyle]}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={closeModal}
                style={({ pressed }) => [
                  styles.textBtn,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <ThemedText style={{ color: iconMuted }}>취소</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleSaveModal}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: tint, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <ThemedText style={styles.primaryBtnLabel}>저장</ThemedText>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <YoutubeImportModal
        visible={youtubeImportVisible}
        onClose={() => setYoutubeImportVisible(false)}
        onAdd={handleYoutubeImportAdd}
        tint={tint}
        iconMuted={iconMuted}
        textColor={textColor}
        screenBg={screenBg}
        colorScheme={colorScheme}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headline: {
    marginTop: 8,
    marginBottom: 16,
  },
  listFlex: {
    flex: 1,
  },
  fabScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.22)",
    zIndex: 40,
  },
  fabStack: {
    position: "absolute",
    right: 20,
    zIndex: 50,
    alignItems: "flex-end",
    gap: 12,
  },
  fabBubble: {
    minWidth: 208,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  fabBubbleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  fabBubbleDivider: {
    height: StyleSheet.hairlineWidth,
    opacity: 0.35,
  },
  fabMain: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 8,
  },
  readinessFilterWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  readinessFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  readinessFilterChipIcon: {
    marginRight: 6,
  },
  readinessFilterBadge: {
    marginLeft: 6,
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingBottom: 96,
    flexGrow: 1,
  },
  row: {
    flexDirection: "column",
    paddingVertical: 5,
    paddingHorizontal: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowMain: {
    flexDirection: "row",
    alignItems: "center",
  },
  swipeSungAction: {
    width: SWIPE_SUNG_ACTION_WIDTH,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 8,
    marginBottom: StyleSheet.hairlineWidth,
  },
  swipeSungActionLabel: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
  },
  rowTitleMarqueeWrap: {
    position: "relative",
    overflow: "hidden",
    minHeight: 19,
    minWidth: 0,
    justifyContent: "center",
  },
  /** 넓은 고정 폭 + 비음수 zIndex: Android에서 측정 레이아웃·onTextLayout이 안정적으로 돌게 함 */
  rowTitleMeasureHost: {
    position: "absolute",
    opacity: 0.02,
    left: 0,
    top: 0,
    width: 8000,
    height: ROW_TITLE_FONT.lineHeight,
    zIndex: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  rowTitleMeasureScroll: {
    flexGrow: 0,
    maxHeight: ROW_TITLE_FONT.lineHeight,
  },
  rowTitleMeasureScrollInner: {
    alignItems: "center",
    paddingRight: 4,
  },
  rowTitleMarqueeText: {
    flexShrink: 0,
  },
  rowTitleMarqueeTrack: {
    alignSelf: "flex-start",
  },
  rowReadinessLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
    minWidth: 0,
    gap: 8,
  },
  rowReadinessLeft: {
    flex: 1,
    minWidth: 0,
  },
  rowReadinessMain: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
    minWidth: 0,
  },
  rowSungTodayBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
    marginLeft: 4,
  },
  rowSungTodayText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2e7d32",
  },
  rowReadinessIcon: {
    flexShrink: 0,
  },
  rowReadinessLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 16,
  },
  reorderColumn: {
    marginRight: 6,
    justifyContent: "center",
    paddingTop: 0,
  },
  reorderBtn: {
    paddingVertical: 1,
    paddingHorizontal: 2,
  },
  rowTextBlock: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalCard: {
    borderRadius: 16,
    padding: 20,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
    maxHeight: "92%",
  },
  modalTitle: {
    marginBottom: 16,
  },
  fieldLabel: {
    marginBottom: 6,
    fontSize: 14,
    fontWeight: "600",
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 14,
  },
  modalNumberRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  modalNumberCol: {
    flex: 1,
  },
  modalNumberBrand: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  modalNumberInput: {
    marginBottom: 0,
  },
  modalMemoInput: {
    minHeight: 88,
    paddingTop: 12,
  },
  segmentRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  segment: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalReadinessSegment: {
    justifyContent: "center",
    minHeight: 76,
    paddingVertical: 8,
  },
  transposeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  transposeValue: {
    flex: 1,
  },
  modalActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    paddingTop: 4,
  },
  textBtn: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  primaryBtn: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  primaryBtnLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});
