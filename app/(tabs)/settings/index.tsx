import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DesignColors } from "@/components/design/colors";
import { useConfirm } from "@/components/design/confirm-dialog-context";
import { ScreenTitle } from "@/components/design/ScreenTitle";
import { HelpSheet } from "@/components/onboarding/HelpSheet";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { formatAppVersionLabel, getAppInfo } from "@/lib/app-info";
import { logDebug } from "@/lib/debug-log-buffer";
import { resetAllSongs } from "@/lib/songs-storage";
import { UI_STRINGS } from "@/lib/ui-strings";

type SettingsMenuItem = {
  key: string;
  label: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  href?: "/settings/backup";
  onPress?: () => void;
};

const SECRET_LOG_TAP_COUNT = 7;
const SECRET_LOG_TAP_WINDOW_MS = 700;

export default function SettingsScreen() {
  const confirm = useConfirm();
  const router = useRouter();
  const [helpVisible, setHelpVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const appInfo = useMemo(() => getAppInfo(), []);
  const versionLabel = useMemo(() => formatAppVersionLabel(appInfo), [appInfo]);

  const menuItems = useMemo<SettingsMenuItem[]>(
    () => [
      {
        key: "onboarding",
        label: UI_STRINGS.onboarding.menuLabel,
        icon: "help-circle-outline",
        onPress: () => setHelpVisible(true),
      },
      {
        key: "backup",
        label: "백업 및 불러오기",
        subtitle: "클립보드로 보내기·가져오기",
        icon: "cloud-outline",
        href: "/settings/backup",
      },
    ],
    [],
  );

  const secretLogTapRef = useRef({ count: 0, lastAt: 0 });

  const onTitlePress = useCallback(() => {
    const now = Date.now();
    const state = secretLogTapRef.current;
    if (now - state.lastAt > SECRET_LOG_TAP_WINDOW_MS) {
      state.count = 0;
    }
    state.lastAt = now;
    state.count += 1;
    if (state.count >= SECRET_LOG_TAP_COUNT) {
      state.count = 0;
      router.push("/settings/dev");
    }
  }, [router]);

  const onResetData = useCallback(() => {
    confirm({
      title: "데이터 초기화",
      message:
        "전체 곡 데이터를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
      confirmLabel: "초기화",
      destructive: true,
      onConfirm: () => {
        void (async () => {
          try {
            await resetAllSongs();
            confirm({
              title: "초기화 완료",
              message: "전체 곡 데이터가 삭제되었습니다.",
              alert: true,
              onConfirm: () => {},
            });
          } catch (e) {
            logDebug(
              `[settings]데이터 초기화 실패: ${e instanceof Error ? e.message : String(e)}`,
              "error",
            );
            confirm({
              title: "초기화 실패",
              message:
                "데이터를 지우지 못했습니다. 잠시 후 다시 시도해 주세요.",
              alert: true,
              onConfirm: () => {},
            });
          }
        })();
      },
    });
  }, [confirm]);

  return (
    <ThemedView style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <Pressable
        onPress={onTitlePress}
        hitSlop={8}
        accessibilityRole="header"
        accessibilityLabel="설정"
      >
        <ScreenTitle style={styles.title}>설정</ScreenTitle>
      </Pressable>

      <View style={styles.menu}>
        {menuItems.map((item, index) => (
          <Pressable
            key={item.key}
            onPress={() => {
              if (item.onPress) {
                item.onPress();
                return;
              }
              if (item.href) router.push(item.href);
            }}
            style={({ pressed }) => [
              styles.row,
              index < menuItems.length - 1 ? styles.rowDivider : null,
              { opacity: pressed ? 0.75 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            <View style={styles.iconWrap}>
              <Ionicons
                name={item.icon}
                size={22}
                color={DesignColors.textSecondary}
              />
            </View>
            <View style={styles.rowText}>
              <ThemedText type="defaultSemiBold">{item.label}</ThemedText>
              {item.subtitle ? (
                <ThemedText style={styles.subtitle}>{item.subtitle}</ThemedText>
              ) : null}
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={DesignColors.textSecondary}
            />
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={onResetData}
        style={({ pressed }) => [
          styles.resetCard,
          { opacity: pressed ? 0.75 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="데이터 초기화"
      >
        <View style={styles.resetIconWrap}>
          <Ionicons
            name="trash-outline"
            size={22}
            color={DesignColors.danger}
          />
        </View>
        <ThemedText type="defaultSemiBold" style={styles.resetLabel}>
          데이터 초기화
        </ThemedText>
      </Pressable>

      <View style={styles.infoSection}>
        <ThemedText style={styles.infoHeading}>앱 정보</ThemedText>
        <View style={styles.infoRow}>
          <ThemedText style={styles.infoLabel}>버전</ThemedText>
          <ThemedText style={styles.infoValue}>{versionLabel}</ThemedText>
        </View>
      </View>

      <HelpSheet visible={helpVisible} onClose={() => setHelpVisible(false)} />
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
    borderColor: DesignColors.bgBorder,
    overflow: "hidden",
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DesignColors.bgBorder,
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
    backgroundColor: `${DesignColors.textSecondary}18`,
  },
  resetIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${DesignColors.danger}18`,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  subtitle: {
    fontSize: 13,
    color: DesignColors.textSecondary,
  },
  resetCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DesignColors.bgBorder,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    marginTop: 12,
  },
  resetLabel: {
    fontSize: 16,
    color: DesignColors.danger,
  },
  infoSection: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DesignColors.bgBorder,
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
    color: DesignColors.textSecondary,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: DesignColors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontVariant: ["tabular-nums"],
  },
});
