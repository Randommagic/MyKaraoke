import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
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
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from "react-native-draggable-flatlist";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  useConfirm,
  type ConfirmFn,
} from "@/components/design/confirm-dialog-context";
import { DesignColors } from "@/components/design/colors";
import { ScreenTitle } from "@/components/design/ScreenTitle";
import {
  SwipeActionPanel,
  SWIPE_ACTION_WIDTH,
} from "@/components/design/SwipeActionPanel";
import { SongCard } from "@/components/design/SongCard";
import { mapStorageSongToCardModel } from "@/components/design/map-song";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { YoutubeImportModal } from "@/components/youtube-import-modal";
import { normalizeYoutubeUrlForStorage } from "@/lib/youtube-import";
import { logDebug } from "@/lib/debug-log-buffer";
import {
  formatTranspose,
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
  toggleSungTodayInDates,
  SONG_READINESS_OPTIONS,
  type Song,
  type SongGenderKey,
  type SongReadiness,
} from "@/lib/songs-storage";

type ReadinessFilter = "all" | SongReadiness;

/** 홈 필터 칩 순서 (전체 다음): 완창 → 연습 → 시도 → 미정 */
const READINESS_FILTER_CHIP_ORDER: SongReadiness[] = [
  "can_full",
  "need_practice",
  "will_try",
  "none",
];

const READINESS_FILTER_CHIPS: { value: ReadinessFilter; label: string }[] = [
  { value: "all", label: "전체" },
  ...READINESS_FILTER_CHIP_ORDER.map((value) => {
    const opt = SONG_READINESS_OPTIONS.find((o) => o.value === value)!;
    return { value, label: opt.label };
  }),
];

const FILTER_SCROLL_EDGE_THRESHOLD = 8;
const FILTER_FADE_WIDTH = 36;

function ReadinessFilterScroller({
  readinessFilter,
  onSelectFilter,
  counts,
}: {
  readinessFilter: ReadinessFilter;
  onSelectFilter: (value: ReadinessFilter) => void;
  counts: { all: number; by: Record<SongReadiness, number> };
}) {
  const [scrollX, setScrollX] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  const canScroll = contentWidth > viewportWidth + FILTER_SCROLL_EDGE_THRESHOLD;
  const showLeftFade = canScroll && scrollX > FILTER_SCROLL_EDGE_THRESHOLD;
  const showRightFade =
    canScroll &&
    scrollX + viewportWidth < contentWidth - FILTER_SCROLL_EDGE_THRESHOLD;

  return (
    <View style={styles.readinessFilterScroller}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => setScrollX(e.nativeEvent.contentOffset.x)}
        onLayout={(e) => setViewportWidth(e.nativeEvent.layout.width)}
        onContentSizeChange={(w) => setContentWidth(w)}
        style={styles.readinessFilterScroll}
        contentContainerStyle={styles.readinessFilterScrollContent}
      >
        {READINESS_FILTER_CHIPS.map((chip) => {
          const selected = readinessFilter === chip.value;
          const isAll = chip.value === "all";
          const count = isAll
            ? counts.all
            : counts.by[chip.value as SongReadiness];
          return (
            <Pressable
              key={chip.value}
              onPress={() => onSelectFilter(chip.value)}
              style={({ pressed }) => [
                styles.readinessFilterTab,
                selected && styles.readinessFilterTabActive,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text
                style={[
                  styles.readinessFilterTabLabel,
                  selected && styles.readinessFilterTabLabelActive,
                ]}
              >
                {chip.label}
              </Text>
              <View
                style={[
                  styles.readinessFilterCountBadge,
                  selected && styles.readinessFilterCountBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.readinessFilterCountText,
                    selected && styles.readinessFilterCountTextActive,
                  ]}
                >
                  {count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      {showLeftFade ? (
        <>
          <LinearGradient
            colors={[DesignColors.bg, "transparent"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.readinessFilterFade, styles.readinessFilterFadeLeft]}
            pointerEvents="none"
          />
          <Text
            style={[
              styles.readinessFilterChevron,
              styles.readinessFilterChevronLeft,
              { color: DesignColors.textMuted },
            ]}
            pointerEvents="none"
          >
            ‹
          </Text>
        </>
      ) : null}
      {showRightFade ? (
        <>
          <LinearGradient
            colors={["transparent", DesignColors.bg]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[
              styles.readinessFilterFade,
              styles.readinessFilterFadeRight,
            ]}
            pointerEvents="none"
          />
          <Text
            style={[
              styles.readinessFilterChevron,
              styles.readinessFilterChevronRight,
              { color: DesignColors.textMuted },
            ]}
            pointerEvents="none"
          >
            ›
          </Text>
        </>
      ) : null}
    </View>
  );
}

function SwipeableSongRow({
  item,
  iconMuted,
  onOpenDetail,
  onToggleSungToday,
  onRequestDelete,
  confirm,
  registerSwipeRef,
  closeOtherSwipes,
  drag,
  isActive,
  swipeEnabled,
  dragReorderEnabled,
  onDisabledDragAttempt,
}: {
  item: Song;
  iconMuted: string;
  onOpenDetail: () => void;
  onToggleSungToday: () => void;
  onRequestDelete: () => void;
  confirm: ConfirmFn;
  registerSwipeRef: (id: string, ref: Swipeable | null) => void;
  closeOtherSwipes: (id: string) => void;
  drag: () => void;
  isActive: boolean;
  swipeEnabled: boolean;
  dragReorderEnabled: boolean;
  onDisabledDragAttempt: () => void;
}) {
  const swipeRef = useRef<Swipeable | null>(null);
  const sungToday = isSungToday(item.sungDates);

  const renderLeftActions = (
    progress: Animated.AnimatedInterpolation<number>,
  ) => (
    <SwipeActionPanel
      backgroundColor={DesignColors.swipeDeleteBg}
      progress={progress}
      cardEdge="right"
    >
      <Ionicons
        name="trash-outline"
        size={20}
        color={DesignColors.swipeDeleteText}
      />
      <Text style={styles.swipeDeleteActionLabel}>삭제</Text>
    </SwipeActionPanel>
  );

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
  ) => (
    <SwipeActionPanel
      backgroundColor={
        sungToday ? DesignColors.swipeSungCancelBg : DesignColors.swipeSungBg
      }
      progress={progress}
      cardEdge="left"
      contentStyle={styles.swipeSungActionPanel}
    >
      {sungToday ? (
        <>
          <Ionicons
            name="arrow-undo"
            size={20}
            color={DesignColors.swipeSungCancelText}
          />
          <Text style={styles.swipeSungCancelActionLabel}>오늘 취소</Text>
        </>
      ) : (
        <>
          <Ionicons name="mic" size={20} color={DesignColors.swipeSungText} />
          <Text style={styles.swipeSungActionLabel}>오늘 불렀음</Text>
        </>
      )}
    </SwipeActionPanel>
  );

  return (
    <ScaleDecorator activeScale={1.02}>
      <View
        style={[styles.songCardRow, isActive ? { opacity: 0.92 } : null]}
      >
        <Pressable
          onLongPress={() => {
            if (dragReorderEnabled) {
              drag();
            } else {
              onDisabledDragAttempt();
            }
          }}
          delayLongPress={220}
          disabled={isActive}
          hitSlop={8}
          style={({ pressed }) => [
            styles.dragHandle,
            {
              opacity: dragReorderEnabled ? (pressed ? 0.65 : 1) : 0.3,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            dragReorderEnabled
              ? "길게 눌러 순서 변경"
              : "전체 보기에서만 순서 변경 가능"
          }
        >
          <Ionicons name="reorder-three" size={22} color={iconMuted} />
        </Pressable>
        <View style={styles.songCardWrap}>
          <Swipeable
            ref={(r) => {
              swipeRef.current = r;
              registerSwipeRef(item.id, r);
            }}
            enabled={swipeEnabled && !isActive}
            renderLeftActions={renderLeftActions}
            renderRightActions={renderRightActions}
            onSwipeableWillOpen={() => closeOtherSwipes(item.id)}
            onSwipeableOpen={(direction) => {
              swipeRef.current?.close();
          if (direction === "left") {
            confirm({
              title: "삭제하시겠습니까?",
              confirmLabel: "삭제",
              destructive: true,
              onConfirm: onRequestDelete,
            });
            return;
          }
              if (direction !== "right") return;
              if (Platform.OS !== "web") {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              onToggleSungToday();
            }}
            friction={2}
            overshootLeft={false}
            overshootRight={false}
            leftThreshold={SWIPE_ACTION_WIDTH * 0.45}
            rightThreshold={SWIPE_ACTION_WIDTH * 0.45}
            enableTrackpadTwoFingerGesture
            containerStyle={styles.swipeCardContainer}
          >
            <SongCard
              model={mapStorageSongToCardModel(item)}
              onPress={onOpenDetail}
            />
          </Swipeable>
        </View>
      </View>
    </ScaleDecorator>
  );
}

/** 수정 모드와 구분해, 새 곡 추가용 모달 상태로 사용 */
const CREATE_MODAL_ID = "__create__";

export default function HomeScreen() {
  const confirm = useConfirm();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [youtubeImportVisible, setYoutubeImportVisible] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const toastOpacity = useRef(new Animated.Value(0)).current;

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
    const youtubeUrl = normalizeYoutubeUrlForStorage(draftYoutubeUrl);
    try {
      const song: Song = {
        id: createSongId(),
        title,
        artist,
        tjNumber,
        kyNumber,
        memo,
        youtubeUrl,
        sungDates: [],
        readiness: draftReadiness,
        genderKey: draftGender,
        transposeSemitones: transpose,
        importSource: "manual",
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

  const showToast = useCallback(
    (message: string) => {
      setToastMessage(message);
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
    },
    [toastOpacity],
  );

  const showReorderDisabledToast = useCallback(() => {
    showToast("순서 변경은 전체 보기에서만 가능해요");
  }, [showToast]);

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
          sungDates: toggleSungTodayInDates(s.sungDates, today),
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

  const handleDeleteSong = useCallback(
    async (songId: string) => {
      const next = songs.filter((s) => s.id !== songId);
      try {
        await persist(next);
        logDebug(`[home] 곡 삭제: ${songId}`, "info");
      } catch {
        logDebug("[home] 곡 삭제 저장 실패", "warn");
      }
    },
    [persist, songs],
  );

  const handleDragEnd = useCallback(
    async (data: Song[]) => {
      try {
        await persist(data);
        logDebug(`[home] 드래그 정렬 저장 (${data.length}곡)`, "info");
      } catch {
        logDebug("[home] 드래그 정렬 저장 실패", "warn");
      }
    },
    [persist],
  );

  const inputSurfaceStyle = useMemo(
    () => ({
      borderColor: DesignColors.bgBorder,
      color: DesignColors.textPrimary,
      backgroundColor: DesignColors.inputSurface,
    }),
    [],
  );

  const filteredSongs = useMemo(() => {
    let result = songs;
    if (readinessFilter !== "all") {
      result = result.filter((s) => s.readiness === readinessFilter);
    }
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.artist.toLowerCase().includes(q)
      );
    }
    return result;
  }, [readinessFilter, songs, searchQuery]);

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
        <ActivityIndicator size="large" color={DesignColors.accent} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.filterHeader}>
        <View style={styles.titleRow}>
          <ScreenTitle style={styles.homeTitle}>내 노래 목록</ScreenTitle>
          <View style={styles.searchContainer}>
            {isSearchExpanded ? (
              <View style={styles.searchInputWrapper}>
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="제목, 가수 검색"
                  placeholderTextColor={DesignColors.textMuted}
                  style={styles.searchInput}
                  returnKeyType="search"
                  autoFocus
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery("")} style={styles.searchClearBtn} accessibilityLabel="검색어 지우기">
                    <Ionicons name="close-circle" size={16} color={DesignColors.textMuted} />
                  </Pressable>
                )}
                <Pressable onPress={() => { setIsSearchExpanded(false); setSearchQuery(""); }} style={styles.searchCloseBtn} accessibilityLabel="검색 닫기">
                  <Ionicons name="close" size={20} color={DesignColors.textPrimary} />
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setIsSearchExpanded(true)} style={styles.searchIconBtn} accessibilityLabel="검색 열기">
                <Ionicons name="search" size={24} color={DesignColors.textPrimary} />
              </Pressable>
            )}
          </View>
        </View>
        <ReadinessFilterScroller
          readinessFilter={readinessFilter}
          onSelectFilter={setReadinessFilter}
          counts={readinessFilterCounts}
        />
      </View>

      <DraggableFlatList
        data={readinessFilter === "all" && searchQuery.length === 0 ? songs : filteredSongs}
        keyExtractor={(item) => item.id}
        containerStyle={styles.listFlex}
        style={styles.listFlex}
        contentContainerStyle={styles.listContent}
        activationDistance={12}
        removeClippedSubviews={false}
        ListEmptyComponent={
          <ThemedText
            style={styles.emptyListHint}
          >
            {readinessFilter === "all" && searchQuery.length === 0
              ? "등록된 곡이 없습니다. 우하단 + 버튼에서 새 곡을 추가해 보세요."
              : "조건에 맞는 곡이 없습니다."}
          </ThemedText>
        }
        onDragEnd={({ data }) =>
          (readinessFilter === "all" && searchQuery.length === 0) ? void handleDragEnd(data) : undefined
        }
        renderItem={({ item, drag, isActive }: RenderItemParams<Song>) => (
          <SwipeableSongRow
            item={item}
            iconMuted={DesignColors.textSecondary}
            confirm={confirm}
            onOpenDetail={() =>
              router.push({ pathname: "/song/[id]", params: { id: item.id } })
            }
            onToggleSungToday={() => void toggleSungToday(item.id)}
            onRequestDelete={() => void handleDeleteSong(item.id)}
            registerSwipeRef={registerSwipeRef}
            closeOtherSwipes={closeOtherSwipes}
            drag={drag}
            isActive={isActive}
            swipeEnabled
            dragReorderEnabled={readinessFilter === "all" && searchQuery.length === 0}
            onDisabledDragAttempt={showReorderDisabledToast}
          />
        )}
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
          <View style={styles.fabBubble} accessibilityRole="menu">
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
              <Ionicons name="create-outline" size={22} color={DesignColors.accent} />
              <ThemedText type="defaultSemiBold">직접 추가</ThemedText>
            </Pressable>
            <View style={styles.fabBubbleDivider} />
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
              <ThemedText type="defaultSemiBold">YouTube에서 추가</ThemedText>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          onPress={() => setAddMenuOpen((o) => !o)}
          style={({ pressed }) => [
            styles.fabMain,
            {
              backgroundColor: DesignColors.accent,
              opacity: pressed ? 0.88 : 1,
            },
          ]}
          accessibilityLabel="곡 추가 메뉴 열기"
          accessibilityState={{ expanded: addMenuOpen }}
        >
          <Ionicons name="add" size={34} color={DesignColors.textOnAccent} />
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
          <View style={styles.modalCard}>
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
                placeholderTextColor={DesignColors.textMuted}
                style={[styles.modalInput, inputSurfaceStyle]}
                autoFocus
              />

              <ThemedText style={styles.fieldLabel}>가수</ThemedText>
              <TextInput
                value={draftArtist}
                onChangeText={setDraftArtist}
                placeholder="가수명"
                placeholderTextColor={DesignColors.textMuted}
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
                    placeholderTextColor={DesignColors.textMuted}
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
                    placeholderTextColor={DesignColors.textMuted}
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
                        selected ? styles.segmentSelected : null,
                      ]}
                    >
                      <ThemedText
                        style={
                          selected
                            ? styles.segmentLabelSelected
                            : styles.segmentLabel
                        }
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
                        selected ? styles.segmentSelected : null,
                      ]}
                    >
                      <Ionicons name={rv.icon} size={20} color={rv.color} />
                      <ThemedText
                        style={[
                          styles.segmentReadinessLabel,
                          selected
                            ? styles.segmentLabelSelected
                            : styles.segmentLabel,
                        ]}
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
                  style={styles.stepBtn}
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
                  <ThemedText style={styles.transposeHint}>
                    반음 ±12까지
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => bumpTranspose(1)}
                  style={styles.stepBtn}
                >
                  <ThemedText type="defaultSemiBold">+</ThemedText>
                </Pressable>
              </View>

              <ThemedText style={styles.fieldLabel}>메모</ThemedText>
              <TextInput
                value={draftMemo}
                onChangeText={setDraftMemo}
                placeholder="간단히 적어두기"
                placeholderTextColor={DesignColors.textMuted}
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
                <ThemedText style={styles.modalCancelLabel}>취소</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleSaveModal}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { opacity: pressed ? 0.85 : 1 },
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
        existingSongs={songs}
      />

      {toastVisible ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            {
              opacity: toastOpacity,
              bottom: Math.max(insets.bottom, 12) + 56,
              backgroundColor: DesignColors.toastBg,
            },
          ]}
        >
          <ThemedText style={styles.toastText}>{toastMessage}</ThemedText>
        </Animated.View>
      ) : null}
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
  filterHeader: {
    borderBottomWidth: 1,
    borderBottomColor: DesignColors.bgBorder,
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingTop: 12,
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  homeTitle: {
    marginBottom: 0,
  },
  searchContainer: {
    flex: 1,
    alignItems: "flex-end",
    marginLeft: 12,
  },
  searchIconBtn: {
    padding: 4,
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
    width: "100%",
    backgroundColor: DesignColors.inputSurface,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
    color: DesignColors.textPrimary,
  },
  emptyListHint: {
    color: DesignColors.textMuted,
    textAlign: "center",
    marginTop: 24,
  },
  searchClearBtn: {
    padding: 4,
  },
  searchCloseBtn: {
    padding: 4,
    marginLeft: 4,
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
    borderColor: DesignColors.bgBorder,
    backgroundColor: DesignColors.bgCard,
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
    backgroundColor: DesignColors.bgBorder,
    opacity: 0.85,
  },
  fabMain: {
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
  readinessFilterScroller: {
    position: "relative",
    marginBottom: 0,
  },
  readinessFilterScroll: {
    flexGrow: 0,
  },
  readinessFilterScrollContent: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingRight: 4,
  },
  readinessFilterFade: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: FILTER_FADE_WIDTH,
    zIndex: 1,
  },
  readinessFilterFadeLeft: {
    left: 0,
  },
  readinessFilterFadeRight: {
    right: 0,
  },
  readinessFilterChevron: {
    position: "absolute",
    top: "50%",
    marginTop: -11,
    fontSize: 22,
    lineHeight: 22,
    fontWeight: "600",
    zIndex: 2,
  },
  readinessFilterChevronLeft: {
    left: 6,
  },
  readinessFilterChevronRight: {
    right: 6,
  },
  readinessFilterTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "transparent",
    backgroundColor: "transparent",
    marginRight: 6,
  },
  readinessFilterTabActive: {
    backgroundColor: DesignColors.bgCard,
    borderColor: DesignColors.bgBorder,
  },
  readinessFilterTabLabel: {
    fontSize: 13,
    color: DesignColors.textSecondary,
  },
  readinessFilterTabLabelActive: {
    color: DesignColors.textPrimary,
    fontWeight: "500",
  },
  readinessFilterCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: DesignColors.bgBorder,
  },
  readinessFilterCountBadgeActive: {
    backgroundColor: DesignColors.accent,
  },
  readinessFilterCountText: {
    fontSize: 10,
    fontWeight: "500",
    color: DesignColors.textMuted,
  },
  readinessFilterCountTextActive: {
    color: DesignColors.textOnAccent,
  },
  listContent: {
    paddingTop: 12,
    paddingBottom: 100,
    flexGrow: 1,
  },
  swipeCardContainer: {
    flex: 1,
    width: "100%",
  },
  songCardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    width: "100%",
    marginBottom: 7,
  },
  dragHandle: {
    justifyContent: "center",
    alignItems: "center",
    paddingRight: 6,
    paddingLeft: 2,
    paddingTop: 14,
  },
  songCardWrap: {
    flex: 1,
    minWidth: 0,
  },
  swipeDeleteActionLabel: {
    color: DesignColors.swipeDeleteText,
    fontSize: 13,
    fontWeight: "600",
  },
  swipeSungActionPanel: {
    flexDirection: "column",
    gap: 2,
    paddingHorizontal: 4,
    paddingLeft: 4,
    paddingRight: 10,
  },
  swipeSungActionLabel: {
    color: DesignColors.swipeSungText,
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },
  swipeSungCancelActionLabel: {
    color: DesignColors.swipeSungCancelText,
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },
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
    zIndex: 60,
  },
  toastText: {
    color: DesignColors.toastText,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: DesignColors.scrim,
  },
  modalCard: {
    borderRadius: 16,
    padding: 20,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
    maxHeight: "92%",
    backgroundColor: DesignColors.bgCard,
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
    borderColor: DesignColors.bgBorder,
  },
  segmentSelected: {
    borderColor: DesignColors.accent,
    backgroundColor: `${DesignColors.accent}22`,
  },
  segmentLabel: {
    fontWeight: "500",
    color: DesignColors.textPrimary,
  },
  segmentLabelSelected: {
    fontWeight: "700",
    color: DesignColors.accent,
  },
  segmentReadinessLabel: {
    marginTop: 6,
    fontSize: 11,
    textAlign: "center",
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
    borderColor: DesignColors.bgBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  transposeValue: {
    flex: 1,
  },
  transposeHint: {
    color: DesignColors.textMuted,
    fontSize: 12,
    textAlign: "center",
  },
  modalCancelLabel: {
    color: DesignColors.textMuted,
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
    backgroundColor: DesignColors.accent,
  },
  primaryBtnLabel: {
    color: DesignColors.textOnAccent,
    fontWeight: "700",
    fontSize: 16,
  },
});
