import { useThemeColor } from "@/hooks/use-theme-color";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  View,
} from "react-native";

const MARQUEE_PX_PER_SEC = 32;
const MARQUEE_DURATION_MIN_MS = 2000;
const MARQUEE_DURATION_MAX_MS = 35000;
const MARQUEE_GAP_PX = 28;

type Props = {
  text: string;
  color?: string;
  style?: StyleProp<TextStyle>;
};

export function MarqueeText({ text, color: colorProp, style }: Props) {
  const themeTextColor = useThemeColor({}, "text");
  const textColor = colorProp ?? themeTextColor;
  const anim = useRef(new Animated.Value(0)).current;
  const [containerW, setContainerW] = useState(0);
  const [textW, setTextW] = useState<number | null>(null);
  const [measureEpoch, setMeasureEpoch] = useState(0);

  const flatStyle = StyleSheet.flatten(style) ?? {};
  const lineHeight =
    typeof flatStyle.lineHeight === "number" ? flatStyle.lineHeight : 22;
  const textStyle: TextStyle = { ...flatStyle, color: textColor };

  const commitMeasuredWidth = useCallback((w: number) => {
    if (w <= 0 || !Number.isFinite(w)) return;
    setTextW((prev) => {
      if (prev == null) return w;
      return w > prev ? w : prev;
    });
  }, []);

  useEffect(() => {
    setTextW(null);
    anim.setValue(0);
    setMeasureEpoch((n) => n + 1);
  }, [text, anim]);

  useEffect(() => {
    if (textW == null || containerW <= 0) return;
    const overflow = textW - containerW;
    if (overflow <= 0) return;

    anim.stopAnimation();
    anim.setValue(0);

    const distance = overflow + MARQUEE_GAP_PX;
    const rawDuration = (distance / MARQUEE_PX_PER_SEC) * 1000;
    const duration = Math.min(
      MARQUEE_DURATION_MAX_MS,
      Math.max(MARQUEE_DURATION_MIN_MS, rawDuration),
    );
    const useNativeDriver = Platform.OS !== "web";
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(800),
        Animated.timing(anim, {
          toValue: -distance,
          duration,
          easing: Easing.linear,
          useNativeDriver,
        }),
        Animated.delay(300),
        Animated.timing(anim, {
          toValue: 0,
          duration: 0,
          useNativeDriver,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      anim.stopAnimation();
    };
  }, [text, containerW, textW, anim]);

  const measured = textW != null;
  const needsMarquee = measured && containerW > 0 && textW! > containerW;
  const marqueeTextWidthStyle =
    measured && needsMarquee ? { width: textW! } : null;

  return (
    <View
      style={[styles.wrap, { minHeight: lineHeight }]}
      collapsable={false}
      onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}
    >
      <View
        style={[styles.measureHost, { height: lineHeight }]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        collapsable={false}
      >
        <ScrollView
          key={measureEpoch}
          horizontal
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          style={[styles.measureScroll, { maxHeight: lineHeight }]}
          contentContainerStyle={styles.measureScrollInner}
          onContentSizeChange={(cw) => commitMeasuredWidth(cw)}
        >
          <Text
            onLayout={(e) =>
              commitMeasuredWidth(e.nativeEvent.layout.width)
            }
            onTextLayout={(e) => {
              const lines = e.nativeEvent.lines;
              if (!lines.length) return;
              commitMeasuredWidth(
                Math.max(...lines.map((line) => line.width)),
              );
            }}
            style={[styles.text, textStyle]}
            numberOfLines={1}
          >
            {text}
          </Text>
        </ScrollView>
      </View>
      {needsMarquee ? (
        <Animated.View
          style={[
            styles.track,
            { transform: [{ translateX: anim }] },
          ]}
        >
          <Text
            style={[styles.text, textStyle, marqueeTextWidthStyle]}
            numberOfLines={1}
            ellipsizeMode="clip"
          >
            {text}
          </Text>
        </Animated.View>
      ) : (
        <Text
          style={[styles.text, textStyle]}
          numberOfLines={1}
          ellipsizeMode={measured ? undefined : "tail"}
        >
          {text}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    overflow: "hidden",
    minWidth: 0,
    justifyContent: "center",
  },
  measureHost: {
    position: "absolute",
    opacity: 0.02,
    left: 0,
    top: 0,
    width: 8000,
    zIndex: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  measureScroll: {
    flexGrow: 0,
  },
  measureScrollInner: {
    alignItems: "center",
    paddingRight: 4,
  },
  text: {
    flexShrink: 0,
  },
  track: {
    alignSelf: "flex-start",
  },
});
