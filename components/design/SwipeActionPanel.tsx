import type { ReactNode } from "react";
import {
  Animated,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { DESIGN_CARD_RADIUS } from "@/components/design/colors";

/** Swipeable 루트 width = 최대 스와이프 거리 */
export const SWIPE_ACTION_WIDTH = 80;

/** 카드 밑으로 살짝 깔아 곡 카드와 이어지게 보이는 여분(px) */
export const SWIPE_ACTION_BLEED = 20;

const VISUAL_WIDTH = SWIPE_ACTION_WIDTH + SWIPE_ACTION_BLEED;

type CardEdge = "left" | "right";

type Props = {
  backgroundColor: string;
  progress: Animated.AnimatedInterpolation<number>;
  /** 액션 패널에서 곡 카드와 맞닿는 변 */
  cardEdge: CardEdge;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

function radiiForCardEdge(cardEdge: CardEdge) {
  const r = DESIGN_CARD_RADIUS;
  if (cardEdge === "right") {
    return {
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
      borderTopLeftRadius: r,
      borderBottomLeftRadius: r,
    };
  }
  return {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: r,
    borderBottomRightRadius: r,
  };
}

/**
 * 스와이프 액션
 * - shell 80px: Swipeable이 인식하는 거리
 * - visual 100px: 카드 방향으로 bleed 해서 닿을 때 이음새 완화
 */
export function SwipeActionPanel({
  backgroundColor,
  progress,
  cardEdge,
  children,
  style,
  contentStyle,
}: Props) {
  const visualBleedStyle =
    cardEdge === "right"
      ? styles.visualBleedRight
      : styles.visualBleedLeft;

  return (
    <Animated.View
      style={[
        styles.shell,
        {
          opacity: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.7, 1],
            extrapolate: "clamp",
          }),
        },
      ]}
    >
      <View
        style={[
          styles.visual,
          visualBleedStyle,
          radiiForCardEdge(cardEdge),
          { backgroundColor },
          style,
        ]}
      >
        <View
          style={[
            styles.content,
            cardEdge === "right"
              ? styles.contentAtStart
              : styles.contentAtEnd,
            contentStyle,
          ]}
        >
          {children}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: SWIPE_ACTION_WIDTH,
    height: "100%",
    marginBottom: 7,
    overflow: "visible",
    flexGrow: 0,
    flexShrink: 0,
  },
  visual: {
    width: VISUAL_WIDTH,
    minHeight: 68,
    height: "100%",
    overflow: "hidden",
  },
  /** 삭제: visual이 shell 오른쪽(카드 쪽)으로 20px 돌출 */
  visualBleedRight: {
    alignSelf: "flex-start",
  },
  /** 오늘 불렀음: visual이 shell 왼쪽(카드 쪽)으로 20px 돌출 */
  visualBleedLeft: {
    alignSelf: "flex-end",
  },
  content: {
    width: SWIPE_ACTION_WIDTH,
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    gap: 4,
  },
  contentAtStart: {
    alignSelf: "flex-start",
  },
  contentAtEnd: {
    alignSelf: "flex-end",
  },
});
