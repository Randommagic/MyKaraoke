import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  createSongId,
  loadSongs,
  saveSongs,
  SONG_READINESS_OPTIONS,
  type Song,
  type SongGenderKey,
  type SongReadiness,
} from "@/lib/songs-storage";
import { logDebug } from "@/lib/debug-log-buffer";

const GENDER_OPTIONS: { value: SongGenderKey; label: string }[] = [
  { value: "unset", label: "미정" },
  { value: "male", label: "남키" },
  { value: "female", label: "여키" },
];

/** 리스트·필터에서 쓰는 준비도 색·아이콘 */
const READINESS_VISUAL: Record<
  SongReadiness,
  { icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  none: { icon: "ellipse-outline", color: "#9e9e9e" },
  can_full: { icon: "checkmark-circle", color: "#2e7d32" },
  need_practice: { icon: "school-outline", color: "#ef6c00" },
  will_try: { icon: "flag-outline", color: "#c62828" },
};

type ReadinessFilter = "all" | SongReadiness;

const READINESS_FILTER_CHIPS: { value: ReadinessFilter; label: string }[] = [
  { value: "all", label: "전체" },
  ...SONG_READINESS_OPTIONS.map((o) => ({
    value: o.value as ReadinessFilter,
    label: o.label,
  })),
];

function formatTranspose(semitones: number): string {
  if (semitones === 0) return "원키";
  if (semitones > 0) return `${semitones}키 업`;
  return `${Math.abs(semitones)}키 다운`;
}

function sanitizeKaraokeDigits(text: string): string {
  return text.replace(/\D/g, "").slice(0, 6);
}

/** 브라우저/앱에서 열 수 있도록 http(s) 보정 */
function buildYoutubeOpenUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s.replace(/^\/+/u, "")}`;
}

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatLastSungLine(ymd: string): string {
  const s = ymd.trim();
  if (!s) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return `마지막: ${s}`;
  return `마지막: ${Number(m[1])}. ${Number(m[2])}. ${Number(m[3])}.`;
}

function SongRowDetails({
  item,
  iconMuted,
}: {
  item: Song;
  iconMuted: string;
}) {
  const artist = item.artist.trim();
  const t = item.tjNumber.trim();
  const k = item.kyNumber.trim();
  const memo = item.memo.trim();
  const lastSung = item.lastSungAt.trim();
  const numberParts: string[] = [];
  if (t) numberParts.push(`태진 ${t}`);
  if (k) numberParts.push(`금영 ${k}`);
  const numbersLine = numberParts.join(" · ");
  const keyLine = `${GENDER_OPTIONS.find((g) => g.value === item.genderKey)?.label ?? "미정"} · ${formatTranspose(item.transposeSemitones)}`;
  const hasLineBeforeKey = !!(artist || numbersLine);
  const rv = READINESS_VISUAL[item.readiness];

  return (
    <View style={styles.rowTextBlock}>
      <View style={styles.rowTitleRow}>
        <Ionicons
          name={rv.icon}
          size={22}
          color={rv.color}
          style={styles.rowReadinessIcon}
        />
        <ThemedText
          type="defaultSemiBold"
          numberOfLines={2}
          style={styles.rowTitleText}
        >
          {item.title}
        </ThemedText>
      </View>
      {artist ? (
        <ThemedText
          style={[styles.rowArtist, { color: iconMuted }]}
          numberOfLines={1}
        >
          {artist}
        </ThemedText>
      ) : null}
      {numbersLine ? (
        <ThemedText
          style={[styles.rowMetaLine, { color: iconMuted }]}
          numberOfLines={1}
        >
          {numbersLine}
        </ThemedText>
      ) : null}
      <ThemedText
        style={[
          styles.rowMetaLine,
          { color: iconMuted, marginTop: hasLineBeforeKey ? 2 : 4 },
        ]}
        numberOfLines={2}
      >
        {keyLine}
      </ThemedText>
      {memo ? (
        <ThemedText
          style={[styles.rowMemo, { color: iconMuted }]}
          numberOfLines={1}
        >
          메모: {memo}
        </ThemedText>
      ) : null}
      {lastSung ? (
        <ThemedText
          style={[styles.rowLastSung, { color: iconMuted }]}
          numberOfLines={1}
        >
          {formatLastSungLine(lastSung)}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** 수정 모드와 구분해, 새 곡 추가용 모달 상태로 사용 */
const CREATE_MODAL_ID = "__create__";

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const palette = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const screenBg = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const tint = useThemeColor({}, "tint");
  const iconMuted = useThemeColor({}, "icon");

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
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>("all");

  const modalScrollMaxHeight = useMemo(
    () => Math.min(Dimensions.get("window").height * 0.52, 480),
    [],
  );

  const openYouTube = useCallback(async (raw: string) => {
    const url = buildYoutubeOpenUrl(raw);
    if (!url) return;
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) {
        logDebug(`[home] YouTube URL 열기 불가: ${url}`, "warn");
        return;
      }
      await Linking.openURL(url);
    } catch (e) {
      logDebug(
        `[home] YouTube 열기 실패: ${e instanceof Error ? e.message : String(e)}`,
        "warn",
      );
    }
  }, []);

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

  const markSungToday = useCallback(
    (songId: string) => {
      const day = localYmd(new Date());
      const next = songs.map((s) =>
        s.id === songId ? { ...s, lastSungAt: day } : s,
      );
      void persist(next).catch(() => {});
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

  const openSettings = useCallback((song: Song) => {
    setModalSongId(song.id);
    setDraftTitle(song.title);
    setDraftArtist(song.artist);
    setDraftTjNumber(song.tjNumber);
    setDraftKyNumber(song.kyNumber);
    setDraftMemo(song.memo);
    setDraftYoutubeUrl(song.youtubeUrl);
    setDraftGender(song.genderKey);
    setDraftReadiness(song.readiness);
    setDraftTranspose(song.transposeSemitones);
  }, []);

  const closeModal = useCallback(() => {
    setModalSongId(null);
  }, []);

  const isCreateModal = modalSongId === CREATE_MODAL_ID;

  const handleSaveModal = useCallback(async () => {
    if (!modalSongId) return;
    const title = draftTitle.trim();
    if (!title) return;
    const transpose = Math.max(-12, Math.min(12, draftTranspose));
    const artist = draftArtist.trim();
    const tjNumber = sanitizeKaraokeDigits(draftTjNumber);
    const kyNumber = sanitizeKaraokeDigits(draftKyNumber);
    const memo = draftMemo.trim();
    const youtubeUrl = draftYoutubeUrl.trim();
    try {
      if (modalSongId === CREATE_MODAL_ID) {
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
      } else {
        const next = songs.map((s) =>
          s.id === modalSongId
            ? {
                ...s,
                title,
                artist,
                tjNumber,
                kyNumber,
                memo,
                youtubeUrl,
                genderKey: draftGender,
                readiness: draftReadiness,
                transposeSemitones: transpose,
              }
            : s,
        );
        await persist(next);
      }
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

  const handleDeleteFromModal = useCallback(async () => {
    if (!modalSongId || modalSongId === CREATE_MODAL_ID) return;
    try {
      await persist(songs.filter((s) => s.id !== modalSongId));
      closeModal();
    } catch {
      logDebug("[home] 삭제 실패", "warn");
    }
  }, [closeModal, modalSongId, persist, songs]);

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

      <Pressable
        onPress={openCreateModal}
        style={({ pressed }) => [
          styles.addSongButton,
          { backgroundColor: tint, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Ionicons name="add-circle-outline" size={22} color="#fff" />
        <ThemedText style={styles.addSongButtonLabel}>곡 추가</ThemedText>
      </Pressable>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.readinessFilterScroll}
        contentContainerStyle={styles.readinessFilterContent}
      >
        {READINESS_FILTER_CHIPS.map((chip) => {
          const selected = readinessFilter === chip.value;
          const isAll = chip.value === "all";
          const chipVisual = isAll
            ? null
            : READINESS_VISUAL[chip.value as SongReadiness];
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
            </Pressable>
          );
        })}
      </ScrollView>

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
              ? "등록된 곡이 없습니다. 「곡 추가」로 새 곡을 등록해 보세요."
              : "이 준비도에 해당하는 곡이 없습니다. 필터를 바꿔 보세요."}
          </ThemedText>
        }
        renderItem={({ item }) => {
          const yt = item.youtubeUrl.trim();
          const idx = songs.findIndex((s) => s.id === item.id);
          return (
          <View
            style={[
              styles.row,
              {
                borderColor: iconMuted,
                backgroundColor: colorScheme === "dark" ? "#1c1c1e" : "#fff",
              },
            ]}
          >
            <View style={styles.rowMain}>
            <View style={styles.reorderColumn}>
              <Pressable
                onPress={() => handleMoveSongByArrows(item.id, -1)}
                disabled={idx <= 0}
                style={({ pressed }) => [
                  styles.reorderBtn,
                  {
                    opacity: idx <= 0 ? 0.35 : pressed ? 0.6 : 1,
                  },
                ]}
                accessibilityLabel="한 칸 위로"
              >
                <Ionicons name="chevron-up" size={22} color={iconMuted} />
              </Pressable>
              <Pressable
                onPress={() => handleMoveSongByArrows(item.id, 1)}
                disabled={idx >= songs.length - 1}
                style={({ pressed }) => [
                  styles.reorderBtn,
                  {
                    opacity:
                      idx >= songs.length - 1 ? 0.35 : pressed ? 0.6 : 1,
                  },
                ]}
                accessibilityLabel="한 칸 아래로"
              >
                <Ionicons name="chevron-down" size={22} color={iconMuted} />
              </Pressable>
            </View>
            <SongRowDetails item={item} iconMuted={iconMuted} />
            <Pressable
              onPress={() => openSettings(item)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`${item.title} 설정`}
              style={({ pressed }) => [
                styles.gear,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons
                name="settings-outline"
                size={22}
                color={palette.tint}
              />
            </Pressable>
            </View>
            <View style={styles.rowActionsBar}>
              {yt ? (
                <Pressable
                  onPress={() => void openYouTube(yt)}
                  style={({ pressed }) => [
                    styles.rowActionBtn,
                    { opacity: pressed ? 0.75 : 1 },
                  ]}
                  accessibilityRole="link"
                  accessibilityLabel={`YouTube에서 ${item.title} 열기`}
                >
                  <Ionicons name="logo-youtube" size={22} color="#FF0000" />
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => markSungToday(item.id)}
                style={({ pressed }) => [
                  styles.rowActionBtn,
                  { opacity: pressed ? 0.75 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="오늘 부른 것으로 저장"
              >
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={palette.tint}
                />
              </Pressable>
            </View>
          </View>
          );
        }}
      />

      <Modal
        visible={modalSongId !== null}
        animationType="fade"
        transparent
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={closeModal} />
          <View style={[styles.modalCard, { backgroundColor: screenBg }]}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              {isCreateModal ? "새 곡 추가" : "곡 정보"}
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
                autoFocus={isCreateModal}
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
                    style={[styles.modalInput, inputSurfaceStyle, styles.modalNumberInput]}
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
                    style={[styles.modalInput, inputSurfaceStyle, styles.modalNumberInput]}
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
                          backgroundColor: selected ? `${tint}22` : "transparent",
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
                          backgroundColor: selected ? `${tint}22` : "transparent",
                        },
                      ]}
                    >
                      <Ionicons
                        name={rv.icon}
                        size={20}
                        color={rv.color}
                      />
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

              <ThemedText style={styles.fieldLabel}>음정 (키 업/다운)</ThemedText>
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

              {!isCreateModal && modalSongId ? (
                <View style={styles.sungTodayBlock}>
                  <ThemedText style={[styles.sungTodayHint, { color: iconMuted }]}>
                    {(() => {
                      const cur =
                        songs.find((s) => s.id === modalSongId)?.lastSungAt?.trim() ??
                        "";
                      return cur ? formatLastSungLine(cur) : "마지막으로 부른 날: 없음";
                    })()}
                  </ThemedText>
                  <Pressable
                    onPress={() => markSungToday(modalSongId)}
                    style={({ pressed }) => [
                      styles.sungTodayBtn,
                      {
                        borderColor: iconMuted,
                        opacity: pressed ? 0.85 : 1,
                        backgroundColor:
                          colorScheme === "dark" ? "#2c2c2e" : "#f5f5f5",
                      },
                    ]}
                  >
                    <Ionicons name="checkmark-circle" size={22} color={tint} />
                    <ThemedText
                      type="defaultSemiBold"
                      style={{ marginLeft: 10, color: textColor }}
                    >
                      오늘 불렀음
                    </ThemedText>
                  </Pressable>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.modalActions}>
              {!isCreateModal ? (
                <Pressable
                  onPress={handleDeleteFromModal}
                  style={({ pressed }) => [
                    styles.textBtn,
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <ThemedText style={{ color: "#c62828" }}>삭제</ThemedText>
                </Pressable>
              ) : null}
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
  addSongButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 12,
  },
  addSongButtonLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 17,
  },
  readinessFilterScroll: {
    marginBottom: 10,
    maxHeight: 48,
  },
  readinessFilterContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 4,
  },
  readinessFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  readinessFilterChipIcon: {
    marginRight: 6,
  },
  listContent: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  row: {
    flexDirection: "column",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  rowMain: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  rowActionsBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    paddingTop: 6,
  },
  rowActionBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  reorderColumn: {
    marginRight: 4,
    justifyContent: "center",
    paddingTop: 4,
  },
  reorderBtn: {
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  rowTextBlock: {
    flex: 1,
    paddingRight: 8,
  },
  rowTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  rowReadinessIcon: {
    marginTop: 2,
  },
  rowTitleText: {
    flex: 1,
    minWidth: 0,
  },
  rowArtist: {
    marginTop: 4,
    fontSize: 14,
  },
  rowMetaLine: {
    marginTop: 2,
    fontSize: 13,
  },
  rowMemo: {
    marginTop: 4,
    fontSize: 12,
  },
  rowLastSung: {
    marginTop: 4,
    fontSize: 12,
  },
  gear: {
    padding: 6,
    marginTop: 2,
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
  sungTodayBlock: {
    marginBottom: 4,
  },
  sungTodayHint: {
    fontSize: 12,
    marginBottom: 10,
  },
  sungTodayBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    alignSelf: "stretch",
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
