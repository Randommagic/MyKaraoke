import { useCallback, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ONBOARDING_SLIDE_COUNT } from "@/components/onboarding/onboarding-constants";
import { DesignColors } from "@/components/design/colors";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

const SLIDE_INDICES = Array.from(
  { length: ONBOARDING_SLIDE_COUNT },
  (_, i) => i,
);

type Props = {
  visible: boolean;
  onFinish: () => void;
};

export function OnboardingSlidesModal({ visible, onFinish }: Props) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<number>>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const pageWidth = Dimensions.get("window").width;
  const isLastPage = pageIndex >= ONBOARDING_SLIDE_COUNT - 1;

  const handleFinish = useCallback(() => {
    setPageIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    onFinish();
  }, [onFinish]);

  const goNext = useCallback(() => {
    if (isLastPage) {
      handleFinish();
      return;
    }
    const next = pageIndex + 1;
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setPageIndex(next);
  }, [handleFinish, isLastPage, pageIndex]);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
      setPageIndex(Math.min(Math.max(index, 0), ONBOARDING_SLIDE_COUNT - 1));
    },
    [pageWidth],
  );

  const renderItem: ListRenderItem<number> = useCallback(
    () => (
      <View style={[styles.slide, { width: pageWidth }]}>
        <View style={styles.slidePlaceholder} />
      </View>
    ),
    [pageWidth],
  );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={handleFinish}
    >
      <ThemedView style={styles.root}>
        <FlatList
          ref={listRef}
          style={styles.list}
          data={SLIDE_INDICES}
          keyExtractor={(item) => String(item)}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onMomentumScrollEnd={onMomentumScrollEnd}
          getItemLayout={(_, index) => ({
            length: pageWidth,
            offset: pageWidth * index,
            index,
          })}
        />

        <View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, 16),
              paddingTop: 12,
            },
          ]}
        >
          <View style={styles.dots} accessibilityRole="tablist">
            {SLIDE_INDICES.map((i) => (
              <View
                key={i}
                style={[styles.dot, i === pageIndex && styles.dotActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: i === pageIndex }}
                accessibilityLabel={`${i + 1}번째 슬라이드`}
              />
            ))}
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={handleFinish}
              style={({ pressed }) => [
                styles.skipBtn,
                { opacity: pressed ? 0.65 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="건너뛰기"
            >
              <ThemedText style={styles.skipLabel}>건너뛰기</ThemedText>
            </Pressable>

            <Pressable
              onPress={goNext}
              style={({ pressed }) => [
                styles.primaryBtn,
                { opacity: pressed ? 0.88 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={isLastPage ? "시작하기" : "다음"}
            >
              <ThemedText style={styles.primaryBtnLabel}>
                {isLastPage ? "시작하기" : "다음"}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  slide: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  slidePlaceholder: {
    flex: 1,
    alignSelf: "stretch",
    marginVertical: 24,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DesignColors.bgBorder,
    backgroundColor: DesignColors.bgCard,
  },
  footer: {
    paddingHorizontal: 20,
    gap: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DesignColors.bgBorder,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DesignColors.bgBorder,
  },
  dotActive: {
    backgroundColor: DesignColors.accent,
    width: 20,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  skipBtn: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  skipLabel: {
    fontSize: 15,
    color: DesignColors.textSecondary,
  },
  primaryBtn: {
    flex: 1,
    maxWidth: 200,
    marginLeft: "auto",
    backgroundColor: DesignColors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  primaryBtnLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: DesignColors.textOnAccent,
  },
});
