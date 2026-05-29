import type { DateRange } from "@/components/design/types";
import {
  daysSinceLastSung,
  getPrimarySungDate,
} from "@/lib/song-form-helpers";
import { type SungRecencyLabel, UI_STRINGS } from "@/lib/ui-strings";

export type { SungRecencyLabel };

/** `diffDays` 기준 구간 상한 (일) */
export const SUNG_RECENCY_DAY_LIMITS = {
  week: 7,
  within15: 15,
  month: 30,
} as const;

export function ymdFromLastSungAt(lastSungAt: string | null): string | null {
  if (!lastSungAt) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(lastSungAt.trim());
  return match ? match[1] : null;
}

export function diffDaysToDateRange(diffDays: number | null): DateRange {
  if (diffDays === null || diffDays < 0) return null;
  if (diffDays === 0) return "today";
  if (diffDays <= SUNG_RECENCY_DAY_LIMITS.week) return "week";
  if (diffDays <= SUNG_RECENCY_DAY_LIMITS.within15) return "within15";
  if (diffDays <= SUNG_RECENCY_DAY_LIMITS.month) return "month";
  return null;
}

export function getDateRangeFromLastSungAt(
  lastSungAt: string | null,
): DateRange {
  const ymd = ymdFromLastSungAt(lastSungAt);
  if (!ymd) return null;
  return diffDaysToDateRange(daysSinceLastSung(ymd));
}

export function getSungRecencyLabel(range: DateRange): SungRecencyLabel | null {
  if (!range) return null;
  return UI_STRINGS.sungRecency[range];
}

/** 곡 카드용: 가장 최근 부른 날 기준 */
export function getLastSungRecencyLabel(
  sungDates: string[],
): SungRecencyLabel | null {
  const primary = getPrimarySungDate(sungDates);
  if (!primary) return null;
  return getSungRecencyLabel(diffDaysToDateRange(daysSinceLastSung(primary)));
}
