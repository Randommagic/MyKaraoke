import { Platform, StyleSheet, Text, View } from "react-native";

import { DesignColors } from "@/components/design/colors";
import type { DateRange, GenderBadgeKey, ReadyStatus } from "@/components/design/types";

const READY_CONFIG: Record<
  ReadyStatus,
  { label: string; bg: string; text: string }
> = {
  none: {
    label: "미정",
    bg: DesignColors.badgeNoneBg,
    text: DesignColors.badgeNoneText,
  },
  done: {
    label: "완창",
    bg: DesignColors.badgeDoneBg,
    text: DesignColors.badgeDoneText,
  },
  practice: {
    label: "연습",
    bg: DesignColors.badgePracBg,
    text: DesignColors.badgePracText,
  },
  try: {
    label: "시도",
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
    label: "남",
    bg: DesignColors.badgeMaleBg,
    text: DesignColors.badgeMaleText,
  },
  female: {
    label: "여",
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

export function KeyBadge({ offset }: { offset: number }) {
  const label = offset === 0 ? "원키" : offset > 0 ? `+${offset}` : `${offset}`;
  return (
    <BadgeChip
      label={`♪ ${label}`}
      backgroundColor={DesignColors.badgeKeyBg}
      textColor={DesignColors.badgeKeyText}
      bordered
    />
  );
}

function getDateRange(lastSungAt: string | null): DateRange {
  if (!lastSungAt) return null;
  const diff = Math.floor(
    (Date.now() - new Date(lastSungAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff === 0) return "today";
  if (diff <= 7) return "week";
  if (diff <= 30) return "month";
  return null;
}

export function DateBadge({ lastSungAt }: { lastSungAt: string | null }) {
  const range = getDateRange(lastSungAt);

  if (!range) {
    return null;
  }
  if (range === "today") {
    return (
      <View style={[styles.dateBadge, { backgroundColor: DesignColors.dateToday }]}>
        <Text style={[styles.dateBadgeText, { color: "#fff" }]}>오늘</Text>
      </View>
    );
  }
  if (range === "week") {
    return (
      <View style={[styles.dateBadge, { backgroundColor: DesignColors.dateWeekBg }]}>
        <Text style={[styles.dateBadgeText, { color: DesignColors.dateWeekText }]}>
          7일 이내
        </Text>
      </View>
    );
  }
  return (
    <View
      style={[
        styles.dateBadge,
        styles.dateMonthBorder,
        { backgroundColor: DesignColors.dateMonthBg },
      ]}
    >
      <Text style={[styles.dateBadgeText, { color: DesignColors.dateMonthText }]}>
        30일 이내
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
    minHeight:
      BADGE_LINE_HEIGHT + BADGE_VERTICAL_PAD * 2 + BADGE_BORDER * 2,
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
