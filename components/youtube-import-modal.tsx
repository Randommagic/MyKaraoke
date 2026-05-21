import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { DesignColors } from "@/components/design/colors";
import { KeyboardAwareField } from "@/components/design/keyboard-aware-scroll";
import { ThemedText } from "@/components/themed-text";
import { createSongFromYoutubeImport, type Song } from "@/lib/songs-storage";
import {
  collectYoutubeVideoIdsFromSongs,
  loadYoutubeImportItems,
  sortYoutubeImportItemsByExisting,
  youtubeThumbnailUrlFromVideoId,
  type YoutubeImportItem,
} from "@/lib/youtube-import";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** 선택한 곡들을 목록 맨 앞에 합친 뒤 저장 */
  onAdd: (songs: Song[]) => void | Promise<void>;
  /** 중복 판별용 현재 내 곡 목록 */
  existingSongs: Song[];
  /** YouTube 앱 공유 등으로 미리 채울 URL */
  initialUrl?: string;
};

export function YoutubeImportModal({
  visible,
  onClose,
  onAdd,
  existingSongs,
  initialUrl,
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
    setUrl(initialUrl?.trim() ?? "");
    setLoading(false);
    setError(null);
    setItems([]);
    setSelected(new Set());
  }, [initialUrl, visible]);

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

  const onPasteFromClipboard = useCallback(async () => {
    try {
      const hasText = await Clipboard.hasStringAsync();
      if (!hasText) return;
      const text = (await Clipboard.getStringAsync()).trim();
      if (!text) return;
      setUrl(text);
      setError(null);
    } catch {
      // 클립보드 접근 실패 시 무시
    }
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: YoutubeImportItem }) => {
      const alreadyAdded = existingVideoIds.has(item.videoId);
      const on = !alreadyAdded && selected.has(item.videoId);
      const thumbUri = youtubeThumbnailUrlFromVideoId(item.videoId);
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
          <Image
            source={{ uri: thumbUri }}
            style={[styles.thumb, alreadyAdded ? styles.thumbMuted : null]}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
          <View style={styles.rowText}>
            <ThemedText
              type="defaultSemiBold"
              numberOfLines={2}
              style={
                alreadyAdded ? styles.rowTitleMuted : styles.rowTitle
              }
            >
              {item.title}
            </ThemedText>
            {alreadyAdded ? (
              <ThemedText style={styles.addedBadge}>이미 추가됨</ThemedText>
            ) : null}
          </View>
        </Pressable>
      );
    },
    [existingVideoIds, selected, toggle],
  );

  const listHeader = useMemo(
    () => (
      <>
        <ThemedText type="subtitle" style={styles.modalTitle}>
          YouTube에서 가져오기
        </ThemedText>
        <ThemedText style={styles.hint}>
          영상 또는 재생목록 URL을 넣고 불러오기를 누르세요.
        </ThemedText>

        <View style={styles.urlInputRow}>
          <KeyboardAwareField style={styles.urlInputFlex}>
            <TextInput
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="Youtube 링크를 입력하세요"
              placeholderTextColor={DesignColors.textMuted}
              style={[styles.urlInput, styles.urlInputField]}
            />
          </KeyboardAwareField>
          <Pressable
            onPress={() => void onPasteFromClipboard()}
            style={({ pressed }) => [
              styles.pasteBtn,
              { opacity: pressed ? 0.75 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="클립보드에서 붙여넣기"
          >
            <ThemedText style={styles.pasteBtnLabel}>붙여넣기</ThemedText>
          </Pressable>
        </View>

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
          <View style={styles.selectRow}>
            <Pressable onPress={selectAll} style={styles.selectLink}>
              <ThemedText style={styles.selectLinkLabel}>전체 선택</ThemedText>
            </Pressable>
            <ThemedText style={styles.selectDivider}> | </ThemedText>
            <Pressable onPress={selectNone} style={styles.selectLink}>
              <ThemedText style={styles.selectLinkLabel}>전체 해제</ThemedText>
            </Pressable>
          </View>
        ) : null}
      </>
    ),
    [
      error,
      items.length,
      loading,
      onFetch,
      onPasteFromClipboard,
      selectAll,
      selectNone,
      url,
    ],
  );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalCard}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalBody}
          >
            <FlatList
              data={items}
              keyExtractor={(it) => it.videoId}
              renderItem={renderItem}
              ListHeaderComponent={listHeader}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              automaticallyAdjustKeyboardInsets
              showsVerticalScrollIndicator
              style={styles.list}
              contentContainerStyle={styles.listContent}
            />
          </KeyboardAvoidingView>

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
      </View>
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
  modalBody: {
    flexShrink: 1,
    minHeight: 0,
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
  urlInputRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    marginBottom: 10,
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
  },
  urlInputFlex: {
    flex: 1,
    minWidth: 0,
  },
  urlInputField: {
    flex: 1,
    minWidth: 0,
  },
  pasteBtn: {
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: DesignColors.accent,
    backgroundColor: `${DesignColors.accent}14`,
  },
  pasteBtnLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: DesignColors.accent,
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
    maxHeight: 420,
  },
  listContent: {
    paddingBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
    borderColor: DesignColors.bgBorder,
    gap: 10,
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
    flexShrink: 0,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: DesignColors.bgBorder,
    flexShrink: 0,
  },
  thumbMuted: {
    opacity: 0.55,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  addedBadge: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
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
