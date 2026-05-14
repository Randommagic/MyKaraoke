import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  buildYoutubeOpenUrl,
  formatLastSungLine,
  formatTranspose,
  GENDER_OPTIONS,
  localYmd,
  READINESS_VISUAL,
  sanitizeKaraokeDigits,
} from "@/lib/song-form-helpers";
import { logDebug } from "@/lib/debug-log-buffer";
import {
  extractYoutubeVideoIdFromSongUrl,
  youtubeThumbnailUrlFromVideoId,
} from "@/lib/youtube-import";
import {
  loadSongs,
  saveSongs,
  SONG_READINESS_OPTIONS,
  type Song,
  type SongGenderKey,
  type SongReadiness,
} from "@/lib/songs-storage";

function SongDetailYoutubeThumb({
  uri,
  iconMuted,
}: {
  uri: string;
  iconMuted: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <View
        style={[
          styles.ytThumbImage,
          styles.ytThumbPlaceholder,
          { borderColor: iconMuted },
        ]}
      >
        <Ionicons name="logo-youtube" size={48} color="#FF0000" />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={styles.ytThumbImage}
      contentFit="cover"
      accessibilityIgnoresInvertColors
      onError={() => setFailed(true)}
    />
  );
}

export default function SongDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const songId = typeof params.id === "string" ? params.id : params.id?.[0] ?? "";

  const colorScheme = useColorScheme() ?? "light";
  const insets = useSafeAreaInsets();
  const screenBg = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const tint = useThemeColor({}, "tint");
  const iconMuted = useThemeColor({}, "icon");

  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftArtist, setDraftArtist] = useState("");
  const [draftTjNumber, setDraftTjNumber] = useState("");
  const [draftKyNumber, setDraftKyNumber] = useState("");
  const [draftMemo, setDraftMemo] = useState("");
  const [draftYoutubeUrl, setDraftYoutubeUrl] = useState("");
  const [draftGender, setDraftGender] = useState<SongGenderKey>("unset");
  const [draftReadiness, setDraftReadiness] = useState<SongReadiness>("none");
  const [draftTranspose, setDraftTranspose] = useState(0);
  const [lastSungAt, setLastSungAt] = useState("");

  const inputSurfaceStyle = useMemo(
    () => ({
      borderColor: iconMuted,
      color: textColor,
      backgroundColor: colorScheme === "dark" ? "#1c1c1e" : "#f2f2f7",
    }),
    [colorScheme, iconMuted, textColor],
  );

  const applySong = useCallback((s: Song) => {
    setDraftTitle(s.title);
    setDraftArtist(s.artist);
    setDraftTjNumber(s.tjNumber);
    setDraftKyNumber(s.kyNumber);
    setDraftMemo(s.memo);
    setDraftYoutubeUrl(s.youtubeUrl);
    setDraftGender(s.genderKey);
    setDraftReadiness(s.readiness);
    setDraftTranspose(s.transposeSemitones);
    setLastSungAt(s.lastSungAt);
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

  const bumpTranspose = useCallback((delta: number) => {
    setDraftTranspose((v) => Math.max(-12, Math.min(12, v + delta)));
  }, []);

  const youtubeThumbUri = useMemo(() => {
    const raw = draftYoutubeUrl.trim();
    if (!raw) return null;
    const vid = extractYoutubeVideoIdFromSongUrl(raw);
    return vid ? youtubeThumbnailUrlFromVideoId(vid) : null;
  }, [draftYoutubeUrl]);

  const openYouTube = useCallback(async (raw: string) => {
    const url = buildYoutubeOpenUrl(raw);
    if (!url) return;
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) {
        logDebug(`[song] YouTube URL 열기 불가: ${url}`, "warn");
        return;
      }
      await Linking.openURL(url);
    } catch (e) {
      logDebug(
        `[song] YouTube 열기 실패: ${e instanceof Error ? e.message : String(e)}`,
        "warn",
      );
    }
  }, []);

  const handleSave = useCallback(async () => {
    const title = draftTitle.trim();
    if (!title || !songId) return;
    const transpose = Math.max(-12, Math.min(12, draftTranspose));
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
              memo: draftMemo.trim(),
              youtubeUrl: draftYoutubeUrl.trim(),
              genderKey: draftGender,
              readiness: draftReadiness,
              transposeSemitones: transpose,
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
    draftGender,
    draftKyNumber,
    draftMemo,
    draftReadiness,
    draftTjNumber,
    draftTitle,
    draftTranspose,
    draftYoutubeUrl,
    router,
    songId,
  ]);

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
    try {
      const list = await loadSongs();
      const next = list.map((s) =>
        s.id === songId ? { ...s, lastSungAt: day } : s,
      );
      await saveSongs(next);
      setLastSungAt(day);
      logDebug(`[song/${songId}] 오늘 부름 저장`, "info");
    } catch {
      logDebug("[song] 오늘 부름 저장 실패", "warn");
    }
  }, [songId]);

  if (!songId) {
    return (
      <ThemedView style={styles.centered}>
        <Stack.Screen options={{ title: "곡 정보" }} />
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
        <Stack.Screen options={{ title: "곡 정보" }} />
        <ActivityIndicator size="large" color={tint} />
      </ThemedView>
    );
  }

  if (missing) {
    return (
      <ThemedView style={[styles.centered, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ title: "곡 정보" }} />
        <ThemedText style={{ textAlign: "center", paddingHorizontal: 24 }}>
          곡을 찾을 수 없습니다. 목록에서 삭제되었을 수 있습니다.
        </ThemedText>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <ThemedText type="link">목록으로</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen
        options={{
          title: "곡 정보",
          headerShown: true,
          headerStyle: { backgroundColor: screenBg },
          headerTintColor: tint,
          headerTitleStyle: { color: textColor },
        }}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={72}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          {youtubeThumbUri ? (
            <View style={styles.ytThumbWrap}>
              <SongDetailYoutubeThumb
                key={youtubeThumbUri}
                uri={youtubeThumbUri}
                iconMuted={iconMuted}
              />
            </View>
          ) : null}
          <ThemedText style={styles.fieldLabel}>노래 제목</ThemedText>
          <TextInput
            value={draftTitle}
            onChangeText={setDraftTitle}
            placeholder="제목"
            placeholderTextColor={iconMuted}
            style={[styles.input, inputSurfaceStyle]}
          />

          <ThemedText style={styles.fieldLabel}>가수</ThemedText>
          <TextInput
            value={draftArtist}
            onChangeText={setDraftArtist}
            placeholder="가수명"
            placeholderTextColor={iconMuted}
            style={[styles.input, inputSurfaceStyle]}
          />

          <ThemedText style={styles.fieldLabel}>곡 번호</ThemedText>
          <View style={styles.numberRow}>
            <View style={styles.numberCol}>
              <ThemedText style={styles.numberBrand}>태진</ThemedText>
              <TextInput
                value={draftTjNumber}
                onChangeText={(text) =>
                  setDraftTjNumber(sanitizeKaraokeDigits(text))
                }
                placeholder="번호"
                placeholderTextColor={iconMuted}
                keyboardType="number-pad"
                maxLength={6}
                style={[styles.input, inputSurfaceStyle, styles.numberInput]}
              />
            </View>
            <View style={styles.numberCol}>
              <ThemedText style={styles.numberBrand}>금영</ThemedText>
              <TextInput
                value={draftKyNumber}
                onChangeText={(text) =>
                  setDraftKyNumber(sanitizeKaraokeDigits(text))
                }
                placeholder="번호"
                placeholderTextColor={iconMuted}
                keyboardType="number-pad"
                maxLength={6}
                style={[styles.input, inputSurfaceStyle, styles.numberInput]}
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
                    styles.readinessSegment,
                    {
                      borderColor: selected ? tint : iconMuted,
                      backgroundColor: selected ? `${tint}22` : "transparent",
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

          <ThemedText style={styles.fieldLabel}>음정 (키 업/다운)</ThemedText>
          <View style={styles.transposeRow}>
            <Pressable
              onPress={() => bumpTranspose(-1)}
              style={[styles.stepBtn, { borderColor: iconMuted }]}
            >
              <ThemedText type="defaultSemiBold">−</ThemedText>
            </Pressable>
            <View style={styles.transposeValue}>
              <ThemedText type="defaultSemiBold" style={{ textAlign: "center" }}>
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
            style={[styles.input, styles.memoInput, inputSurfaceStyle]}
          />

          <ThemedText style={styles.fieldLabel}>YouTube 링크</ThemedText>
          <TextInput
            value={draftYoutubeUrl}
            onChangeText={setDraftYoutubeUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={[styles.input, inputSurfaceStyle]}
          />
          {draftYoutubeUrl.trim() ? (
            <Pressable
              onPress={() => void openYouTube(draftYoutubeUrl)}
              style={({ pressed }) => [
                styles.openYtBtn,
                { borderColor: iconMuted, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons name="logo-youtube" size={22} color="#FF0000" />
              <ThemedText type="defaultSemiBold" style={{ marginLeft: 8 }}>
                링크로 열기
              </ThemedText>
            </Pressable>
          ) : null}

          <View style={styles.sungBlock}>
            <ThemedText style={[styles.sungHint, { color: iconMuted }]}>
              {lastSungAt.trim()
                ? formatLastSungLine(lastSungAt)
                : "마지막으로 부른 날: 없음"}
            </ThemedText>
            <Pressable
              onPress={() => void markSungToday()}
              style={({ pressed }) => [
                styles.sungBtn,
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
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            onPress={() => void handleDelete()}
            style={({ pressed }) => [
              styles.textBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <ThemedText style={{ color: "#c62828" }}>삭제</ThemedText>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.textBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <ThemedText style={{ color: iconMuted }}>취소</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => void handleSave()}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: tint, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <ThemedText style={styles.primaryBtnLabel}>저장</ThemedText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  backLink: { marginTop: 16, padding: 12 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
  },
  ytThumbWrap: {
    marginBottom: 18,
    borderRadius: 12,
    overflow: "hidden",
    alignSelf: "stretch",
    backgroundColor: "#0a0a0a",
  },
  ytThumbImage: {
    width: "100%",
    aspectRatio: 16 / 9,
  },
  ytThumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  fieldLabel: {
    marginBottom: 6,
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 14,
  },
  numberRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  numberCol: { flex: 1 },
  numberBrand: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  numberInput: { marginBottom: 0 },
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
  readinessSegment: {
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
  transposeValue: { flex: 1 },
  memoInput: {
    minHeight: 88,
    paddingTop: 12,
  },
  openYtBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
    marginTop: -6,
  },
  sungBlock: { marginBottom: 8 },
  sungHint: { fontSize: 12, marginBottom: 10 },
  sungBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    alignSelf: "stretch",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.35)",
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
