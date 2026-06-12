import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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
import { SongBasicFields } from "@/components/song/SongForm";
import {
  SongScreenHeader,
  SongUi,
  songFieldStyles,
} from "@/components/song/song-screen-ui";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { logDebug } from "@/lib/debug-log-buffer";
import { sanitizeKaraokeDigits } from "@/lib/song-form-helpers";
import { isYoutubeImportLinkLocked } from "@/lib/song-youtube";
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
  /** 로드 시점에 저장돼 있던 URL */
  const [savedYoutubeUrl, setSavedYoutubeUrl] = useState("");
  const [youtubeUnlinked, setYoutubeUnlinked] = useState(false);

  const youtubeLinkLocked = isYoutubeImportLinkLocked(
    importSource,
    savedYoutubeUrl,
    youtubeUnlinked,
  );

  const applySong = useCallback((s: Song) => {
    setDraftTitle(s.title);
    setDraftArtist(s.artist);
    setDraftTjNumber(s.tjNumber);
    setDraftKyNumber(s.kyNumber);
    const normalized = normalizeYoutubeUrlForStorage(s.youtubeUrl);
    setSavedYoutubeUrl(normalized);
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

  const handleSave = useCallback(async () => {
    const title = draftTitle.trim();
    if (!title || !songId) return;
    try {
      const list = await loadSongs();
      const next = list.map((s) => {
        if (s.id !== songId) return s;
        const hadLockedYoutubeLink = isYoutubeImportLinkLocked(
          s.importSource,
          s.youtubeUrl,
          false,
        );
        return {
          ...s,
          title,
          artist: draftArtist.trim(),
          tjNumber: sanitizeKaraokeDigits(draftTjNumber),
          kyNumber: sanitizeKaraokeDigits(draftKyNumber),
          youtubeUrl:
            youtubeUnlinked && s.importSource === "youtube"
              ? ""
              : hadLockedYoutubeLink
                ? s.youtubeUrl
                : "",
        };
      });
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
    router,
    songId,
    youtubeUnlinked,
  ]);

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
      <View
        style={{ paddingTop: insets.top, backgroundColor: SongUi.screenBg }}
      >
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

        <SongBasicFields
          title={draftTitle}
          onTitleChange={setDraftTitle}
          artist={draftArtist}
          onArtistChange={setDraftArtist}
          tjNumber={draftTjNumber}
          onTjNumberChange={setDraftTjNumber}
          kyNumber={draftKyNumber}
          onKyNumberChange={setDraftKyNumber}
        />

        {youtubeLinkLocked ? (
          <>
            <Text style={[styles.fieldLabel, { marginTop: 4 }]}>
              YouTube 링크
            </Text>
            <KeyboardAwareField>
              <View style={styles.youtubeInputRow}>
                <TextInput
                  value={savedYoutubeUrl}
                  editable={false}
                  placeholderTextColor={SongUi.textFaint}
                  style={[
                    songFieldStyles.input,
                    styles.youtubeInput,
                    styles.youtubeInputReadonly,
                  ]}
                />
                <Pressable
                  onPress={() => setYoutubeUnlinked(true)}
                  style={({ pressed }) => [
                    styles.unlinkBtn,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                  accessibilityLabel="YouTube 링크 삭제"
                >
                  <MaterialCommunityIcons
                    name="link-off"
                    size={22}
                    color={SongUi.danger}
                  />
                </Pressable>
              </View>
            </KeyboardAwareField>
            <Text style={styles.youtubeHint}>
              링크를 삭제한 이후에는 다시 붙일 수 없어요.
            </Text>
          </>
        ) : null}
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
  youtubeInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 0,
  },
  youtubeInput: {
    flex: 1,
    marginBottom: 0,
  },
  youtubeInputReadonly: {
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
