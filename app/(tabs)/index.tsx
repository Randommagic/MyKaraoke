import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DraggableFlatList, {
  type RenderItemParams,
} from "react-native-draggable-flatlist";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/design/Button";
import { DesignColors } from "@/components/design/colors";
import { EdgeFadeScroller } from "@/components/design/EdgeFadeScroller";
import { useConfirm } from "@/components/design/confirm-dialog-context";
import { KeyboardAwareScrollView } from "@/components/design/keyboard-aware-scroll";
import { ScreenTitle } from "@/components/design/ScreenTitle";
import { Toast, useToast } from "@/components/design/Toast";
import { AddFab } from "@/components/home/AddFab";
import { SwipeableSongRow } from "@/components/home/SwipeableSongRow";
import {
  MemoField,
  SongBasicFields,
  TransposeStepper,
} from "@/components/song/SongForm";
import {
  FieldLabel,
  GenderKeyRow,
  ReadinessChipRow,
} from "@/components/song/song-screen-ui";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { YoutubeImportModal } from "@/components/youtube-import-modal";
import { usePendingYoutubeShareUrl } from "@/components/youtube-share-intent-provider";
import { logDebug } from "@/lib/debug-log-buffer";
import { UI_STRINGS } from "@/lib/ui-strings";
import { localYmd, sanitizeKaraokeDigits } from "@/lib/song-form-helpers";
import {
  clampSongMemo,
  createSongId,
  loadSongs,
  saveSongs,
  SONG_READINESS_OPTIONS,
  toggleSungTodayInDates,
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
  { value: "all", label: UI_STRINGS.filter.all },
  ...READINESS_FILTER_CHIP_ORDER.map((value) => {
    const opt = SONG_READINESS_OPTIONS.find((o) => o.value === value)!;
    return { value, label: opt.label };
  }),
];

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
  return (
    <EdgeFadeScroller
      fadeWidth={FILTER_FADE_WIDTH}
      showChevron
      style={styles.readinessFilterScroller}
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
    </EdgeFadeScroller>
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
  const [draftGender, setDraftGender] = useState<SongGenderKey>("unset");
  const [draftReadiness, setDraftReadiness] = useState<SongReadiness>("none");
  const [draftTranspose, setDraftTranspose] = useState(0);
  const [readinessFilter, setReadinessFilter] =
    useState<ReadinessFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [youtubeImportVisible, setYoutubeImportVisible] = useState(false);
  const [youtubeImportInitialUrl, setYoutubeImportInitialUrl] = useState<
    string | undefined
  >();
  const { pendingUrl: pendingYoutubeShareUrl, consumePendingUrl } =
    usePendingYoutubeShareUrl();
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const toast = useToast();

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
        setYoutubeImportInitialUrl(undefined);
      } catch {
        logDebug("[home] YouTube 일괄 추가 저장 실패", "warn");
      }
    },
    [persist, songs],
  );

  const closeYoutubeImportModal = useCallback(() => {
    setYoutubeImportVisible(false);
    setYoutubeImportInitialUrl(undefined);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!pendingYoutubeShareUrl) return;
      setYoutubeImportInitialUrl(pendingYoutubeShareUrl);
      setYoutubeImportVisible(true);
      consumePendingUrl();
    }, [consumePendingUrl, pendingYoutubeShareUrl]),
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
    const memo = clampSongMemo(draftMemo.trim());
    try {
      const song: Song = {
        id: createSongId(),
        title,
        artist,
        tjNumber,
        kyNumber,
        memo,
        youtubeUrl: "",
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
    draftTjNumber,
    draftTitle,
    draftTranspose,
    modalSongId,
    persist,
    songs,
  ]);

  const showReorderDisabledToast = useCallback(() => {
    toast.show("순서 변경은 전체 보기에서만 가능해요");
  }, [toast]);

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
          s.artist.toLowerCase().includes(q),
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
                  <Pressable
                    onPress={() => setSearchQuery("")}
                    style={styles.searchClearBtn}
                    accessibilityLabel="검색어 지우기"
                  >
                    <Ionicons
                      name="close-circle"
                      size={16}
                      color={DesignColors.textMuted}
                    />
                  </Pressable>
                )}
                <Pressable
                  onPress={() => {
                    setIsSearchExpanded(false);
                    setSearchQuery("");
                  }}
                  style={styles.searchCloseBtn}
                  accessibilityLabel="검색 닫기"
                >
                  <Ionicons
                    name="close"
                    size={20}
                    color={DesignColors.textPrimary}
                  />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => setIsSearchExpanded(true)}
                style={styles.searchIconBtn}
                accessibilityLabel="검색 열기"
              >
                <Ionicons
                  name="search"
                  size={24}
                  color={DesignColors.textPrimary}
                />
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
        data={
          readinessFilter === "all" && searchQuery.length === 0
            ? songs
            : filteredSongs
        }
        keyExtractor={(item) => item.id}
        containerStyle={styles.listFlex}
        style={styles.listFlex}
        contentContainerStyle={styles.listContent}
        activationDistance={12}
        removeClippedSubviews={false}
        ListEmptyComponent={
          <ThemedText style={styles.emptyListHint}>
            {readinessFilter === "all" && searchQuery.length === 0
              ? "등록된 곡이 없습니다.\n우하단 + 버튼에서 새 곡을 추가해 보세요."
              : "조건에 맞는 곡이 없습니다."}
          </ThemedText>
        }
        onDragEnd={({ data }) =>
          readinessFilter === "all" && searchQuery.length === 0
            ? void handleDragEnd(data)
            : undefined
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
            dragReorderEnabled={
              readinessFilter === "all" && searchQuery.length === 0
            }
            onDisabledDragAttempt={showReorderDisabledToast}
          />
        )}
      />

      <AddFab
        open={addMenuOpen}
        onOpenChange={setAddMenuOpen}
        onAddManual={openCreateModal}
        onAddFromChart={() => router.push("/chart")}
        onAddFromYoutube={() => setYoutubeImportVisible(true)}
      />

      <Modal
        visible={modalSongId === CREATE_MODAL_ID}
        animationType="fade"
        transparent
        onRequestClose={closeModal}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={closeModal} />
          <View style={styles.modalCard}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              새 곡 추가
            </ThemedText>

            <KeyboardAwareScrollView
              fill={false}
              style={{ maxHeight: modalScrollMaxHeight }}
              extraBottomPadding={16}
              footer={
                <View style={styles.modalActions}>
                  <View style={{ flex: 1 }} />
                  <Button
                    label="취소"
                    variant="text"
                    onPress={closeModal}
                  />
                  <Button label="저장" onPress={() => void handleSaveModal()} />
                </View>
              }
            >
              <SongBasicFields
                title={draftTitle}
                onTitleChange={setDraftTitle}
                artist={draftArtist}
                onArtistChange={setDraftArtist}
                tjNumber={draftTjNumber}
                onTjNumberChange={setDraftTjNumber}
                kyNumber={draftKyNumber}
                onKyNumberChange={setDraftKyNumber}
                autoFocusTitle
              />

              <FieldLabel>남/여 키</FieldLabel>
              <GenderKeyRow value={draftGender} onChange={setDraftGender} />

              <FieldLabel>준비도</FieldLabel>
              <ReadinessChipRow
                value={draftReadiness}
                onChange={setDraftReadiness}
              />

              <FieldLabel>음정 (키 업/다운)</FieldLabel>
              <TransposeStepper
                value={draftTranspose}
                onChange={setDraftTranspose}
              />

              <FieldLabel>메모</FieldLabel>
              <MemoField value={draftMemo} onChangeText={setDraftMemo} />
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>

      <YoutubeImportModal
        visible={youtubeImportVisible}
        onClose={closeYoutubeImportModal}
        onAdd={handleYoutubeImportAdd}
        existingSongs={songs}
        initialUrl={youtubeImportInitialUrl}
      />

      <Toast controller={toast} offset={56} />
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
  readinessFilterScroller: {
    marginBottom: 0,
  },
  readinessFilterScrollContent: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingRight: 4,
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
  modalActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    paddingTop: 4,
  },
});
