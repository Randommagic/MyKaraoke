import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { formatAppVersionLabel, getAppInfo } from "@/lib/app-info";
import { logDebug } from "@/lib/debug-log-buffer";
import { resetAllSongs } from "@/lib/songs-storage";

type SettingsMenuItem = {
  key: string;
  label: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: "/settings/backup" | "/settings/log";
};

const MENU_ITEMS: SettingsMenuItem[] = [
  {
    key: "backup",
    label: "백업 및 불러오기",
    subtitle: "클립보드로 보내기·가져오기",
    icon: "cloud-outline",
    href: "/settings/backup",
  },
  {
    key: "log",
    label: "로그",
    subtitle: "앱 동작 기록·저장소 점검",
    icon: "document-text-outline",
    href: "/settings/log",
  },
];

const DANGER_COLOR = { light: "#c62828", dark: "#ff8a80" } as const;

function confirmResetAllSongsAlert(onConfirm: () => void) {
  Alert.alert(
    "데이터 초기화",
    "전체 곡 데이터를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
    [
      { text: "취소", style: "cancel" },
      { text: "초기화", style: "destructive", onPress: onConfirm },
    ],
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? "light";
  const appInfo = useMemo(() => getAppInfo(), []);
  const versionLabel = useMemo(
    () => formatAppVersionLabel(appInfo),
    [appInfo],
  );
  const borderColor = useThemeColor(
    { light: "#e5e5ea", dark: "#3a3a3c" },
    "icon",
  );
  const iconMuted = useThemeColor({}, "icon");
  const subColor = useThemeColor({ light: "#636366", dark: "#98989d" }, "icon");
  const dangerColor = DANGER_COLOR[colorScheme];

  const onResetData = useCallback(() => {
    confirmResetAllSongsAlert(() => {
      void (async () => {
        try {
          await resetAllSongs();
          Alert.alert("초기화 완료", "전체 곡 데이터가 삭제되었습니다.");
        } catch (e) {
          logDebug(
            `[settings]데이터 초기화 실패: ${e instanceof Error ? e.message : String(e)}`,
            "error",
          );
          Alert.alert(
            "초기화 실패",
            "데이터를 지우지 못했습니다. 잠시 후 다시 시도해 주세요.",
          );
        }
      })();
    });
  }, []);

  return (
    <ThemedView style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <ThemedText type="title" style={styles.title}>
        설정
      </ThemedText>

      <View style={[styles.menu, { borderColor }]}>
        {MENU_ITEMS.map((item, index) => (
          <Pressable
            key={item.key}
            onPress={() => router.push(item.href)}
            style={({ pressed }) => [
              styles.row,
              index < MENU_ITEMS.length - 1
                ? {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: borderColor,
                  }
                : null,
              { opacity: pressed ? 0.75 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            <View style={[styles.iconWrap, { backgroundColor: `${iconMuted}18` }]}>
              <Ionicons name={item.icon} size={22} color={iconMuted} />
            </View>
            <View style={styles.rowText}>
              <ThemedText type="defaultSemiBold">{item.label}</ThemedText>
              {item.subtitle ? (
                <ThemedText style={[styles.subtitle, { color: subColor }]}>
                  {item.subtitle}
                </ThemedText>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={20} color={iconMuted} />
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={onResetData}
        style={({ pressed }) => [
          styles.resetCard,
          { borderColor, opacity: pressed ? 0.75 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="데이터 초기화"
      >
        <View
          style={[styles.iconWrap, { backgroundColor: `${dangerColor}18` }]}
        >
          <Ionicons name="trash-outline" size={22} color={dangerColor} />
        </View>
        <ThemedText
          type="defaultSemiBold"
          style={[styles.resetLabel, { color: dangerColor }]}
        >
          데이터 초기화
        </ThemedText>
      </Pressable>

      <View style={[styles.infoSection, { borderColor }]}>
        <ThemedText style={[styles.infoHeading, { color: subColor }]}>
          앱 정보
        </ThemedText>
        <ThemedText type="defaultSemiBold" style={styles.infoName}>
          {appInfo.name}
        </ThemedText>
        <View style={styles.infoRow}>
          <ThemedText style={[styles.infoLabel, { color: subColor }]}>
            버전
          </ThemedText>
          <ThemedText style={styles.infoValue}>{versionLabel}</ThemedText>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    marginBottom: 16,
  },
  menu: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  subtitle: {
    fontSize: 13,
  },
  resetCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    marginTop: 12,
  },
  resetLabel: {
    fontSize: 16,
  },
  infoSection: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
    marginTop: 12,
  },
  infoHeading: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  infoName: {
    fontSize: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 4,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontVariant: ["tabular-nums"],
  },
});
