import { Ionicons } from "@expo/vector-icons";

import {
  normalizeSungDates,
  type Song,
  type SongGenderKey,
  type SongReadiness,
} from "@/lib/songs-storage";

export const GENDER_OPTIONS: { value: SongGenderKey; label: string }[] = [
  { value: "unset", label: "미정" },
  { value: "male", label: "남키" },
  { value: "female", label: "여키" },
];

export const READINESS_VISUAL: Record<
  SongReadiness,
  { icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  none: { icon: "ellipse-outline", color: "#9e9e9e" },
  can_full: { icon: "checkmark-circle", color: "#2e7d32" },
  need_practice: { icon: "school-outline", color: "#ef6c00" },
  will_try: { icon: "flag-outline", color: "#c62828" },
};

export function formatTranspose(semitones: number): string {
  const t = Math.max(-12, Math.min(12, semitones));
  if (t === 0) return "원키";
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

/** 브라우저/앱에서 열 수 있도록 http(s) 보정 */
export function buildYoutubeOpenUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s.replace(/^\/+/u, "")}`;
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

export type LastSungRecencyLabel = "오늘" | "7일 이내" | "30일 이내";

/** 곡 카드용: 가장 최근 부른 날 기준 */
export function getLastSungRecencyLabel(
  sungDates: string[],
): LastSungRecencyLabel | null {
  const primary = getPrimarySungDate(sungDates);
  if (!primary) return null;
  const diffDays = daysSinceLastSung(primary);
  if (diffDays === null || diffDays < 0) return null;
  if (diffDays === 0) return "오늘";
  if (diffDays <= 7) return "7일 이내";
  if (diffDays <= 30) return "30일 이내";
  return null;
}

export function formatLastSungLine(ymd: string): string {
  const s = ymd.trim();
  if (!s) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return `마지막: ${s}`;

  const diffDays = daysSinceLastSung(s);
  if (diffDays === null) return `마지막: ${s}`;

  const dotted = `${m[1]}.${m[2]}.${m[3]}`;
  if (diffDays === 0) return `오늘 (${dotted})`;
  if (diffDays > 0) return `${diffDays}일 전 (${dotted})`;
  return `${-diffDays}일 후 (${dotted})`;
}

/** 상세 화면: 저장된 부른 날(최대 2개) 요약 */
export function formatSungDatesLine(sungDates: string[]): string {
  const dates = normalizeSungDates(sungDates);
  if (dates.length === 0) return "";
  return dates.map((d) => formatLastSungLine(d)).join(" · ");
}
