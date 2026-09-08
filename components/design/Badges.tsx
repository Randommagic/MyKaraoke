import { Platform, StyleSheet, Text, View } from "react-native";

import { DesignColors } from "@/components/design/colors";
import { getDateRangeFromLastSungAt } from "@/components/design/sung-recency";
import type {
  DateRange,
  GenderBadgeKey,
  ReadyStatus,
} from "@/components/design/types";
import { UI_STRINGS } from "@/lib/ui-strings";

const READY_CONFIG: Record<
  ReadyStatus,
  { label: string; bg: string; text: string }
> = {
  none: {
    label: UI_STRINGS.readiness.none,
    bg: DesignColors.badgeNoneBg,
    text: DesignColors.badgeNoneText,
  },
  done: {
    label: UI_STRINGS.readiness.can_full,
    bg: DesignColors.badgeDoneBg,
    text: DesignColors.badgeDoneText,
  },
  practice: {
    label: UI_STRINGS.readiness.need_practice,
    bg: DesignColors.badgePracBg,
    text: DesignColors.badgePracText,
  },
  try: {
    label: UI_STRINGS.readiness.will_try,
    bg: DesignColors.badgeTryBg,
    text: DesignColors.badgeTryText,
  },
};

function BadgeChip({
  label,
  backgroundColor,
  textColor,
  bordered = true,
  bold = false,
}: {
  label: string;
  backgroundColor: string;
  textColor: string;
  bordered?: boolean;
  bold?: boolean;
}) {
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor },
        bordered ? styles.badgeBordered : null,
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          bold ? styles.badgeTextBold : null,
          { color: textColor },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export function ReadyBadge({ status }: { status: ReadyStatus }) {
  const cfg = READY_CONFIG[status];
  return (
    <BadgeChip
      label={cfg.label}
      backgroundColor={cfg.bg}
      textColor={cfg.text}
    />
  );
}

const GENDER_CONFIG: Record<
  GenderBadgeKey,
  { label: string; bg: string; text: string }
> = {
  male: {
    label: UI_STRINGS.genderBadge.male,
    bg: DesignColors.badgeMaleBg,
    text: DesignColors.badgeMaleText,
  },
  female: {
    label: UI_STRINGS.genderBadge.female,
    bg: DesignColors.badgeFemaleBg,
    text: DesignColors.badgeFemaleText,
  },
};

export function GenderBadge({ gender }: { gender: GenderBadgeKey }) {
  const cfg = GENDER_CONFIG[gender];
  return (
    <BadgeChip
      label={cfg.label}
      backgroundColor={cfg.bg}
      textColor={cfg.text}
      bold
    />
  );
}

export function KeyBadge({ offset }: { offset: number | null }) {
  if (offset === null) return null;
  const label = offset === 0 ? "0" : offset > 0 ? `+${offset}` : `${offset}`;
  return (
    <BadgeChip
      label={`♪ ${label}`}
      backgroundColor={DesignColors.badgeKeyBg}
      textColor={DesignColors.badgeKeyText}
      bordered
    />
  );
}

const DATE_BADGE_CONFIG: Record<
  Exclude<DateRange, null>,
  {
    backgroundColor: string;
    textColor: string;
    bordered?: boolean;
  }
> = {
  today: {
    backgroundColor: DesignColors.dateToday,
    textColor: "#fff",
  },
  week: {
    backgroundColor: DesignColors.dateWeekBg,
    textColor: DesignColors.dateWeekText,
  },
  within15: {
    backgroundColor: DesignColors.dateWithin15Bg,
    textColor: DesignColors.dateWithin15Text,
    bordered: true,
  },
  month: {
    backgroundColor: DesignColors.dateMonthBg,
    textColor: DesignColors.dateMonthText,
    bordered: true,
  },
};

export function DateBadge({ lastSungAt }: { lastSungAt: string | null }) {
  const range = getDateRangeFromLastSungAt(lastSungAt);
  if (!range) return null;

  const cfg = DATE_BADGE_CONFIG[range];
  return (
    <View
      style={[
        styles.dateBadge,
        cfg.bordered ? styles.dateMonthBorder : null,
        { backgroundColor: cfg.backgroundColor },
      ]}
    >
      <Text style={[styles.dateBadgeText, { color: cfg.textColor }]}>
        {UI_STRINGS.sungRecency[range]}
      </Text>
    </View>
  );
}

/** fontSize 11 기준 — 모든 칩 텍스트·박스 높이 통일 */
const BADGE_FONT_SIZE = 11;
const BADGE_LINE_HEIGHT = 14;
const BADGE_VERTICAL_PAD = 3;
const BADGE_BORDER = 1;

/** SongCard 2번째 줄(뱃지 행) 최소 높이 */
export const BADGE_CHIP_MIN_HEIGHT =
  BADGE_LINE_HEIGHT + BADGE_VERTICAL_PAD * 2 + BADGE_BORDER * 2;

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: BADGE_VERTICAL_PAD,
    minHeight: BADGE_LINE_HEIGHT + BADGE_VERTICAL_PAD * 2 + BADGE_BORDER * 2,
    borderRadius: 20,
    borderWidth: BADGE_BORDER,
    borderColor: "transparent",
  },
  badgeBordered: {
    borderColor: DesignColors.bgBorder,
  },
  badgeText: {
    fontSize: BADGE_FONT_SIZE,
    lineHeight: BADGE_LINE_HEIGHT,
    fontWeight: "500",
    textAlign: "center",
    ...(Platform.OS === "android" ? { includeFontPadding: false } : null),
  },
  badgeTextBold: {
    fontWeight: "600",
  },
  dateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  dateBadgeText: {
    fontSize: 11,
  },
  dateMonthBorder: {
    borderWidth: 1,
    borderColor: DesignColors.bgBorder,
  },
});
