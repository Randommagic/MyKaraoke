import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

import { logDebug } from "@/lib/debug-log-buffer";
import { UI_STRINGS } from "@/lib/ui-strings";
import { normalizeYoutubeUrlForStorage } from "@/lib/youtube-import";
import { sanitizeSongYoutubeUrl } from "@/lib/song-youtube";

/** 웹(localStorage)과 예전 AsyncStorage 키와 동일하게 두어 이전 데이터 호환 */
const WEB_STORAGE_KEY = "@mykaraoke/songs/v1";
const NATIVE_FILE_NAME = "mykaraoke-songs.json";

function getNativeSongsUri(): string | null {
  const base = FileSystem.documentDirectory;
  if (!base) return null;
  return `${base}${NATIVE_FILE_NAME}`;
}

export type SongGenderKey = "male" | "female" | "unset";

/** 곡 연습·완창 준비도 (JSON 필드 `readiness`) */
export type SongReadiness = "none" | "can_full" | "will_try" | "need_practice";

export const SONG_READINESS_OPTIONS: { value: SongReadiness; label: string }[] = [
  { value: "none", label: UI_STRINGS.readiness.none },
  { value: "can_full", label: UI_STRINGS.readiness.can_full },
  { value: "will_try", label: UI_STRINGS.readiness.will_try },
  { value: "need_practice", label: UI_STRINGS.readiness.need_practice },
];

/** 상세 화면 슬라이더 순서: 미정 → 완창 → 연습 → 시도 */
export const READINESS_SLIDER_ORDER: SongReadiness[] = [
  "none",
  "can_full",
  "need_practice",
  "will_try",
];

/** 곡이 앱에 들어온 경로 */
export type SongImportSource = "manual" | "youtube" | "tj";

export const SONG_IMPORT_SOURCE_LABELS: Record<SongImportSource, string> = {
  manual: UI_STRINGS.importSource.manual,
  youtube: UI_STRINGS.importSource.youtube,
  tj: UI_STRINGS.importSource.tj,
};

export type Song = {
  id: string;
  title: string;
  /** 가수 */
  artist: string;
  /** 태진 노래방 곡 번호 (숫자만, 최대 6자리) */
  tjNumber: string;
  /** 금영 노래방 곡 번호 (숫자만, 최대 6자리) */
  kyNumber: string;
  /** 간단 메모 */
  memo: string;
  /** YouTube 영상 링크 (https… 또는 youtu.be 등, 비우면 카드에 버튼 없음) */
  youtubeUrl: string;
  /** 부른 날 `YYYY-MM-DD` (최신순, 최대 {@link MAX_SUNG_DATES}개) */
  sungDates: string[];
  /** 연습·완창 준비도 */
  readiness: SongReadiness;
  genderKey: SongGenderKey;
  /**
   * 반음 단위: 양수면 키 업, 음수면 키 다운, 0이면 원키.
   * `null`이면 아직 정하지 않음(미정).
   */
  transposeSemitones: number | null;
  /** 추가·가져오기 경로 */
  importSource: SongImportSource;
};

export const MAX_SUNG_DATES = 2;

/** 곡 메모 최대 글자 수 */
export const MAX_SONG_MEMO_LENGTH = 200;

export function clampSongMemo(text: string): string {
  return text.slice(0, MAX_SONG_MEMO_LENGTH);
}

export function createSongId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** YouTube 가져오기로 채울 기본 필드만 있는 새 곡 */
export function createSongFromYoutubeImport(
  title: string,
  youtubeWatchUrl: string,
): Song {
  return {
    id: createSongId(),
    title: title.trim() || "(제목 없음)",
    artist: "",
    tjNumber: "",
    kyNumber: "",
    memo: "",
    youtubeUrl: normalizeYoutubeUrlForStorage(youtubeWatchUrl),
    sungDates: [],
    readiness: "none",
    genderKey: "unset",
    transposeSemitones: null,
    importSource: "youtube",
  };
}

function normalizeImportSource(value: unknown): SongImportSource {
  if (value === "manual" || value === "youtube" || value === "tj") return value;
  return "manual";
}

function normalizeGender(value: unknown): SongGenderKey {
  if (value === "male" || value === "female" || value === "unset") return value;
  return "unset";
}

/**
 * 음정 정규화. 숫자면 ±12로 clamp 후 정수화(기존 데이터의 0은 그대로 원키 유지),
 * 숫자가 아니면(신규 곡 등) `null`(미정).
 */
function normalizeTranspose(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(-12, Math.min(12, Math.round(value)));
  }
  return null;
}

function normalizeReadiness(value: unknown): SongReadiness {
  if (
    value === "none" ||
    value === "can_full" ||
    value === "will_try" ||
    value === "need_practice"
  ) {
    return value;
  }
  return "none";
}

function readString(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  return typeof v === "string" ? v : "";
}

/** 숫자만 남기고 최대 6자리 */
function normalizeKaraokeNumber(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

/** `YYYY-MM-DD` 형태만 허용 (앞 10자만 사용해 ISO 문자열도 수용) */
export function normalizeSungDateYmd(value: string): string {
  const s = value.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return "";
}

/** 저장·로드용: 유효 날짜만, 최신순, 최대 2개. 예전 `lastSungAt` 단일 필드도 흡수 */
export function normalizeSungDates(
  value: unknown,
  legacyLastSungAt?: string,
): string[] {
  const raw: string[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") raw.push(item);
    }
  }
  const legacy = normalizeSungDateYmd(legacyLastSungAt ?? "");
  if (legacy) raw.push(legacy);

  const valid = raw
    .map((d) => normalizeSungDateYmd(d))
    .filter((d) => d.length > 0);
  const unique = [...new Set(valid)];
  unique.sort((a, b) => b.localeCompare(a));
  return unique.slice(0, MAX_SUNG_DATES);
}

/** 홈 스와이프: 오늘 부름 추가/취소 (취소 시 이전 날짜가 다시 표시됨) */
export function toggleSungTodayInDates(
  sungDates: string[],
  todayYmd: string,
): string[] {
  const today = normalizeSungDateYmd(todayYmd);
  if (!today) return normalizeSungDates(sungDates);

  const current = normalizeSungDates(sungDates);
  if (current.includes(today)) {
    return current.filter((d) => d !== today);
  }
  return [today, ...current.filter((d) => d !== today)].slice(0, MAX_SUNG_DATES);
}

async function readRawJson(options?: { silent?: boolean }): Promise<string | null> {
  const silent = options?.silent === true;
  if (Platform.OS === "web") {
    try {
      if (typeof localStorage === "undefined") return null;
      return localStorage.getItem(WEB_STORAGE_KEY);
    } catch (e) {
      if (!silent) {
        logDebug(`[storage] web localStorage 읽기 실패: ${String(e)}`, "error");
      }
      return null;
    }
  }
  const uri = getNativeSongsUri();
  if (!uri) {
    if (!silent) {
      logDebug("[storage] documentDirectory 없음 → songs URI 생성 불가", "error");
    }
    return null;
  }
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      if (!silent) {
        logDebug(`[storage] 파일 없음: ${uri}`, "info");
      }
      return null;
    }
    const raw = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    if (!silent) {
      logDebug(`[storage] 읽기 OK (${raw.length}자) ${uri}`, "info");
    }
    return raw;
  } catch (e) {
    if (!silent) {
      logDebug(
        `[storage] read 실패: ${e instanceof Error ? e.message : String(e)}`,
        "error",
      );
    }
    return null;
  }
}

async function writeRawJson(json: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(WEB_STORAGE_KEY, json);
    }
    logDebug(`[storage] web 저장 OK (${json.length}자)`, "info");
    return;
  }
  const uri = getNativeSongsUri();
  if (!uri) {
    const msg = "documentDirectory를 사용할 수 없습니다.";
    logDebug(`[storage] ${msg}`, "error");
    throw new Error(msg);
  }
  await FileSystem.writeAsStringAsync(uri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  logDebug(`[storage] 쓰기 OK (${json.length}자) ${uri}`, "info");
}

/** 백업·가져오기 등 JSON 배열(또는 그에 해당하는 unknown) → `Song[]` */
export function parseSongsFromUnknown(parsed: unknown): Song[] {
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((row): row is Record<string, unknown> => {
      if (!row || typeof row !== "object") return false;
      const id = (row as { id?: unknown }).id;
      return id !== undefined && id !== null && String(id).length > 0;
    })
    .map((row) => {
      const importSource = normalizeImportSource(
        (row as Record<string, unknown>).importSource,
      );
      const rawYoutube =
        readString(row, "youtubeUrl") || readString(row, "youtubeLink");
      const youtubeUrl =
        importSource === "youtube"
          ? normalizeYoutubeUrlForStorage(rawYoutube)
          : "";
      return sanitizeSongYoutubeUrl({
        id: String((row as { id: unknown }).id),
        title: typeof row.title === "string" ? row.title : "",
        artist: readString(row, "artist"),
        tjNumber: normalizeKaraokeNumber(
          readString(row, "tjNumber") || readString(row, "taejinNumber"),
        ),
        kyNumber: normalizeKaraokeNumber(
          readString(row, "kyNumber") || readString(row, "kumyoungNumber"),
        ),
        memo: clampSongMemo(readString(row, "memo")),
        youtubeUrl,
        sungDates: normalizeSungDates(
          (row as Record<string, unknown>).sungDates,
          readString(row, "lastSungAt") || readString(row, "lastSungDate"),
        ),
        readiness: normalizeReadiness(
          (row as Record<string, unknown>).readiness,
        ),
        genderKey: normalizeGender(row.genderKey),
        transposeSemitones: normalizeTranspose(row.transposeSemitones),
        importSource,
      });
    });
}

function parseSongs(raw: string | null): Song[] {
  if (!raw) return [];
  try {
    return parseSongsFromUnknown(JSON.parse(raw) as unknown);
  } catch (e) {
    logDebug(`[storage] JSON 파싱 실패: ${String(e)}`, "error");
    return [];
  }
}

export async function loadSongs(): Promise<Song[]> {
  try {
    const raw = await readRawJson();
    const list = parseSongs(raw);
    logDebug(`[storage] loadSongs 완료: ${list.length}곡`, "info");
    return list;
  } catch (e) {
    logDebug(
      `[storage] loadSongs 예외: ${e instanceof Error ? e.stack ?? e.message : String(e)}`,
      "error",
    );
    return [];
  }
}

export async function saveSongs(songs: Song[]): Promise<void> {
  const json = JSON.stringify(songs);
  logDebug(`[storage] saveSongs 시작: ${songs.length}곡, ${json.length} bytes`, "info");
  try {
    await writeRawJson(json);
    logDebug("[storage] saveSongs 완료", "info");
  } catch (e) {
    logDebug(
      `[storage] saveSongs 실패: ${e instanceof Error ? e.stack ?? e.message : String(e)}`,
      "error",
    );
    throw e;
  }
}

/** 설정: 전체 곡 데이터 삭제 (빈 배열로 저장) */
export async function resetAllSongs(): Promise<void> {
  await saveSongs([]);
  logDebug("[storage] resetAllSongs 완료", "info");
}

/** 설정 > 로그에서 호출: 파일 API·경로 점검 (곡 데이터는 바꾸지 않음) */
export async function runStorageDiagnostics(): Promise<string[]> {
  const lines: string[] = [];
  const line = (s: string) => {
    lines.push(s);
    logDebug(`[diag] ${s}`, "info");
  };

  line(`Platform: ${Platform.OS}`);
  if (Platform.OS === "web") {
    try {
      const has = typeof localStorage !== "undefined";
      line(`localStorage 사용 가능: ${has}`);
      if (has) {
        const raw = localStorage.getItem(WEB_STORAGE_KEY);
        line(`키 ${WEB_STORAGE_KEY} 길이: ${raw?.length ?? 0}`);
      }
    } catch (e) {
      line(`localStorage 점검 오류: ${String(e)}`);
    }
    return lines;
  }

  line(`documentDirectory: ${String(FileSystem.documentDirectory)}`);
  const songsUri = getNativeSongsUri();
  line(`songsUri: ${String(songsUri)}`);
  if (!songsUri) {
    line("ERROR: songsUri null");
    return lines;
  }

  try {
    const info = await FileSystem.getInfoAsync(songsUri);
    line(`곡 파일 exists: ${info.exists}, size: ${"size" in info ? String(info.size) : "?"}`);
  } catch (e) {
    line(`getInfoAsync(곡) 오류: ${String(e)}`);
  }

  const base = FileSystem.documentDirectory;
  if (base) {
    const testUri = `${base}mykaraoke-diag.tmp`;
    try {
      await FileSystem.writeAsStringAsync(testUri, "diag-ok", {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const readBack = await FileSystem.readAsStringAsync(testUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      line(`임시 파일 쓰기/읽기: ${readBack === "diag-ok" ? "OK" : "FAIL"}`);
      await FileSystem.deleteAsync(testUri, { idempotent: true });
    } catch (e) {
      line(`임시 파일 테스트 실패: ${String(e)}`);
    }
  }

  return lines;
}

/** 설정 > 로그: 저장소에 들어 있는 JSON 원문(또는 예쁘게 포맷) 조회만, 로그는 최소화 */
export async function readRawSongsStorageForDebug(): Promise<{
  pathLabel: string;
  raw: string | null;
  formatted: string;
}> {
  const pathLabel =
    Platform.OS === "web"
      ? `localStorage → ${WEB_STORAGE_KEY}`
      : (getNativeSongsUri() ?? "(documentDirectory 없음)");
  const raw = await readRawJson({ silent: true });
  if (raw == null || raw === "") {
    return {
      pathLabel,
      raw: null,
      formatted: "(저장된 내용 없음 — 파일이 없거나 비어 있습니다.)",
    };
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    const formatted = JSON.stringify(parsed, null, 2);
    return { pathLabel, raw, formatted };
  } catch {
    return {
      pathLabel,
      raw,
      formatted: `(JSON 파싱 실패, 원문 표시)\n\n${raw}`,
    };
  }
}
