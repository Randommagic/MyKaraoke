import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  KeyboardAwareField,
  KeyboardAwareScrollView,
} from "@/components/design/keyboard-aware-scroll";
import {
  SongScreenHeader,
  SongUi,
  songFieldStyles,
} from "@/components/song/song-screen-ui";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { logDebug } from "@/lib/debug-log-buffer";
import { sanitizeKaraokeDigits } from "@/lib/song-form-helpers";
import {
  loadSongs,
  saveSongs,
  type Song,
  type SongImportSource,
} from "@/lib/songs-storage";
import { normalizeYoutubeUrlForStorage } from "@/lib/youtube-import";

export default function SongEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const songId =
    typeof params.id === "string" ? params.id : (params.id?.[0] ?? "");

  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [importSource, setImportSource] = useState<SongImportSource>("manual");

  const [draftTitle, setDraftTitle] = useState("");
  const [draftArtist, setDraftArtist] = useState("");
  const [draftTjNumber, setDraftTjNumber] = useState("");
  const [draftKyNumber, setDraftKyNumber] = useState("");
  const [draftYoutubeUrl, setDraftYoutubeUrl] = useState("");
  const [youtubeUnlinked, setYoutubeUnlinked] = useState(false);

  const [focusedField, setFocusedField] = useState<string | null>(null);

  const youtubeLinkLocked = importSource === "youtube" && !youtubeUnlinked;

  const applySong = useCallback((s: Song) => {
    setDraftTitle(s.title);
    setDraftArtist(s.artist);
    setDraftTjNumber(s.tjNumber);
    setDraftKyNumber(s.kyNumber);
    setDraftYoutubeUrl(normalizeYoutubeUrlForStorage(s.youtubeUrl));
    setImportSource(s.importSource);
    setYoutubeUnlinked(false);
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

  useEffect(() => {
    void reload();
  }, [reload]);

  const inputStyle = useCallback(
    (key: string) => [
      songFieldStyles.input,
      focusedField === key ? songFieldStyles.inputFocused : null,
      { marginBottom: 14 },
    ],
    [focusedField],
  );

  const handleSave = useCallback(async () => {
    const title = draftTitle.trim();
    if (!title || !songId) return;
    try {
      const list = await loadSongs();
      const next = list.map((s) =>
        s.id === songId
          ? {
              ...s,
              title,
              artist: draftArtist.trim(),
              tjNumber: sanitizeKaraokeDigits(draftTjNumber),
              kyNumber: sanitizeKaraokeDigits(draftKyNumber),
              youtubeUrl: youtubeUnlinked
                ? ""
                : s.importSource === "youtube"
                  ? s.youtubeUrl
                  : normalizeYoutubeUrlForStorage(draftYoutubeUrl),
            }
          : s,
      );
      await saveSongs(next);
      logDebug(`[song/${songId}] 저장 완료`, "info");
      router.back();
    } catch (e) {
      logDebug(
        `[song] 저장 실패: ${e instanceof Error ? e.message : String(e)}`,
        "warn",
      );
    }
  }, [
    draftArtist,
    draftKyNumber,
    draftTjNumber,
    draftTitle,
    draftYoutubeUrl,
    router,
    songId,
    youtubeUnlinked,
  ]);

  const displayYoutubeLocked = useMemo(() => {
    if (youtubeUnlinked) return "";
    return draftYoutubeUrl.trim();
  }, [draftYoutubeUrl, youtubeUnlinked]);

  if (!songId) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>잘못된 주소입니다.</ThemedText>
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
          곡을 찾을 수 없습니다.
        </ThemedText>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <ThemedText type="link">돌아가기</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <View style={{ paddingTop: insets.top, backgroundColor: SongUi.screenBg }}>
        <SongScreenHeader
          title="곡 정보 편집"
          onBack={() => router.back()}
          right={
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text style={styles.cancelText}>취소</Text>
            </Pressable>
          }
        />
      </View>

      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        footer={
          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            <Pressable
              onPress={() => void handleSave()}
              style={({ pressed }) => [
                styles.saveBtn,
                { opacity: pressed ? 0.88 : 1 },
              ]}
            >
              <Text style={styles.saveBtnText}>저장</Text>
            </Pressable>
          </View>
        }
      >
          <View style={styles.banner}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={SongUi.youtube}
            />
            <Text style={styles.bannerText}>
              곡 자체 정보를 수정하는 화면이에요. 저장을 눌러야 반영돼요.
            </Text>
          </View>

          <Text style={styles.fieldLabel}>노래 제목</Text>
          <KeyboardAwareField>
            <TextInput
              value={draftTitle}
              onChangeText={setDraftTitle}
              placeholder="제목"
              placeholderTextColor={SongUi.textFaint}
              onFocus={() => setFocusedField("title")}
              onBlur={() => setFocusedField(null)}
              style={inputStyle("title")}
            />
          </KeyboardAwareField>

          <Text style={styles.fieldLabel}>가수</Text>
          <KeyboardAwareField>
            <TextInput
              value={draftArtist}
              onChangeText={setDraftArtist}
              placeholder="가수명"
              placeholderTextColor={SongUi.textFaint}
              onFocus={() => setFocusedField("artist")}
              onBlur={() => setFocusedField(null)}
              style={inputStyle("artist")}
            />
          </KeyboardAwareField>

          <Text style={styles.fieldLabel}>곡 번호</Text>
          <View style={styles.numberRow}>
            <View style={styles.numberCol}>
              <Text style={songFieldStyles.subLabel}>태진</Text>
              <KeyboardAwareField>
                <TextInput
                  value={draftTjNumber}
                  onChangeText={(text) =>
                    setDraftTjNumber(sanitizeKaraokeDigits(text))
                  }
                  placeholder="번호"
                  placeholderTextColor={SongUi.textFaint}
                  keyboardType="number-pad"
                  maxLength={6}
                  onFocus={() => setFocusedField("tj")}
                  onBlur={() => setFocusedField(null)}
                  style={[...inputStyle("tj"), { marginBottom: 0 }]}
                />
              </KeyboardAwareField>
            </View>
            <View style={styles.numberCol}>
              <Text style={songFieldStyles.subLabel}>금영</Text>
              <KeyboardAwareField>
                <TextInput
                  value={draftKyNumber}
                  onChangeText={(text) =>
                    setDraftKyNumber(sanitizeKaraokeDigits(text))
                  }
                  placeholder="번호"
                  placeholderTextColor={SongUi.textFaint}
                  keyboardType="number-pad"
                  maxLength={6}
                  onFocus={() => setFocusedField("ky")}
                  onBlur={() => setFocusedField(null)}
                  style={[...inputStyle("ky"), { marginBottom: 0 }]}
                />
              </KeyboardAwareField>
            </View>
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 4 }]}>
            YouTube 링크
          </Text>
          {youtubeLinkLocked ? (
            <>
              <View style={styles.youtubeLockedRow}>
                <Text style={styles.youtubeLockedUrl} numberOfLines={1}>
                  {displayYoutubeLocked}
                </Text>
                <Pressable
                  onPress={() => {
                    setYoutubeUnlinked(true);
                    setDraftYoutubeUrl("");
                  }}
                  style={({ pressed }) => [
                    styles.unlinkBtn,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                  accessibilityLabel="YouTube 링크 해제"
                >
                  <MaterialCommunityIcons
                    name="link-off"
                    size={22}
                    color={SongUi.danger}
                  />
                </Pressable>
              </View>
              <Text style={styles.youtubeHint}>
                유튜브에서 가져온 곡은 링크 삭제만 가능해요
              </Text>
            </>
          ) : (
            <KeyboardAwareField>
              <TextInput
                value={draftYoutubeUrl}
                onChangeText={setDraftYoutubeUrl}
                placeholder="https://youtube.com/..."
                placeholderTextColor={SongUi.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                onFocus={() => setFocusedField("youtube")}
                onBlur={() => setFocusedField(null)}
                style={inputStyle("youtube")}
              />
            </KeyboardAwareField>
          )}
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
    paddingTop: 8,
    paddingBottom: 24,
  },
  cancelText: {
    fontSize: 14,
    color: SongUi.textSecondary,
    alignSelf: "flex-end",
  },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: SongUi.genderActiveBg,
    borderWidth: 1,
    borderColor: SongUi.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    color: SongUi.youtube,
    lineHeight: 17,
  },
  fieldLabel: {
    fontSize: 14,
    color: SongUi.textSecondary,
    marginBottom: 8,
    fontWeight: "500",
  },
  numberRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  numberCol: { flex: 1 },
  youtubeLockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: SongUi.border,
    borderRadius: 12,
    backgroundColor: SongUi.cardBg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 6,
  },
  youtubeLockedUrl: {
    flex: 1,
    fontSize: 14,
    color: SongUi.text,
  },
  unlinkBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FACDCD",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SongUi.cardBg,
  },
  youtubeHint: {
    fontSize: 11,
    color: SongUi.textMuted,
    marginBottom: 14,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: SongUi.border,
    backgroundColor: SongUi.screenBg,
    paddingHorizontal: 20,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  saveBtn: {
    backgroundColor: SongUi.accent,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
});
