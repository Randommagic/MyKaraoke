import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ScaleDecorator } from "react-native-draggable-flatlist";
import { Swipeable } from "react-native-gesture-handler";

import { DesignColors } from "@/components/design/colors";
import type { ConfirmFn } from "@/components/design/confirm-dialog-context";
import { mapStorageSongToCardModel } from "@/components/design/map-song";
import { SongCard } from "@/components/design/SongCard";
import {
  SWIPE_ACTION_WIDTH,
  SwipeActionPanel,
} from "@/components/design/SwipeActionPanel";
import { isSungToday } from "@/lib/song-form-helpers";
import { UI_STRINGS } from "@/lib/ui-strings";
import type { Song } from "@/lib/songs-storage";

export function SwipeableSongRow({
  item,
  iconMuted,
  onOpenDetail,
  onToggleSungToday,
  onRequestDelete,
  confirm,
  registerSwipeRef,
  closeOtherSwipes,
  drag,
  isActive,
  swipeEnabled,
  dragReorderEnabled,
  onDisabledDragAttempt,
}: {
  item: Song;
  iconMuted: string;
  onOpenDetail: () => void;
  onToggleSungToday: () => void;
  onRequestDelete: () => void;
  confirm: ConfirmFn;
  registerSwipeRef: (id: string, ref: Swipeable | null) => void;
  closeOtherSwipes: (id: string) => void;
  drag: () => void;
  isActive: boolean;
  swipeEnabled: boolean;
  dragReorderEnabled: boolean;
  onDisabledDragAttempt: () => void;
}) {
  const swipeRef = useRef<Swipeable | null>(null);
  const sungToday = isSungToday(item.sungDates);

  const renderLeftActions = (
    progress: Animated.AnimatedInterpolation<number>,
  ) => (
    <SwipeActionPanel
      backgroundColor={DesignColors.swipeDeleteBg}
      progress={progress}
      cardEdge="right"
    >
      <Ionicons
        name="trash-outline"
        size={20}
        color={DesignColors.swipeDeleteText}
      />
      <Text style={styles.swipeDeleteActionLabel}>삭제</Text>
    </SwipeActionPanel>
  );

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
  ) => (
    <SwipeActionPanel
      backgroundColor={
        sungToday ? DesignColors.swipeSungCancelBg : DesignColors.swipeSungBg
      }
      progress={progress}
      cardEdge="left"
      contentStyle={styles.swipeSungActionPanel}
    >
      {sungToday ? (
        <>
          <Ionicons
            name="arrow-undo"
            size={20}
            color={DesignColors.swipeSungCancelText}
          />
          <Text style={styles.swipeSungCancelActionLabel}>
            {UI_STRINGS.swipe.sungTodayCancel}
          </Text>
        </>
      ) : (
        <>
          <Ionicons name="mic" size={20} color={DesignColors.swipeSungText} />
          <Text style={styles.swipeSungActionLabel}>
            {UI_STRINGS.swipe.sungToday}
          </Text>
        </>
      )}
    </SwipeActionPanel>
  );

  return (
    <ScaleDecorator activeScale={1.02}>
      <View style={[styles.songCardRow, isActive ? { opacity: 0.92 } : null]}>
        <Pressable
          onLongPress={() => {
            if (dragReorderEnabled) {
              if (Platform.OS !== "web") {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              drag();
            } else {
              onDisabledDragAttempt();
            }
          }}
          delayLongPress={220}
          disabled={isActive}
          hitSlop={8}
          style={({ pressed }) => [
            styles.dragHandle,
            {
              opacity: dragReorderEnabled ? (pressed ? 0.65 : 1) : 0.3,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            dragReorderEnabled
              ? "길게 눌러 순서 변경"
              : "전체 보기에서만 순서 변경 가능"
          }
        >
          <Ionicons name="reorder-three" size={22} color={iconMuted} />
        </Pressable>
        <View style={styles.songCardWrap}>
          <Swipeable
            ref={(r) => {
              swipeRef.current = r;
              registerSwipeRef(item.id, r);
            }}
            enabled={swipeEnabled && !isActive}
            renderLeftActions={renderLeftActions}
            renderRightActions={renderRightActions}
            onSwipeableWillOpen={() => closeOtherSwipes(item.id)}
            onSwipeableOpen={(direction) => {
              swipeRef.current?.close();
              if (direction === "left") {
                confirm({
                  title: "삭제하시겠습니까?",
                  confirmLabel: "삭제",
                  destructive: true,
                  onConfirm: onRequestDelete,
                });
                return;
              }
              if (direction !== "right") return;
              if (Platform.OS !== "web") {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              onToggleSungToday();
            }}
            friction={2}
            overshootLeft={false}
            overshootRight={false}
            leftThreshold={SWIPE_ACTION_WIDTH * 0.45}
            rightThreshold={SWIPE_ACTION_WIDTH * 0.45}
            enableTrackpadTwoFingerGesture
            containerStyle={styles.swipeCardContainer}
          >
            <SongCard
              model={mapStorageSongToCardModel(item)}
              onPress={onOpenDetail}
            />
          </Swipeable>
        </View>
      </View>
    </ScaleDecorator>
  );
}

const styles = StyleSheet.create({
  swipeCardContainer: {
    flex: 1,
    width: "100%",
  },
  songCardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    width: "100%",
    marginBottom: 7,
  },
  dragHandle: {
    justifyContent: "center",
    alignItems: "center",
    paddingRight: 6,
    paddingLeft: 2,
    paddingTop: 14,
  },
  songCardWrap: {
    flex: 1,
    minWidth: 0,
  },
  swipeDeleteActionLabel: {
    color: DesignColors.swipeDeleteText,
    fontSize: 13,
    fontWeight: "600",
  },
  swipeSungActionPanel: {
    flexDirection: "column",
    gap: 2,
    paddingHorizontal: 4,
    paddingLeft: 4,
    paddingRight: 10,
  },
  swipeSungActionLabel: {
    color: DesignColors.swipeSungText,
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },
  swipeSungCancelActionLabel: {
    color: DesignColors.swipeSungCancelText,
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },
});
