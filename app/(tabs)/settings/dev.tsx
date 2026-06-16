import { StackActions } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DesignColors } from "@/components/design/colors";
import { useConfirm } from "@/components/design/confirm-dialog-context";
import { ScreenTitle } from "@/components/design/ScreenTitle";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { resetSwipeHintSeen } from "@/lib/app-prefs";
import { logDebug } from "@/lib/debug-log-buffer";

type DevMenuItem = {
  key: string;
  label: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  onPress: () => void;
};

export default function DevScreen() {
  const router = useRouter();
  const confirm = useConfirm();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [resetting, setResetting] = useState(false);

  // 다른 탭으로 이동했다가 설정으로 돌아오면 이 화면 대신 설정 인덱스가 보이도록.
  // blur 시점에 스택 최상단이 여전히 'dev'이면 탭 전환이므로 루트로 팝.
  // (자식 화면인 log로 이동할 때는 최상단이 'log'로 바뀐 뒤 blur가 오므로 건드리지 않음)
  useEffect(() => {
    const unsubscribe = navigation.addListener("blur", () => {
      const state = navigation.getState();
      if (state?.routes[state.index]?.name === "dev") {
        navigation.dispatch(StackActions.popToTop());
      }
    });
    return unsubscribe;
  }, [navigation]);

  const onResetSwipeHint = useCallback(() => {
    confirm({
      title: "스와이프 힌트 초기화",
      message:
        "홈 화면에서 스와이프 안내 배너를 다시 표시합니다. 곡이 있는 상태에서 홈으로 돌아가면 바로 적용됩니다.",
      confirmLabel: "초기화",
      onConfirm: () => {
        void (async () => {
          try {
            setResetting(true);
            await resetSwipeHintSeen();
            confirm({
              title: "초기화 완료",
              message: "홈 화면으로 이동하면 스와이프 안내가 다시 표시됩니다.",
              alert: true,
              onConfirm: () => {},
            });
          } catch (e) {
            logDebug(
              `[dev] 스와이프 힌트 초기화 실패: ${e instanceof Error ? e.message : String(e)}`,
              "error",
            );
          } finally {
            setResetting(false);
          }
        })();
      },
    });
  }, [confirm]);

  const menuItems: DevMenuItem[] = [
    {
      key: "log",
      label: "디버그 로그",
      subtitle: "앱 내부 로그 확인",
      icon: "terminal-outline",
      onPress: () => router.push("/settings/log"),
    },
    {
      key: "reset-swipe-hint",
      label: "스와이프 힌트 초기화",
      subtitle: "홈 스와이프 안내 배너를 다시 표시",
      icon: "refresh-outline",
      onPress: onResetSwipeHint,
    },
  ];

  return (
    <ThemedView style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <ScreenTitle style={styles.title}>개발자 메뉴</ScreenTitle>

      <View style={styles.menu}>
        {menuItems.map((item, index) => (
          <Pressable
            key={item.key}
            onPress={item.onPress}
            disabled={item.key === "reset-swipe-hint" && resetting}
            style={({ pressed }) => [
              styles.row,
              index < menuItems.length - 1 ? styles.rowDivider : null,
              { opacity: pressed || (item.key === "reset-swipe-hint" && resetting) ? 0.6 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            <View style={styles.iconWrap}>
              <Ionicons
                name={item.icon}
                size={22}
                color={item.iconColor ?? DesignColors.textSecondary}
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
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  subtitle: {
    fontSize: 13,
    color: DesignColors.textSecondary,
  },
});
