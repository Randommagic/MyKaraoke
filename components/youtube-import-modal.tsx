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

import { DesignColors } from "@/components/design/colors";
import { ThemedText } from "@/components/themed-text";
import { createSongFromYoutubeImport, type Song } from "@/lib/songs-storage";
import {
  collectYoutubeVideoIdsFromSongs,
  loadYoutubeImportItems,
  sortYoutubeImportItemsByExisting,
  type YoutubeImportItem,
} from "@/lib/youtube-import";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** 선택한 곡들을 목록 맨 앞에 합친 뒤 저장 */
  onAdd: (songs: Song[]) => void | Promise<void>;
  /** 중복 판별용 현재 내 곡 목록 */
  existingSongs: Song[];
};

export function YoutubeImportModal({
  visible,
  onClose,
  onAdd,
  existingSongs,
}: Props) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<YoutubeImportItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const existingVideoIds = useMemo(
    () => collectYoutubeVideoIdsFromSongs(existingSongs),
    [existingSongs],
  );

  useEffect(() => {
    if (!visible) return;
    setUrl("");
    setLoading(false);
    setError(null);
    setItems([]);
    setSelected(new Set());
  }, [visible]);

  const selectableVideoIds = useCallback(
    (list: YoutubeImportItem[]) =>
      list
        .filter((x) => !existingVideoIds.has(x.videoId))
        .map((x) => x.videoId),
    [existingVideoIds],
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
      const fetched = await loadYoutubeImportItems(trimmed);
      const list = sortYoutubeImportItemsByExisting(fetched, existingVideoIds);
      setItems(list);
      setSelected(new Set(selectableVideoIds(list)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [existingVideoIds, selectableVideoIds, url]);

  const toggle = useCallback(
    (videoId: string) => {
      if (existingVideoIds.has(videoId)) return;
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(videoId)) next.delete(videoId);
        else next.add(videoId);
        return next;
      });
    },
    [existingVideoIds],
  );

  const selectAll = useCallback(() => {
    setSelected(new Set(selectableVideoIds(items)));
  }, [items, selectableVideoIds]);

  const selectNone = useCallback(() => {
    setSelected(new Set());
  }, []);

  const selectedCount = selected.size;

  const onConfirm = useCallback(async () => {
    if (selectedCount === 0) return;
    const picked = items.filter(
      (x) => selected.has(x.videoId) && !existingVideoIds.has(x.videoId),
    );
    const songs = picked.map((row) =>
      createSongFromYoutubeImport(row.title, row.watchUrl),
    );
    await onAdd(songs);
  }, [existingVideoIds, items, onAdd, selected, selectedCount]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView style={styles.modalRoot} behavior="padding">
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalCard}>
          <ThemedText type="subtitle" style={styles.modalTitle}>
            YouTube에서 가져오기
          </ThemedText>
          <ThemedText style={styles.hint}>
            영상 또는 재생목록 URL을 넣고 불러오기를 누르세요.
          </ThemedText>

          <TextInput
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="https://www.youtube.com/watch?v=… 또는 …&list=…"
            placeholderTextColor={DesignColors.textMuted}
            style={styles.urlInput}
          />

          <Pressable
            onPress={() => void onFetch()}
            disabled={loading}
            style={({ pressed }) => [
              styles.fetchBtn,
              { opacity: loading ? 0.6 : pressed ? 0.88 : 1 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={DesignColors.textOnAccent} />
            ) : (
              <ThemedText style={styles.fetchBtnLabel}>불러오기</ThemedText>
            )}
          </Pressable>

          {error ? (
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          ) : null}

          {items.length > 0 ? (
            <>
              <View style={styles.selectRow}>
                <Pressable onPress={selectAll} style={styles.selectLink}>
                  <ThemedText style={styles.selectLinkLabel}>전체 선택</ThemedText>
                </Pressable>
                <ThemedText style={styles.selectDivider}> | </ThemedText>
                <Pressable onPress={selectNone} style={styles.selectLink}>
                  <ThemedText style={styles.selectLinkLabel}>전체 해제</ThemedText>
                </Pressable>
              </View>
              <FlatList
                data={items}
                keyExtractor={(it) => it.videoId}
                style={styles.list}
                nestedScrollEnabled
                renderItem={({ item }) => {
                  const alreadyAdded = existingVideoIds.has(item.videoId);
                  const on = !alreadyAdded && selected.has(item.videoId);
                  return (
                    <Pressable
                      onPress={() => toggle(item.videoId)}
                      disabled={alreadyAdded}
                      style={({ pressed }) => [
                        styles.row,
                        alreadyAdded
                          ? styles.rowAdded
                          : on
                            ? styles.rowSelected
                            : styles.rowDefault,
                        { opacity: alreadyAdded ? 0.72 : pressed ? 0.85 : 1 },
                      ]}
                    >
                      <Ionicons
                        name={
                          alreadyAdded
                            ? "checkbox-outline"
                            : on
                              ? "checkbox"
                              : "square-outline"
                        }
                        size={22}
                        color={
                          alreadyAdded
                            ? DesignColors.textMuted
                            : on
                              ? DesignColors.accent
                              : DesignColors.textSecondary
                        }
                        style={styles.checkIcon}
                      />
                      <View style={styles.rowText}>
                        <ThemedText
                          type="defaultSemiBold"
                          numberOfLines={2}
                          style={
                            alreadyAdded
                              ? styles.rowTitleMuted
                              : styles.rowTitle
                          }
                        >
                          {item.title}
                        </ThemedText>
                        {alreadyAdded ? (
                          <ThemedText style={styles.addedBadge}>
                            이미 추가됨
                          </ThemedText>
                        ) : (
                          <ThemedText style={styles.urlLine} numberOfLines={1}>
                            {item.watchUrl}
                          </ThemedText>
                        )}
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
              <ThemedText style={styles.closeLabel}>닫기</ThemedText>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={() => void onConfirm()}
              disabled={selectedCount === 0}
              style={({ pressed }) => [
                styles.primaryBtn,
                {
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
    backgroundColor: DesignColors.scrim,
  },
  modalCard: {
    borderRadius: 16,
    padding: 18,
    maxHeight: "88%",
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    backgroundColor: DesignColors.bgCard,
  },
  modalTitle: {
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
    color: DesignColors.textMuted,
  },
  urlInput: {
    borderWidth: 1,
    borderRadius: 10,
    borderColor: DesignColors.bgBorder,
    backgroundColor: DesignColors.inputSurface,
    color: DesignColors.textPrimary,
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
    backgroundColor: DesignColors.accent,
  },
  fetchBtnLabel: {
    color: DesignColors.textOnAccent,
    fontWeight: "700",
    fontSize: 16,
  },
  errorText: {
    fontSize: 13,
    marginBottom: 8,
    color: DesignColors.danger,
  },
  selectLinkLabel: {
    color: DesignColors.accent,
    fontWeight: "600",
  },
  selectDivider: {
    color: DesignColors.textMuted,
  },
  closeLabel: {
    color: DesignColors.textMuted,
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
    borderColor: DesignColors.bgBorder,
  },
  rowDefault: {
    backgroundColor: DesignColors.bg,
  },
  rowSelected: {
    backgroundColor: `${DesignColors.accent}14`,
    borderColor: DesignColors.accent,
  },
  rowAdded: {
    backgroundColor: DesignColors.bgCard,
  },
  rowTitle: {
    color: DesignColors.textPrimary,
  },
  rowTitleMuted: {
    color: DesignColors.textMuted,
  },
  checkIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  addedBadge: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
    color: DesignColors.textMuted,
  },
  urlLine: {
    fontSize: 11,
    marginTop: 4,
    fontFamily: "monospace",
    color: DesignColors.textMuted,
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
    backgroundColor: DesignColors.accent,
  },
  primaryBtnLabel: {
    color: DesignColors.textOnAccent,
    fontWeight: "700",
    fontSize: 15,
  },
});
