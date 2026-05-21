import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ListRenderItem,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

import { DesignColors } from "@/components/design/colors";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  clearDebugLogs,
  getDebugLogs,
  type LogEntry,
  subscribeDebugLogs,
} from "@/lib/debug-log-buffer";
import { runStorageDiagnostics, readRawSongsStorageForDebug } from "@/lib/songs-storage";

function levelColor(level: LogEntry["level"]): string {
  switch (level) {
    case "error":
      return DesignColors.logError;
    case "warn":
      return DesignColors.logWarn;
    case "info":
      return DesignColors.logInfo;
    case "debug":
      return DesignColors.logDebug;
    default:
      return DesignColors.logDefault;
  }
}

export default function SettingsLogScreen() {
  const navigation = useNavigation();

  const [logs, setLogs] = useState<LogEntry[]>(() => getDebugLogs());
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagLines, setDiagLines] = useState<string[] | null>(null);
  const [rawLoading, setRawLoading] = useState(false);
  const [rawPathLabel, setRawPathLabel] = useState<string | null>(null);
  const [rawFormatted, setRawFormatted] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setLogs(getDebugLogs());
    sync();
    return subscribeDebugLogs(sync);
  }, []);

  const onClear = useCallback(() => {
    clearDebugLogs();
    setDiagLines(null);
    setRawPathLabel(null);
    setRawFormatted(null);
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={onClear}
          hitSlop={8}
          style={({ pressed }) => [
            styles.clearBtn,
            { borderColor: DesignColors.accent, opacity: pressed ? 0.7 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="비우기"
        >
          <ThemedText
            style={{ color: DesignColors.accent, fontWeight: "600" }}
          >
            비우기
          </ThemedText>
        </Pressable>
      ),
    });
  }, [navigation, onClear]);

  const onLoadRawFile = useCallback(async () => {
    setRawLoading(true);
    try {
      const r = await readRawSongsStorageForDebug();
      setRawPathLabel(r.pathLabel);
      setRawFormatted(r.formatted);
    } finally {
      setRawLoading(false);
    }
  }, []);

  const onRunDiag = useCallback(async () => {
    setDiagRunning(true);
    setDiagLines(null);
    try {
      const lines = await runStorageDiagnostics();
      setDiagLines(lines);
    } finally {
      setDiagRunning(false);
    }
  }, []);

  const renderItem: ListRenderItem<LogEntry> = useCallback(
    ({ item }) => (
      <View style={styles.row}>
        <Text style={styles.time}>
          {new Date(item.t).toLocaleTimeString(undefined, {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </Text>
        <Text
          style={[
            styles.level,
            { color: levelColor(item.level) },
          ]}
        >
          {item.level.toUpperCase()}
        </Text>
        <Text style={styles.message} selectable>
          {item.message}
        </Text>
      </View>
    ),
    [],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.headerBlock}>
        <ThemedText style={styles.hint}>
          아래는 앱이 직접 남기는 로그와,{" "}
          <ThemedText type="defaultSemiBold">console.*</ThemedText> 후킹 결과입니다.
          Metro 터미널·OS 네이티브 로그는 기본적으로 여기에 안 나옵니다.
        </ThemedText>

        <View style={styles.diagRow}>
          <Pressable
            onPress={onRunDiag}
            disabled={diagRunning}
            style={({ pressed }) => [
              styles.diagBtn,
              { opacity: diagRunning ? 0.5 : pressed ? 0.85 : 1 },
            ]}
          >
            {diagRunning ? (
              <ActivityIndicator color={DesignColors.accent} />
            ) : (
              <ThemedText style={styles.diagBtnLabel}>저장소 점검</ThemedText>
            )}
          </Pressable>
          <Pressable
            onPress={onLoadRawFile}
            disabled={rawLoading}
            style={({ pressed }) => [
              styles.diagBtn,
              styles.diagBtnSecond,
              { opacity: rawLoading ? 0.5 : pressed ? 0.85 : 1 },
            ]}
          >
            {rawLoading ? (
              <ActivityIndicator color={DesignColors.accent} />
            ) : (
              <ThemedText style={styles.diagBtnLabel}>곡 파일 내용</ThemedText>
            )}
          </Pressable>
        </View>

        {diagLines && diagLines.length > 0 ? (
          <View style={styles.diagResult}>
            <ThemedText type="defaultSemiBold" style={{ marginBottom: 6 }}>
              점검 결과
            </ThemedText>
            {diagLines.map((l, i) => (
              <Text
                key={`${i}-${l.slice(0, 40)}`}
                style={styles.diagLine}
                selectable
              >
                {l}
              </Text>
            ))}
          </View>
        ) : null}

        {rawPathLabel != null && rawFormatted != null ? (
          <View style={styles.rawFileBox}>
            <ThemedText type="defaultSemiBold" style={{ marginBottom: 4 }}>
              저장된 곡 JSON
            </ThemedText>
            <Text style={styles.rawPath} selectable numberOfLines={3}>
              {rawPathLabel}
            </Text>
            <View style={styles.rawScroll}>
              <Text style={styles.rawContent} selectable>
                {rawFormatted}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    ),
    [diagLines, diagRunning, onLoadRawFile, onRunDiag, rawFormatted, rawLoading, rawPathLabel],
  );

  return (
    <ThemedView style={styles.screen}>
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <ThemedText style={styles.emptyList}>
            아직 로그가 없습니다. 홈에서 곡 저장을 시도하거나「저장소 점검」을 눌러
            보세요.
          </ThemedText>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 12,
  },
  headerBlock: {
    marginBottom: 12,
  },
  clearBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 4,
  },
  hint: {
    fontSize: 12,
    marginBottom: 10,
    lineHeight: 18,
    color: DesignColors.textMuted,
  },
  emptyList: {
    color: DesignColors.textMuted,
    marginTop: 8,
    textAlign: "center",
  },
  diagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  diagBtn: {
    borderWidth: 1,
    borderRadius: 8,
    borderColor: DesignColors.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  diagBtnLabel: {
    color: DesignColors.accent,
    fontWeight: "700",
  },
  diagBtnSecond: {
    minWidth: 130,
  },
  diagResult: {
    borderWidth: 1,
    borderRadius: 10,
    borderColor: DesignColors.bgBorder,
    backgroundColor: `${DesignColors.textSecondary}18`,
    padding: 10,
    marginBottom: 12,
  },
  diagLine: {
    fontSize: 12,
    fontFamily: "monospace",
    marginBottom: 4,
    color: DesignColors.textPrimary,
  },
  rawFileBox: {
    borderWidth: 1,
    borderRadius: 10,
    borderColor: DesignColors.bgBorder,
    backgroundColor: `${DesignColors.textSecondary}10`,
    padding: 10,
    marginBottom: 12,
  },
  rawPath: {
    fontSize: 11,
    fontFamily: "monospace",
    marginBottom: 8,
    color: DesignColors.textMuted,
  },
  rawScroll: {
    maxHeight: 280,
  },
  rawContent: {
    fontSize: 12,
    fontFamily: "monospace",
    lineHeight: 18,
    color: DesignColors.textPrimary,
  },
  listContent: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  row: {
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DesignColors.listDivider,
  },
  time: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    marginBottom: 2,
    color: DesignColors.textMuted,
  },
  level: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    fontFamily: "monospace",
    color: DesignColors.textPrimary,
  },
});
