/**
 * 스와이프 제스처 시연 컴포넌트 (재사용).
 *
 * 예시 곡 카드가 왼쪽→오른쪽으로 자동으로 움직이며 뒤에 깔린 액션 패널을
 * 드러내, "카드를 밀 수 있다"는 숨은 제스처를 가르친다. 방향·색은 실제 홈
 * 스와이프와 일치(왼쪽 밀기→오늘 불렀음 초록, 오른쪽 밀기→삭제 빨강).
 *
 * 손가락 커서/리플과 카드는 같은 shared value(tx)에서 파생돼 어긋나지 않는다.
 * reduce motion이 켜져 있으면 카드를 살짝 열린 정적 상태로 표시하는 폴백.
 */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { GenderBadge, KeyBadge, ReadyBadge } from "@/components/design/Badges";
import type { ReadyStatus } from "@/components/design/types";
import { DesignColors } from "@/components/design/colors";
import {
  FontSize,
  FontWeight,
  Radius,
  Spacing,
} from "@/components/design/tokens";
import { UI_STRINGS } from "@/lib/ui-strings";

const PEEK = 72;
const DRAG_MS = 700;
const HOLD_MS = 1800;
const RETURN_MS = 550;

export type DemoSong = {
  title: string;
  artist?: string;
  genderKey?: "male" | "female" | "unset";
  readyStatus?: ReadyStatus;
  keyOffset?: number;
  showKeyBadge?: boolean;
};

export function SwipeHintDemo({
  autoPlay = true,
  loop = false,
  onDone,
  demoSong,
}: {
  autoPlay?: boolean;
  loop?: boolean;
  onDone?: () => void;
  demoSong?: DemoSong;
}) {
  const tx = useSharedValue(0);
  const fingerOpacity = useSharedValue(0);
  const ripple = useSharedValue(0);

  // null = 아직 모름. reduce motion 결정 후 애니메이션 시작.
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const callDone = useCallback(() => onDoneRef.current?.(), []);

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (!cancelled) setReduceMotion(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion === null || !autoPlay) return;

    if (reduceMotion) {
      // 정적 폴백: 초록(왼쪽 밀기) 쪽을 살짝 열어두고 잠시 후 done
      fingerOpacity.value = 0;
      tx.value = withTiming(-PEEK * 0.6, { duration: 300 });
      const t = setTimeout(() => callDone(), 1400);
      return () => clearTimeout(t);
    }

    fingerOpacity.value = withTiming(1, { duration: 280 });
    ripple.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );

    const sequence = withSequence(
      withDelay(280, withTiming(-PEEK, { duration: DRAG_MS })), // 왼쪽 → 오늘 불렀음
      withDelay(HOLD_MS, withTiming(0, { duration: RETURN_MS })),
      withTiming(PEEK, { duration: DRAG_MS }), // 오른쪽 → 삭제
      withDelay(HOLD_MS, withTiming(0, { duration: RETURN_MS })),
    );

    if (loop) {
      tx.value = withRepeat(sequence, -1, false);
    } else {
      tx.value = withSequence(
        sequence,
        withTiming(0, { duration: 1 }, (finished) => {
          "worklet";
          if (finished) runOnJS(callDone)();
        }),
      );
      fingerOpacity.value = withDelay(
        280 + DRAG_MS + HOLD_MS + RETURN_MS + DRAG_MS + HOLD_MS,
        withTiming(0, { duration: RETURN_MS }),
      );
    }

    return () => {
      cancelAnimation(tx);
      cancelAnimation(fingerOpacity);
      cancelAnimation(ripple);
    };
  }, [reduceMotion, autoPlay, loop, tx, fingerOpacity, ripple, callDone]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));
  const fingerStyle = useAnimatedStyle(() => ({
    opacity: fingerOpacity.value,
    transform: [{ translateX: tx.value }],
  }));
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: fingerOpacity.value * (1 - ripple.value),
    transform: [{ translateX: tx.value }, { scale: 0.4 + ripple.value * 1.1 }],
  }));

  return (
    <View style={styles.stage}>
      {/* 뒤에 깔린 액션 패널: 왼쪽=삭제(빨강), 오른쪽=오늘 불렀음(초록) */}
      <View style={[styles.panel, styles.panelLeft]}>
        <View style={styles.panelLeftContent}>
          <Ionicons
            name="trash-outline"
            size={20}
            color={DesignColors.swipeDeleteText}
          />
          <Text style={styles.panelDeleteLabel} numberOfLines={1}>
            삭제
          </Text>
        </View>
      </View>
      <View style={[styles.panel, styles.panelRight]}>
        <View style={styles.panelRightContent}>
          <Ionicons name="mic" size={20} color={DesignColors.swipeSungText} />
          <Text style={styles.panelSungLabel} numberOfLines={1}>
            {UI_STRINGS.swipe.sungToday}
          </Text>
        </View>
      </View>

      {/* 예시 카드 */}
      {(() => {
        const gk = demoSong?.genderKey;
        const badgeGender: "male" | "female" | undefined =
          gk === "male" || gk === "female" ? gk : demoSong ? undefined : "male";
        const readyStatus: ReadyStatus = !demoSong
          ? "done"
          : (demoSong.readyStatus ?? "none");
        const displayTitle = demoSong?.artist
          ? `${demoSong.artist} - ${demoSong.title}`
          : (demoSong?.title ?? "예시 곡");
        return (
          <Animated.View style={[styles.card, cardStyle]}>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {displayTitle}
              </Text>
              <View style={styles.badgeRow}>
                <ReadyBadge status={readyStatus} />
                {badgeGender ? <GenderBadge gender={badgeGender} /> : null}
                {demoSong?.showKeyBadge ? (
                  <KeyBadge offset={demoSong.keyOffset ?? 0} />
                ) : null}
              </View>
            </View>
            <View style={styles.exampleChip}>
              <Text style={styles.exampleChipText}>
                {UI_STRINGS.onboarding.example}
              </Text>
            </View>
          </Animated.View>
        );
      })()}

      {/* 터치 리플 + 손가락 커서 */}
      <Animated.View
        pointerEvents="none"
        style={[styles.ripple, rippleStyle]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.finger, fingerStyle]}
      />
    </View>
  );
}

const STAGE_HEIGHT = 72;
const FINGER_SIZE = 34;

const styles = StyleSheet.create({
  stage: {
    height: STAGE_HEIGHT,
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: Radius.card,
  },
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
  },
  panelLeft: {
    left: 0,
    right: "50%",
    alignItems: "flex-start",
    justifyContent: "center",
    backgroundColor: DesignColors.swipeDeleteBg,
  },
  panelLeftContent: {
    width: PEEK,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  panelRight: {
    right: 0,
    left: "50%",
    alignItems: "flex-end",
    justifyContent: "center",
    backgroundColor: DesignColors.swipeSungBg,
  },
  panelRightContent: {
    width: PEEK,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  panelDeleteLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: DesignColors.swipeDeleteText,
  },
  panelSungLabel: {
    fontSize: FontSize.xs2,
    fontWeight: FontWeight.semibold,
    color: DesignColors.swipeSungText,
    textAlign: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: DesignColors.bgCard,
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.xl2,
    paddingVertical: Spacing.xl,
    minHeight: STAGE_HEIGHT,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  cardTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: DesignColors.textPrimary,
  },
  badgeRow: {
    flexDirection: "row",
  },
  exampleChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    backgroundColor: DesignColors.filterChipActiveBg,
  },
  exampleChipText: {
    fontSize: FontSize.xs2,
    fontWeight: FontWeight.semibold,
    color: DesignColors.accent,
  },
  finger: {
    position: "absolute",
    alignSelf: "center",
    width: FINGER_SIZE,
    height: FINGER_SIZE,
    borderRadius: FINGER_SIZE / 2,
    backgroundColor: "rgba(61,42,30,0.28)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.7)",
  },
  ripple: {
    position: "absolute",
    alignSelf: "center",
    width: FINGER_SIZE,
    height: FINGER_SIZE,
    borderRadius: FINGER_SIZE / 2,
    borderWidth: 2,
    borderColor: DesignColors.accent,
  },
});
