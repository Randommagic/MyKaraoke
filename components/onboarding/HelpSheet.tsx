/**
 * 설정 "사용법" 바텀시트.
 * 스와이프 데모를 중심에 보여주고, 탭으로 상세 열기 안내를 덧붙인다.
 * reanimated로 아래에서 슬라이드 인 + 배경 dim, 안드로이드 뒤로가기로 닫힘.
 */
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { BackHandler, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DesignColors } from "@/components/design/colors";
import { FontSize, FontWeight, Radius, Spacing } from "@/components/design/tokens";
import { readinessToDesignStatus } from "@/components/design/map-song";
import { SwipeHintDemo, type DemoSong } from "@/components/onboarding/SwipeHintDemo";
import { loadSongs } from "@/lib/songs-storage";
import { UI_STRINGS } from "@/lib/ui-strings";

const SHEET_OFFSET = 600;

export function HelpSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(SHEET_OFFSET);
  const dragY = useSharedValue(0);
  const backdrop = useSharedValue(0);
  const [replayKey, setReplayKey] = useState(0);
  const [demoSong, setDemoSong] = useState<DemoSong | undefined>(undefined);

  useEffect(() => {
    if (visible) {
      setReplayKey((k) => k + 1);
      dragY.value = 0;
      void loadSongs().then((songs) => {
        const first = songs[0];
        setDemoSong(
          first
            ? {
                title: first.title,
                artist: first.artist,
                genderKey: first.genderKey,
                readyStatus: readinessToDesignStatus(first.readiness),
                keyOffset: first.transposeSemitones ?? 0,
                showKeyBadge: first.transposeSemitones !== null,
              }
            : undefined,
        );
      });
      translateY.value = SHEET_OFFSET;
      translateY.value = withTiming(0, { duration: 340, easing: Easing.out(Easing.cubic) });
      backdrop.value = withTiming(1, { duration: 200 });
    }
  }, [visible, translateY, dragY, backdrop]);

  const handleClose = () => {
    dragY.value = 0;
    backdrop.value = withTiming(0, { duration: 180 });
    translateY.value = withTiming(SHEET_OFFSET, { duration: 200 }, (finished) => {
      "worklet";
      if (finished) runOnJS(onClose)();
    });
  };

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      dragY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 700) {
        backdrop.value = withTiming(0, { duration: 150 });
        dragY.value = 0;
        translateY.value = withTiming(SHEET_OFFSET, { duration: 220 }, (finished) => {
          "worklet";
          if (finished) runOnJS(onClose)();
        });
      } else {
        dragY.value = withSpring(0, { damping: 20, stiffness: 300 });
      }
    });

  // 안드로이드 뒤로가기
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handleClose();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value + dragY.value }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleClose}
            accessibilityLabel="닫기"
          />
        </Animated.View>

        <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, Spacing.xl) + Spacing.lg },
            sheetStyle,
          ]}
        >
          <View style={styles.grabber} />

          <View style={styles.header}>
            <Text style={styles.title}>{UI_STRINGS.onboarding.sheetTitle}</Text>
            <Pressable
              onPress={handleClose}
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              accessibilityRole="button"
              accessibilityLabel="닫기"
            >
              <Ionicons name="close" size={24} color={DesignColors.textSecondary} />
            </Pressable>
          </View>

          <Text style={styles.swipeTitle}>{UI_STRINGS.onboarding.swipeTitle}</Text>
          <Text style={styles.swipeDesc}>{UI_STRINGS.onboarding.sheetSubtitle}</Text>

          <View style={styles.demoWrap}>
            <SwipeHintDemo key={replayKey} autoPlay loop demoSong={demoSong} />
          </View>

          <View style={styles.hints}>
            <View style={styles.hintRow}>
              <View style={styles.hintIcon}>
                <Ionicons name="finger-print-outline" size={20} color={DesignColors.textSecondary} />
              </View>
              <Text style={styles.hintText}>{UI_STRINGS.onboarding.tapHint}</Text>
            </View>
            <View style={styles.hintRow}>
              <View style={styles.hintIcon}>
                <Ionicons name="reorder-three" size={20} color={DesignColors.textSecondary} />
              </View>
              <Text style={styles.hintText}>{UI_STRINGS.onboarding.dragHint}</Text>
            </View>
          </View>
        </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: DesignColors.scrim,
  },
  sheet: {
    backgroundColor: DesignColors.bg,
    borderTopLeftRadius: Radius.modal,
    borderTopRightRadius: Radius.modal,
    paddingHorizontal: Spacing.xl4,
    paddingTop: Spacing.lg,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: DesignColors.bgBorder,
    marginBottom: Spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xl4,
  },
  title: {
    flex: 1,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: DesignColors.textPrimary,
    letterSpacing: -0.3,
  },
  swipeTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: DesignColors.textPrimary,
    marginBottom: Spacing.xs,
  },
  swipeDesc: {
    fontSize: FontSize.sm,
    lineHeight: 19,
    color: DesignColors.textSecondary,
    marginBottom: Spacing.xl,
  },
  demoWrap: {
    marginBottom: 0,
  },
  hints: {
    marginTop: Spacing.xl4,
    gap: Spacing.xl,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  hintIcon: {
    width: 20,
    alignItems: "center",
  },
  hintText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: DesignColors.textSecondary,
    lineHeight: 19,
  },
});
