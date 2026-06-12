/**
 * 가로 스크롤 칩 행 + 양끝 페이드(그라디언트) 공용 컴포넌트.
 *
 * 홈 준비도 필터 / 차트 카테고리 필터가 똑같이 쓰던 스크롤 위치 추적·
 * 엣지 페이드 로직을 한곳으로 모은 것. 칩의 생김새는 화면마다 달라
 * `children`으로 받고, 이 컴포넌트는 스크롤·페이드 메커니즘만 담당한다.
 */
import { useState, type ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { DesignColors } from "@/components/design/colors";

const DEFAULT_FADE_WIDTH = 32;
const DEFAULT_EDGE_THRESHOLD = 8;

export function EdgeFadeScroller({
  children,
  fadeWidth = DEFAULT_FADE_WIDTH,
  edgeThreshold = DEFAULT_EDGE_THRESHOLD,
  showChevron = false,
  fadeColor = DesignColors.bg,
  style,
  contentContainerStyle,
}: {
  children: ReactNode;
  /** 페이드 폭(px) */
  fadeWidth?: number;
  /** 끝에 닿았다고 볼 여유(px) */
  edgeThreshold?: number;
  /** 페이드 위에 ‹ › 화살표 표시 여부 */
  showChevron?: boolean;
  /** 페이드가 녹아드는 배경색 (기본 화면 배경) */
  fadeColor?: string;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const [scrollX, setScrollX] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  const canScroll = contentWidth > viewportWidth + edgeThreshold;
  const showLeftFade = canScroll && scrollX > edgeThreshold;
  const showRightFade =
    canScroll && scrollX + viewportWidth < contentWidth - edgeThreshold;

  return (
    <View style={[styles.root, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => setScrollX(e.nativeEvent.contentOffset.x)}
        onLayout={(e) => setViewportWidth(e.nativeEvent.layout.width)}
        onContentSizeChange={(w) => setContentWidth(w)}
        style={styles.scroll}
        contentContainerStyle={contentContainerStyle}
      >
        {children}
      </ScrollView>

      {showLeftFade ? (
        <>
          <LinearGradient
            colors={[fadeColor, "transparent"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.fade, styles.fadeLeft, { width: fadeWidth }]}
            pointerEvents="none"
          />
          {showChevron ? (
            <Text
              style={[styles.chevron, styles.chevronLeft]}
              pointerEvents="none"
            >
              ‹
            </Text>
          ) : null}
        </>
      ) : null}

      {showRightFade ? (
        <>
          <LinearGradient
            colors={["transparent", fadeColor]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.fade, styles.fadeRight, { width: fadeWidth }]}
            pointerEvents="none"
          />
          {showChevron ? (
            <Text
              style={[styles.chevron, styles.chevronRight]}
              pointerEvents="none"
            >
              ›
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "relative",
  },
  scroll: {
    flexGrow: 0,
  },
  fade: {
    position: "absolute",
    top: 0,
    bottom: 0,
    zIndex: 1,
  },
  fadeLeft: {
    left: 0,
  },
  fadeRight: {
    right: 0,
  },
  chevron: {
    position: "absolute",
    top: "50%",
    marginTop: -11,
    fontSize: 22,
    lineHeight: 22,
    fontWeight: "600",
    color: DesignColors.textMuted,
    zIndex: 2,
  },
  chevronLeft: {
    left: 6,
  },
  chevronRight: {
    right: 6,
  },
});
