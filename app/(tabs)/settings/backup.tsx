import * as Clipboard from "expo-clipboard";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useConfirm } from "@/components/design/confirm-dialog-context";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { logDebug } from "@/lib/debug-log-buffer";
import {
  copySongsBackupToClipboard,
  decodeSongsFromBase64,
  songsBackupErrorMessage,
} from "@/lib/songs-backup";
import { loadSongs, saveSongs } from "@/lib/songs-storage";

export default function BackupScreen() {
  const confirm = useConfirm();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? "light";
  const tint = useThemeColor({}, "tint");
  const subColor = useThemeColor({ light: "#636366", dark: "#98989d" }, "icon");
  const borderColor = useThemeColor(
    { light: "#e5e5ea", dark: "#3a3a3c" },
    "icon",
  );

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const toastOpacity = useRef(new Animated.Value(0)).current;

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

  const onImport = useCallback(() => {
    if (importing || exporting) return;

    void (async () => {
      let importedCount: number;
      try {
        const encoded = await Clipboard.getStringAsync();
        const songs = decodeSongsFromBase64(encoded);
        importedCount = songs.length;
        const previous = await loadSongs();

        const message =
          previous.length > 0
            ? `현재 ${previous.length}곡이 있습니다. 클립보드의 ${importedCount}곡으로 목록을 교체할까요? 이 작업은 되돌릴 수 없습니다.`
            : `클립보드에서 ${importedCount}곡을 불러올까요?`;

        confirm({
          title: "불러오기",
          message,
          confirmLabel: "불러오기",
          onConfirm: () => {
            void (async () => {
              setImporting(true);
              try {
                await saveSongs(songs);
                logDebug(
                  `[backup]불러오기: ${songs.length}곡 (이전 ${previous.length}곡 교체)`,
                  "info",
                );
                showToast(`${songs.length}곡을 불러왔어요`);
              } catch (e) {
                logDebug(
                  `[backup]불러오기 저장 실패: ${e instanceof Error ? e.message : String(e)}`,
                  "error",
                );
                showToast("저장에 실패했어요");
              } finally {
                setImporting(false);
              }
            })();
          },
        });
      } catch (e) {
        logDebug(
          `[backup]불러오기 실패: ${e instanceof Error ? e.message : String(e)}`,
          "error",
        );
        showToast(songsBackupErrorMessage(e));
      }
    })();
  }, [confirm, exporting, importing, showToast]);

  const onExport = useCallback(async () => {
    if (exporting || importing) return;
    setExporting(true);
    try {
      const { songCount } = await copySongsBackupToClipboard();
      if (songCount === 0) {
        showToast("복사할 곡이 없어요");
        return;
      }
      showToast(`${songCount}곡을 클립보드에 복사했어요`);
    } catch (e) {
      logDebug(
        `[backup]보내기 실패: ${e instanceof Error ? e.message : String(e)}`,
        "error",
      );
      showToast("복사에 실패했어요");
    } finally {
      setExporting(false);
    }
  }, [exporting, importing, showToast]);

  const busy = exporting || importing;

  return (
    <ThemedView style={[styles.root, { paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.content}>
        <ThemedText style={[styles.description, { color: subColor }]}>
          곡 목록을 Base64 문자열로 클립보드에 복사하거나, 복사해 둔 문자열을
          붙여넣은 뒤 불러올 수 있습니다.
        </ThemedText>

        <ThemedText style={[styles.sectionLabel, { color: subColor }]}>
          보내기
        </ThemedText>
        <Pressable
          onPress={() => void onExport()}
          disabled={busy}
          style={({ pressed }) => [
            styles.actionBtn,
            {
              borderColor: tint,
              backgroundColor: `${tint}14`,
              opacity: exporting ? 0.55 : pressed ? 0.85 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="보내기"
        >
          {exporting ? (
            <ActivityIndicator color={tint} />
          ) : (
            <ThemedText style={[styles.actionBtnText, { color: tint }]}>
              보내기
            </ThemedText>
          )}
        </Pressable>

        <ThemedText style={[styles.sectionLabel, { color: subColor }]}>
          불러오기
        </ThemedText>
        <Pressable
          onPress={onImport}
          disabled={busy}
          style={({ pressed }) => [
            styles.actionBtn,
            {
              borderColor: tint,
              backgroundColor: `${tint}14`,
              opacity: importing ? 0.55 : pressed ? 0.85 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="불러오기"
        >
          {importing ? (
            <ActivityIndicator color={tint} />
          ) : (
            <ThemedText style={[styles.actionBtnText, { color: tint }]}>
              불러오기
            </ThemedText>
          )}
        </Pressable>

        <View style={[styles.noteBox, { borderColor }]}>
          <ThemedText style={[styles.note, { color: subColor }]}>
            불러오기는 클립보드의 Base64 문자열을 읽습니다. 다른 기기에서
            보내기로 복사한 뒤, 이 기기 클립보드에 붙여넣고 불러오기를
            누르세요. 기존 곡 목록은 교체됩니다.
          </ThemedText>
        </View>
      </View>

      {toastVisible ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            {
              opacity: toastOpacity,
              bottom: Math.max(insets.bottom, 12) + 16,
              backgroundColor: colorScheme === "dark" ? "#3a3a3c" : "#323232",
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
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 6,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 4,
  },
  actionBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  actionBtnText: {
    fontWeight: "700",
    fontSize: 16,
  },
  noteBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
  },
  note: {
    fontSize: 13,
    lineHeight: 19,
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
  },
  toastText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
