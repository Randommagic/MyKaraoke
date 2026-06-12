import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useConfirm } from "@/components/design/confirm-dialog-context";
import { KeyboardAwareScrollView } from "@/components/design/keyboard-aware-scroll";
import { MemoField, TransposeStepper } from "@/components/song/SongForm";
import {
  EditPillButton,
  FieldLabel,
  GenderKeyRow,
  ReadinessChipRow,
  SectionDivider,
  SongScreenHeader,
  SongUi,
} from "@/components/song/song-screen-ui";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { logDebug } from "@/lib/debug-log-buffer";
import { UI_STRINGS } from "@/lib/ui-strings";
import {
  getPrimarySungDate,
  isSungToday,
  localYmd,
} from "@/lib/song-form-helpers";
import {
  clampSongMemo,
  loadSongs,
  saveSongs,
  toggleSungTodayInDates,
  type Song,
  type SongGenderKey,
  type SongImportSource,
  type SongReadiness,
} from "@/lib/songs-storage";
import { normalizeYoutubeUrlForStorage } from "@/lib/youtube-import";
import {
  buildYoutubeButtonLabel,
  openSongYoutube,
  songHasYoutubeVideoLink,
  songUsesYoutubeKaraokeSearch,
} from "@/lib/song-youtube";

function formatLastSungLabel(sungDates: string[]): string {
  const primary = getPrimarySungDate(sungDates);
  if (!primary) return "없음";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(primary);
  if (m) return `${m[1]}.${m[2]}.${m[3]}`;
  return primary;
}

export default function SongDetailScreen() {
  const confirm = useConfirm();
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const songId =
    typeof params.id === "string" ? params.id : (params.id?.[0] ?? "");

  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [tjNumber, setTjNumber] = useState("");
  const [kyNumber, setKyNumber] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [importSource, setImportSource] = useState<SongImportSource>("manual");

  const [memo, setMemo] = useState("");
  const memoRef = useRef(memo);
  const savedMemoRef = useRef("");
  memoRef.current = memo;
  const [genderKey, setGenderKey] = useState<SongGenderKey>("unset");
  const [readiness, setReadiness] = useState<SongReadiness>("none");
  const [transpose, setTranspose] = useState(0);
  const [sungDates, setSungDates] = useState<string[]>([]);

  const applySong = useCallback((s: Song) => {
    setTitle(s.title);
    setArtist(s.artist);
    setTjNumber(s.tjNumber);
    setKyNumber(s.kyNumber);
    setYoutubeUrl(normalizeYoutubeUrlForStorage(s.youtubeUrl));
    setImportSource(s.importSource);
    const loadedMemo = clampSongMemo(s.memo ?? "");
    setMemo(loadedMemo);
    savedMemoRef.current = loadedMemo.trim();
    setGenderKey(s.genderKey);
    setReadiness(s.readiness);
    setTranspose(s.transposeSemitones);
    setSungDates(s.sungDates);
  }, []);

  const reload = useCallback(async () => {
    if (!songId) {
      setMissing(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await loadSongs();
      const found = list.find((s) => s.id === songId);
      if (!found) {
        setMissing(true);
      } else {
        setMissing(false);
        applySong(found);
      }
    } catch (e) {
      logDebug(
        `[song/${songId}] 로드 실패: ${e instanceof Error ? e.message : String(e)}`,
        "error",
      );
      setMissing(true);
    } finally {
      setLoading(false);
    }
  }, [applySong, songId]);

  const patchSong = useCallback(
    async (patch: Partial<Song>) => {
      if (!songId) return false;
      try {
        const list = await loadSongs();
        const next = list.map((s) =>
          s.id === songId ? { ...s, ...patch } : s,
        );
        await saveSongs(next);
        return true;
      } catch (e) {
        logDebug(
          `[song] 저장 실패: ${e instanceof Error ? e.message : String(e)}`,
          "warn",
        );
        return false;
      }
    },
    [songId],
  );

  const flushMemoSave = useCallback(async () => {
    const trimmed = clampSongMemo(memoRef.current.trim());
    if (trimmed === savedMemoRef.current) return true;
    const ok = await patchSong({ memo: trimmed });
    if (ok) {
      savedMemoRef.current = trimmed;
      setMemo(trimmed);
      logDebug(`[song/${songId}] 메모 저장`, "info");
    }
    return ok;
  }, [patchSong, songId]);

  useFocusEffect(
    useCallback(() => {
      void reload();
      return () => {
        void flushMemoSave();
      };
    }, [reload, flushMemoSave]),
  );

  useEffect(() => {
    if (loading || missing || !songId) return;
    const unsub = navigation.addListener("beforeRemove", (e) => {
      const trimmed = memoRef.current.trim();
      if (trimmed === savedMemoRef.current) return;
      e.preventDefault();
      void (async () => {
        await flushMemoSave();
        navigation.dispatch(e.data.action);
      })();
    });
    return unsub;
  }, [navigation, loading, missing, songId, flushMemoSave]);

  const saveReadiness = useCallback(
    async (v: SongReadiness) => {
      setReadiness(v);
      const ok = await patchSong({ readiness: v });
      if (ok) logDebug(`[song/${songId}] 준비도 저장`, "info");
    },
    [patchSong, songId],
  );

  const saveGender = useCallback(
    async (v: SongGenderKey) => {
      setGenderKey(v);
      const ok = await patchSong({ genderKey: v });
      if (ok) logDebug(`[song/${songId}] 키 저장`, "info");
    },
    [patchSong, songId],
  );

  const saveTranspose = useCallback(
    async (next: number) => {
      const clamped = Math.max(-12, Math.min(12, next));
      setTranspose(clamped);
      const ok = await patchSong({ transposeSemitones: clamped });
      if (ok) logDebug(`[song/${songId}] 음정 저장`, "info");
    },
    [patchSong, songId],
  );

  const handleBack = useCallback(() => {
    Keyboard.dismiss();
    void (async () => {
      await flushMemoSave();
      router.back();
    })();
  }, [flushMemoSave, router]);

  const handleDelete = useCallback(async () => {
    if (!songId) return;
    try {
      const list = await loadSongs();
      await saveSongs(list.filter((s) => s.id !== songId));
      logDebug(`[song/${songId}] 삭제 완료`, "info");
      router.back();
    } catch {
      logDebug("[song] 삭제 실패", "warn");
    }
  }, [router, songId]);

  const markSungToday = useCallback(async () => {
    if (!songId) return;
    const day = localYmd(new Date());
    const nextDates = toggleSungTodayInDates(sungDates, day);
    try {
      const list = await loadSongs();
      const next = list.map((s) =>
        s.id === songId ? { ...s, sungDates: nextDates } : s,
      );
      await saveSongs(next);
      setSungDates(nextDates);
      logDebug(`[song/${songId}] 오늘 부름 토글`, "info");
    } catch {
      logDebug("[song] 오늘 부름 저장 실패", "warn");
    }
  }, [songId, sungDates]);

  const openYouTube = useCallback(async () => {
    const ok = await openSongYoutube({
      importSource,
      youtubeUrl,
      artist,
      title,
    });
    if (!ok) logDebug("[song] YouTube 열기 실패", "warn");
  }, [artist, importSource, title, youtubeUrl]);

  const goEdit = useCallback(() => {
    Keyboard.dismiss();
    void (async () => {
      await flushMemoSave();
      router.push(`/song/${songId}/edit`);
    })();
  }, [flushMemoSave, router, songId]);

  if (!songId) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>잘못된 주소입니다.</ThemedText>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <ThemedText type="link">돌아가기</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  if (loading) {
    return (
      <ThemedView style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={SongUi.accent} />
      </ThemedView>
    );
  }

  if (missing) {
    return (
      <ThemedView style={[styles.centered, { paddingTop: insets.top }]}>
        <ThemedText style={{ textAlign: "center", paddingHorizontal: 24 }}>
          곡을 찾을 수 없습니다. 목록에서 삭제되었을 수 있습니다.
        </ThemedText>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <ThemedText type="link">목록으로</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const songForYoutube = {
    importSource,
    youtubeUrl,
    artist,
    title,
  };
  const hasYoutubeVideo = songHasYoutubeVideoLink(songForYoutube);
  const hasYoutubeSearch = songUsesYoutubeKaraokeSearch(songForYoutube);
  const youtubeLabel = buildYoutubeButtonLabel(artist, title);
  const sungToday = isSungToday(sungDates);

  return (
    <ThemedView style={styles.screen}>
      <View style={{ paddingTop: insets.top, backgroundColor: SongUi.screenBg }}>
        <SongScreenHeader
          title="곡 정보"
          onBack={handleBack}
          right={<EditPillButton onPress={goEdit} />}
        />
      </View>

      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
      >
          <SectionDivider label="곡 정보" />

          <View style={styles.songCard}>
            <Text style={styles.songTitle}>{title.trim() || "(제목 없음)"}</Text>
            {artist.trim() ? (
              <Text style={styles.songArtist}>{artist.trim()}</Text>
            ) : null}
            {(tjNumber.trim() || kyNumber.trim()) ? (
              <View style={styles.metaChipRow}>
                {tjNumber.trim() ? (
                  <View style={styles.metaChip}>
                    <Ionicons
                      name="tv-outline"
                      size={12}
                      color={SongUi.chipMetaText}
                    />
                    <Text style={styles.metaChipText}>
                      태진 {tjNumber.trim()}
                    </Text>
                  </View>
                ) : null}
                {kyNumber.trim() ? (
                  <View style={styles.metaChip}>
                    <Ionicons
                      name="tv-outline"
                      size={12}
                      color={SongUi.chipMetaText}
                    />
                    <Text style={styles.metaChipText}>
                      금영 {kyNumber.trim()}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          {hasYoutubeVideo || hasYoutubeSearch ? (
            <Pressable
              onPress={() => void openYouTube()}
              style={({ pressed }) => [
                styles.youtubeRow,
                { opacity: pressed ? 0.9 : 1 },
              ]}
              accessibilityRole="link"
              accessibilityLabel={
                hasYoutubeVideo
                  ? "YouTube 영상 열기"
                  : "YouTube에서 노래방 검색"
              }
            >
              <Ionicons name="logo-youtube" size={20} color={SongUi.youtube} />
              <Text style={styles.youtubeUrlText} numberOfLines={1}>
                {youtubeLabel}
              </Text>
              {hasYoutubeVideo ? (
                <Ionicons name="play" size={18} color={SongUi.youtube} />
              ) : null}
            </Pressable>
          ) : null}

          <SectionDivider label="나의 정보" />

          <FieldLabel>준비도</FieldLabel>
          <ReadinessChipRow value={readiness} onChange={(v) => void saveReadiness(v)} />

          <FieldLabel>남/여 키</FieldLabel>
          <GenderKeyRow value={genderKey} onChange={(v) => void saveGender(v)} />

          <FieldLabel>음정 (키 업/다운)</FieldLabel>
          <TransposeStepper
            value={transpose}
            onChange={(v) => void saveTranspose(v)}
          />

          <View>
            <FieldLabel>메모</FieldLabel>
            <MemoField
              value={memo}
              onChangeText={setMemo}
              onBlur={() => void flushMemoSave()}
            />
          </View>

          <View style={styles.sungRow}>
            <Text style={styles.sungLabel}>
              마지막으로 부른 날: {formatLastSungLabel(sungDates)}
            </Text>
            <Pressable
              onPress={() => void markSungToday()}
              style={({ pressed }) => [
                styles.sungBtn,
                sungToday ? styles.sungBtnActive : null,
                { opacity: pressed ? 0.88 : 1 },
              ]}
            >
              <Ionicons
                name="mic-outline"
                size={16}
                color={sungToday ? SongUi.accent : SongUi.textSecondary}
              />
              <Text
                style={[
                  styles.sungBtnText,
                  sungToday ? { color: SongUi.accent } : null,
                ]}
              >
                {sungToday
                  ? UI_STRINGS.songDetail.sungTodayCancel
                  : UI_STRINGS.songDetail.sungToday}
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() =>
              confirm({
                title: "곡을 삭제할까요?",
                message: "삭제하면 되돌릴 수 없어요.",
                confirmLabel: "곡 삭제",
                destructive: true,
                onConfirm: () => void handleDelete(),
              })
            }
            style={({ pressed }) => [
              styles.deleteBtn,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={styles.deleteBtnText}>곡 삭제</Text>
          </Pressable>
      </KeyboardAwareScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: SongUi.screenBg },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  backLink: { marginTop: 16, padding: 12 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  songCard: {
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: SongUi.cardBg,
    borderWidth: 1,
    borderColor: SongUi.border,
    padding: 16,
  },
  songTitle: {
    fontSize: 17,
    fontWeight: "500",
    color: SongUi.text,
    marginBottom: 4,
  },
  songArtist: {
    fontSize: 14,
    color: SongUi.textSecondary,
    marginBottom: 12,
  },
  metaChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: SongUi.chipMetaBg,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metaChipText: {
    fontSize: 12,
    color: SongUi.chipMetaText,
  },
  youtubeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: SongUi.cardBg,
    borderWidth: 1,
    borderColor: SongUi.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  youtubeUrlText: {
    flex: 1,
    fontSize: 12,
    color: SongUi.textSecondary,
  },
  sungRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 28,
  },
  sungLabel: {
    flex: 1,
    fontSize: 13,
    color: SongUi.textMuted,
  },
  sungBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: SongUi.border,
    backgroundColor: SongUi.cardBg,
  },
  sungBtnActive: {
    borderColor: SongUi.accent,
    backgroundColor: SongUi.genderActiveBg,
  },
  sungBtnText: {
    fontSize: 13,
    color: SongUi.textSecondary,
    fontWeight: "500",
  },
  deleteBtn: {
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: "500",
    color: SongUi.danger,
  },
});
