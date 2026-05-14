import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { createSongFromYoutubeImport, type Song } from "@/lib/songs-storage";
import {
  loadYoutubeImportItems,
  type YoutubeImportItem,
} from "@/lib/youtube-import";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** 선택한 곡들을 목록 맨 앞에 합친 뒤 저장 */
  onAdd: (songs: Song[]) => void | Promise<void>;
  tint: string;
  iconMuted: string;
  textColor: string;
  screenBg: string;
  colorScheme: "light" | "dark";
};

export function YoutubeImportModal({
  visible,
  onClose,
  onAdd,
  tint,
  iconMuted,
  textColor,
  screenBg,
  colorScheme,
}: Props) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<YoutubeImportItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;
    setUrl("");
    setLoading(false);
    setError(null);
    setItems([]);
    setSelected(new Set());
  }, [visible]);

  const inputStyle = useMemo(
    () => ({
      borderColor: iconMuted,
      color: textColor,
      backgroundColor: colorScheme === "dark" ? "#1c1c1e" : "#f2f2f7",
    }),
    [colorScheme, iconMuted, textColor],
  );

  const onFetch = useCallback(async () => {
    setError(null);
    setItems([]);
    setSelected(new Set());
    const trimmed = url.trim();
    if (!trimmed) {
      setError("YouTube 링크를 입력해 주세요.");
      return;
    }
    setLoading(true);
    try {
      const list = await loadYoutubeImportItems(trimmed);
      setItems(list);
      setSelected(new Set(list.map((x) => x.videoId)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [url]);

  const toggle = useCallback((videoId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(items.map((x) => x.videoId)));
  }, [items]);

  const selectNone = useCallback(() => {
    setSelected(new Set());
  }, []);

  const selectedCount = selected.size;

  const onConfirm = useCallback(async () => {
    if (selectedCount === 0) return;
    const picked = items.filter((x) => selected.has(x.videoId));
    const songs = picked.map((row) =>
      createSongFromYoutubeImport(row.title, row.watchUrl),
    );
    await onAdd(songs);
  }, [items, onAdd, selected, selectedCount]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView style={styles.modalRoot} behavior="padding">
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={[styles.modalCard, { backgroundColor: screenBg }]}>
          <ThemedText type="subtitle" style={styles.modalTitle}>
            YouTube에서 가져오기
          </ThemedText>
          <ThemedText style={[styles.hint, { color: iconMuted }]}>
            영상 또는 재생목록 URL을 넣고 불러오기를 누르세요.
          </ThemedText>

          <TextInput
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="https://www.youtube.com/watch?v=… 또는 …&list=…"
            placeholderTextColor={iconMuted}
            style={[styles.urlInput, inputStyle]}
          />

          <Pressable
            onPress={() => void onFetch()}
            disabled={loading}
            style={({ pressed }) => [
              styles.fetchBtn,
              {
                backgroundColor: tint,
                opacity: loading ? 0.6 : pressed ? 0.88 : 1,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.fetchBtnLabel}>불러오기</ThemedText>
            )}
          </Pressable>

          {error ? (
            <ThemedText style={[styles.errorText, { color: "#c62828" }]}>
              {error}
            </ThemedText>
          ) : null}

          {items.length > 0 ? (
            <>
              <View style={styles.selectRow}>
                <Pressable onPress={selectAll} style={styles.selectLink}>
                  <ThemedText style={{ color: tint, fontWeight: "600" }}>
                    전체 선택
                  </ThemedText>
                </Pressable>
                <ThemedText style={{ color: iconMuted }}> | </ThemedText>
                <Pressable onPress={selectNone} style={styles.selectLink}>
                  <ThemedText style={{ color: tint, fontWeight: "600" }}>
                    전체 해제
                  </ThemedText>
                </Pressable>
              </View>
              <FlatList
                data={items}
                keyExtractor={(it) => it.videoId}
                style={styles.list}
                nestedScrollEnabled
                renderItem={({ item }) => {
                  const on = selected.has(item.videoId);
                  return (
                    <Pressable
                      onPress={() => toggle(item.videoId)}
                      style={({ pressed }) => [
                        styles.row,
                        {
                          borderColor: iconMuted,
                          backgroundColor: on
                            ? `${tint}14`
                            : colorScheme === "dark"
                              ? "#252528"
                              : "#fafafa",
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Ionicons
                        name={on ? "checkbox" : "square-outline"}
                        size={22}
                        color={on ? tint : iconMuted}
                        style={styles.checkIcon}
                      />
                      <View style={styles.rowText}>
                        <ThemedText
                          type="defaultSemiBold"
                          numberOfLines={2}
                          style={{ color: textColor }}
                        >
                          {item.title}
                        </ThemedText>
                        <ThemedText
                          style={[styles.urlLine, { color: iconMuted }]}
                          numberOfLines={1}
                        >
                          {item.watchUrl}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                }}
              />
            </>
          ) : null}

          <View style={styles.footer}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.textBtn,
                { opacity: pressed ? 0.65 : 1 },
              ]}
            >
              <ThemedText style={{ color: iconMuted }}>닫기</ThemedText>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={() => void onConfirm()}
              disabled={selectedCount === 0}
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  backgroundColor: tint,
                  opacity: selectedCount === 0 ? 0.45 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <ThemedText style={styles.primaryBtnLabel}>
                선택한 {selectedCount}곡 추가
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalCard: {
    borderRadius: 16,
    padding: 18,
    maxHeight: "88%",
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  modalTitle: {
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  urlInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 10,
  },
  fetchBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  fetchBtnLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  errorText: {
    fontSize: 13,
    marginBottom: 8,
  },
  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    flexWrap: "wrap",
  },
  selectLink: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  list: {
    maxHeight: 320,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  checkIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  urlLine: {
    fontSize: 11,
    marginTop: 4,
    fontFamily: "monospace",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  textBtn: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  primaryBtn: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  primaryBtnLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
