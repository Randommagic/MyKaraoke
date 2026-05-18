import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import {
  BADGE_CHIP_MIN_HEIGHT,
  DateBadge,
  GenderBadge,
  KeyBadge,
  ReadyBadge,
} from "@/components/design/Badges";
import { DesignColors } from "@/components/design/colors";
import type { SongCardModel } from "@/components/design/types";

interface Props {
  model: SongCardModel;
  onPress?: () => void;
  showDragHandle?: boolean;
  onDragHandleLongPress?: () => void;
  dragHandleDisabled?: boolean;
}

export function SongCard({
  model,
  onPress,
  showDragHandle = false,
  onDragHandleLongPress,
  dragHandleDisabled = false,
}: Props) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      {showDragHandle ? (
        <TouchableOpacity
          onLongPress={onDragHandleLongPress}
          delayLongPress={220}
          disabled={dragHandleDisabled}
          hitSlop={8}
          style={styles.handlePressable}
          accessibilityRole="button"
          accessibilityLabel="길게 눌러 순서 변경"
        >
          <Text
            style={[
              styles.handle,
              dragHandleDisabled ? styles.handleDisabled : null,
            ]}
          >
            ☰
          </Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
            {model.title}
          </Text>
          <DateBadge lastSungAt={model.lastSungAt} />
        </View>

        <View style={styles.badgeRow}>
          <ReadyBadge status={model.readyStatus} />
          {model.genderKey ? <GenderBadge gender={model.genderKey} /> : null}
          {model.showKeyBadge ? (
            <KeyBadge offset={model.keyOffset} />
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: DesignColors.bgCard,
    borderWidth: 1,
    borderColor: DesignColors.bgBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  handlePressable: {
    marginTop: 2,
  },
  handle: {
    fontSize: 16,
    color: DesignColors.textFaint,
  },
  handleDisabled: {
    opacity: 0.35,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    minHeight: 18,
    marginBottom: 6,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: DesignColors.textPrimary,
    lineHeight: 18,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 5,
    minHeight: BADGE_CHIP_MIN_HEIGHT,
  },
});
