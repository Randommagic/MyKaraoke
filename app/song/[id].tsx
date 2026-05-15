import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  PanResponder,
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
import { logDebug } from "@/lib/debug-log-buffer";
import {
  buildYoutubeOpenUrl,
  formatLastSungLine,
  formatTranspose,
  GENDER_OPTIONS,
  localYmd,
  READINESS_VISUAL,
  sanitizeKaraokeDigits,
} from "@/lib/song-form-helpers";
import {
  loadSongs,
  READINESS_SLIDER_ORDER,
  saveSongs,
  SONG_READINESS_OPTIONS,
  type Song,
  type SongGenderKey,
  type SongImportSource,
  type SongReadiness,
} from "@/lib/songs-storage";
import {
  extractYoutubeVideoIdFromSongUrl,
  normalizeYoutubeUrlForStorage,
  youtubeThumbnailUrlFromVideoId,
} from "@/lib/youtube-import";

const READINESS_THUMB_R = 13;

function ReadinessDiscreteSlider({
  value,
  onChange,
  tint,
  textColor,
  iconMuted,
  thumbSurface,
}: {
  value: SongReadiness;
  onChange: (v: SongReadiness) => void;
  tint: string;
  textColor: string;
  iconMuted: string;
  thumbSurface: string;
}) {
  const railW = useRef(0);
  const railH = useRef(0);
  const [layoutW, setLayoutW] = useState(0);

  const index = useMemo(() => {
    const i = READINESS_SLIDER_ORDER.indexOf(value);
    return i >= 0 ? i : 0;
  }, [value]);

  const xToIndex = (locX: number) => {
    const W = railW.current;
    if (W <= 0) return 0;
    const cell = W / 4;
    return Math.min(3, Math.max(0, Math.floor(locX / cell)));
  };

  const isInsideRail = (e: {
    nativeEvent: { locationX: number; locationY: number };
  }) => {
    const W = railW.current;
    const H = railH.current;
    if (W <= 0 || H <= 0) return false;
    const { locationX: x, locationY: y } = e.nativeEvent;
    return x >= 0 && x <= W && y >= 0 && y <= H;
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          if (!isInsideRail(e)) return;
          onChange(READINESS_SLIDER_ORDER[xToIndex(e.nativeEvent.locationX)]);
        },
        onPanResponderMove: (e) => {
          if (!isInsideRail(e)) return;
          onChange(READINESS_SLIDER_ORDER[xToIndex(e.nativeEvent.locationX)]);
        },
        onPanResponderRelease: (e) => {
          if (!isInsideRail(e)) return;
          onChange(READINESS_SLIDER_ORDER[xToIndex(e.nativeEvent.locationX)]);
        },
      }),
    [onChange],
  );

  const thumbLeft =
    layoutW > 0 ? (index + 0.5) * (layoutW / 4) - READINESS_THUMB_R : 0;

  return (
    <View style={styles.readinessRailWrap}>
      <View
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          railW.current = width;
          railH.current = height;
          setLayoutW(width);
        }}
        style={styles.readinessRailHit}
        {...pan.panHandlers}
        accessibilityRole="adjustable"
        accessibilityValue={{
          min: 0,
          max: 3,
          now: index,
          text: SONG_READINESS_OPTIONS.find((o) => o.value === value)?.label,
        }}
      >
        <View
          style={[styles.readinessRailLine, { backgroundColor: iconMuted }]}
        />
        <View style={styles.readinessTicksRow}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.readinessTickCol}>
              <View
                style={[
                  styles.readinessTick,
                  {
                    backgroundColor: i === index ? tint : iconMuted,
                    opacity: i === index ? 1 : 0.5,
                  },
                ]}
              />
            </View>
          ))}
        </View>
        <View
          pointerEvents="none"
          style={[
            styles.readinessThumb,
            {
              left: thumbLeft,
              width: READINESS_THUMB_R * 2,
              height: READINESS_THUMB_R * 2,
              borderRadius: READINESS_THUMB_R,
              borderColor: tint,
              backgroundColor: thumbSurface,
              marginTop: -READINESS_THUMB_R,
            },
          ]}
        />
      </View>
      <View style={styles.readinessLabelsRow}>
        {READINESS_SLIDER_ORDER.map((key) => {
          const label =
            SONG_READINESS_OPTIONS.find((o) => o.value === key)?.label ?? key;
          const selected = key === value;
          const rv = READINESS_VISUAL[key];
          return (
            <Pressable
              key={key}
              onPress={() => onChange(key)}
              style={({ pressed }) => [
                styles.readinessLabelCol,
                { opacity: pressed ? 0.75 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={label}
            >
              <Ionicons
                name={rv.icon}
                size={18}
                color={selected ? rv.color : iconMuted}
                style={{ alignSelf: "center", opacity: selected ? 1 : 0.65 }}
              />
              <ThemedText
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  textAlign: "center",
                  fontWeight: selected ? "700" : "500",
                  color: selected ? tint : textColor,
                  opacity: selected ? 1 : 0.72,
                }}
                numberOfLines={1}
              >
                {label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

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
  const songId =
    typeof params.id === "string" ? params.id : (params.id?.[0] ?? "");

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
  const [importSource, setImportSource] = useState<SongImportSource>("manual");

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
    setDraftYoutubeUrl(normalizeYoutubeUrlForStorage(s.youtubeUrl));
    setDraftGender(s.genderKey);
    setDraftReadiness(s.readiness);
    setDraftTranspose(s.transposeSemitones);
    setLastSungAt(s.lastSungAt);
    setImportSource(s.importSource);
  }, []);

  const youtubeLinkLocked = importSource === "youtube";

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
              youtubeUrl:
                s.importSource === "youtube"
                  ? s.youtubeUrl
                  : normalizeYoutubeUrlForStorage(draftYoutubeUrl),
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
          {draftYoutubeUrl.trim() && youtubeThumbUri ? (
            <Pressable
              key={youtubeThumbUri}
              onPress={() => void openYouTube(draftYoutubeUrl)}
              style={({ pressed }) => [
                styles.ytThumbWrap,
                pressed ? { opacity: 0.92 } : null,
              ]}
              accessibilityRole="link"
              accessibilityLabel="YouTube에서 열기"
            >
              <SongDetailYoutubeThumb
                uri={youtubeThumbUri}
                iconMuted={iconMuted}
              />
              <View style={styles.ytThumbOverlay} pointerEvents="none">
                <Ionicons
                  name="play-circle"
                  size={64}
                  color="rgba(255,255,255,0.94)"
                />
              </View>
            </Pressable>
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
          <ReadinessDiscreteSlider
            value={draftReadiness}
            onChange={setDraftReadiness}
            tint={tint}
            textColor={textColor}
            iconMuted={iconMuted}
            thumbSurface={colorScheme === "dark" ? "#1c1c1e" : "#fff"}
          />

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
            style={[styles.input, styles.memoInput, inputSurfaceStyle]}
          />

          <ThemedText style={styles.fieldLabel}>YouTube 링크</ThemedText>
          {youtubeLinkLocked ? (
            <ThemedText
              style={[styles.youtubeLockedHint, { color: iconMuted }]}
            >
              YouTube에서 가져온 곡은 링크를 수정할 수 없어요.
            </ThemedText>
          ) : null}
          <TextInput
            value={draftYoutubeUrl}
            onChangeText={setDraftYoutubeUrl}
            editable={!youtubeLinkLocked}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={[
              styles.input,
              inputSurfaceStyle,
              youtubeLinkLocked ? styles.inputLocked : null,
            ]}
          />
          {draftYoutubeUrl.trim() && !youtubeThumbUri ? (
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

        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <Pressable
            onPress={() =>
              Alert.alert("삭제하시겠습니까?", "", [
                { text: "취소", style: "cancel" },
                {
                  text: "삭제",
                  style: "destructive",
                  onPress: () => void handleDelete(),
                },
              ])
            }
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
    position: "relative",
  },
  ytThumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
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
  inputLocked: {
    opacity: 0.65,
  },
  youtubeLockedHint: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 6,
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
  readinessRailWrap: {
    marginBottom: 14,
  },
  readinessRailHit: {
    minHeight: 48,
    position: "relative",
    justifyContent: "center",
  },
  readinessRailLine: {
    position: "absolute",
    left: "10%",
    right: "10%",
    top: "50%",
    marginTop: -1,
    height: 2,
    borderRadius: 1,
  },
  readinessTicksRow: {
    flexDirection: "row",
    height: 48,
    alignItems: "center",
  },
  readinessTickCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  readinessTick: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  readinessThumb: {
    position: "absolute",
    top: "50%",
    borderWidth: 2,
  },
  readinessLabelsRow: {
    flexDirection: "row",
    marginTop: 6,
  },
  readinessLabelCol: {
    flex: 1,
    paddingHorizontal: 2,
    paddingVertical: 4,
    alignItems: "center",
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
