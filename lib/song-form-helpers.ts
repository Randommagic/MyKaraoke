import { Ionicons } from "@expo/vector-icons";

import { DesignColors } from "@/components/design/colors";
import {
  normalizeSungDates,
  type Song,
  type SongGenderKey,
  type SongReadiness,
} from "@/lib/songs-storage";
import { UI_STRINGS } from "@/lib/ui-strings";

export const GENDER_OPTIONS: { value: SongGenderKey; label: string }[] = [
  { value: "unset", label: UI_STRINGS.gender.unset },
  { value: "male", label: UI_STRINGS.gender.male },
  { value: "female", label: UI_STRINGS.gender.female },
];

export const READINESS_VISUAL: Record<
  SongReadiness,
  { icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  none: { icon: "ellipse-outline", color: DesignColors.badgeNoneText },
  can_full: { icon: "checkmark-circle", color: DesignColors.badgeDoneText },
  need_practice: { icon: "school-outline", color: DesignColors.badgePracText },
  will_try: { icon: "flag-outline", color: DesignColors.badgeTryText },
};

export function formatTranspose(semitones: number): string {
  const t = Math.max(-12, Math.min(12, semitones));
  if (t === 0) return UI_STRINGS.key.original;
  if (t > 0) return `+${t}키`;
  return `${t}키`;
}

/** 목록 카드: 변조 없으면 `null`(표시 생략), 아니면 `+1키` / `-2키` */
export function formatTransposeForSongCard(semitones: number): string | null {
  const t = Math.max(-12, Math.min(12, semitones));
  if (t === 0) return null;
  if (t > 0) return `+${t}키`;
  return `${t}키`;
}

export function sanitizeKaraokeDigits(text: string): string {
  return text.replace(/\D/g, "").slice(0, 6);
}

/** 메모 목록 한 줄: 가수 있으면 `가수 - 제목`, 없으면 제목만 */
export function formatSongListTitleLine(song: Song): string {
  const artist = (song.artist ?? "").trim();
  const title = (song.title ?? "").trim();
  if (artist.length > 0) {
    return title.length > 0 ? `${artist} - ${title}` : artist;
  }
  return title.length > 0 ? title : "(제목 없음)";
}

export function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 가장 최근 부른 날 (카드·라벨 표시용) */
export function getPrimarySungDate(sungDates: string[]): string {
  return normalizeSungDates(sungDates)[0] ?? "";
}

export function isSungToday(sungDates: string[]): boolean {
  const today = localYmd(new Date());
  return normalizeSungDates(sungDates).includes(today);
}

/** 오늘 기준 며칠 전에 불렀는지. 유효하지 않으면 `null` */
export function daysSinceLastSung(ymd: string): number | null {
  const s = ymd.trim();
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mon = Number(m[2]) - 1;
  const day = Number(m[3]);
  const sungStart = new Date(y, mon, day);
  if (Number.isNaN(sungStart.getTime())) return null;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((todayStart.getTime() - sungStart.getTime()) / 86400000);
}

/** YYYY-MM-DD → YYYY.MM.DD 변환 (파싱 불가 시 입력값 반환) */
export function formatYmdDotted(ymd: string): string {
  const s = ymd.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : s;
}

export function formatLastSungLine(ymd: string): string {
  const s = ymd.trim();
  if (!s) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return `마지막: ${s}`;

  const diffDays = daysSinceLastSung(s);
  if (diffDays === null) return `마지막: ${s}`;

  const dotted = formatYmdDotted(s);
  if (diffDays === 0) return `${UI_STRINGS.sungRecency.today} (${dotted})`;
  if (diffDays > 0) return `${diffDays}일 전 (${dotted})`;
  return `${-diffDays}일 후 (${dotted})`;
}

/** 상세 화면: 저장된 부른 날(최대 2개) 요약 */
export function formatSungDatesLine(sungDates: string[]): string {
  const dates = normalizeSungDates(sungDates);
  if (dates.length === 0) return "";
  return dates.map((d) => formatLastSungLine(d)).join(" · ");
}
