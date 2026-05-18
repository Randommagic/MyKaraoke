import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ListRenderItem,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  clearDebugLogs,
  getDebugLogs,
  type LogEntry,
  subscribeDebugLogs,
} from "@/lib/debug-log-buffer";
import { runStorageDiagnostics, readRawSongsStorageForDebug } from "@/lib/songs-storage";

function levelColor(
  level: LogEntry["level"],
  scheme: "light" | "dark",
): string {
  switch (level) {
    case "error":
      return scheme === "dark" ? "#ff8a80" : "#c62828";
    case "warn":
      return scheme === "dark" ? "#ffe082" : "#f57f17";
    case "info":
      return scheme === "dark" ? "#90caf9" : "#1565c0";
    case "debug":
      return scheme === "dark" ? "#b0bec5" : "#546e7a";
    default:
      return scheme === "dark" ? "#cfd8dc" : "#37474f";
  }
}

export default function SettingsLogScreen() {
  const navigation = useNavigation();
  const colorScheme = useColorScheme() ?? "light";
  const palette = Colors[colorScheme];
  const tint = useThemeColor({}, "tint");
  const text = useThemeColor({}, "text");
  const iconMuted = useThemeColor({}, "icon");

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
            { borderColor: palette.tint, opacity: pressed ? 0.7 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="비우기"
        >
          <ThemedText style={{ color: tint, fontWeight: "600" }}>비우기</ThemedText>
        </Pressable>
      ),
    });
  }, [navigation, onClear, palette.tint, tint]);

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
        <Text style={[styles.time, { color: iconMuted }]}>
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
            { color: levelColor(item.level, colorScheme) },
          ]}
        >
          {item.level.toUpperCase()}
        </Text>
        <Text style={[styles.message, { color: text }]} selectable>
          {item.message}
        </Text>
      </View>
    ),
    [colorScheme, iconMuted, text],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.headerBlock}>
        <ThemedText style={[styles.hint, { color: iconMuted }]}>
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
              {
                borderColor: palette.tint,
                opacity: diagRunning ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {diagRunning ? (
              <ActivityIndicator color={tint} />
            ) : (
              <ThemedText style={{ color: tint, fontWeight: "700" }}>
                저장소 점검
              </ThemedText>
            )}
          </Pressable>
          <Pressable
            onPress={onLoadRawFile}
            disabled={rawLoading}
            style={({ pressed }) => [
              styles.diagBtn,
              styles.diagBtnSecond,
              {
                borderColor: palette.tint,
                opacity: rawLoading ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {rawLoading ? (
              <ActivityIndicator color={tint} />
            ) : (
              <ThemedText style={{ color: tint, fontWeight: "700" }}>
                곡 파일 내용
              </ThemedText>
            )}
          </Pressable>
        </View>

        {diagLines && diagLines.length > 0 ? (
          <View
            style={[
              styles.diagResult,
              { borderColor: iconMuted, backgroundColor: `${iconMuted}18` },
            ]}
          >
            <ThemedText type="defaultSemiBold" style={{ marginBottom: 6 }}>
              점검 결과
            </ThemedText>
            {diagLines.map((l, i) => (
              <Text
                key={`${i}-${l.slice(0, 40)}`}
                style={[styles.diagLine, { color: text }]}
                selectable
              >
                {l}
              </Text>
            ))}
          </View>
        ) : null}

        {rawPathLabel != null && rawFormatted != null ? (
          <View
            style={[
              styles.rawFileBox,
              { borderColor: iconMuted, backgroundColor: `${iconMuted}10` },
            ]}
          >
            <ThemedText type="defaultSemiBold" style={{ marginBottom: 4 }}>
              저장된 곡 JSON
            </ThemedText>
            <Text
              style={[styles.rawPath, { color: iconMuted }]}
              selectable
              numberOfLines={3}
            >
              {rawPathLabel}
            </Text>
            <ScrollView
              style={styles.rawScroll}
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              <Text style={[styles.rawContent, { color: text }]} selectable>
                {rawFormatted}
              </Text>
            </ScrollView>
          </View>
        ) : null}
      </View>
    ),
    [
      diagLines,
      diagRunning,
      iconMuted,
      onLoadRawFile,
      onRunDiag,
      palette.tint,
      rawFormatted,
      rawLoading,
      rawPathLabel,
      text,
      tint,
    ],
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
          <ThemedText style={{ color: iconMuted, marginTop: 8, textAlign: "center" }}>
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  diagBtnSecond: {
    minWidth: 130,
  },
  diagResult: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  diagLine: {
    fontSize: 12,
    fontFamily: "monospace",
    marginBottom: 4,
  },
  rawFileBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  rawPath: {
    fontSize: 11,
    fontFamily: "monospace",
    marginBottom: 8,
  },
  rawScroll: {
    maxHeight: 280,
  },
  rawContent: {
    fontSize: 12,
    fontFamily: "monospace",
    lineHeight: 18,
  },
  listContent: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  row: {
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128,128,128,0.35)",
  },
  time: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    marginBottom: 2,
  },
  level: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    fontFamily: "monospace",
  },
});
