import { logDebug } from "@/lib/debug-log-buffer";
import { localYmd, sanitizeKaraokeDigits, YMD_CAPTURE_RE } from "@/lib/song-form-helpers";
import { createSongId, type Song } from "@/lib/songs-storage";

const TOP_AND_HOT_ENDPOINT = "https://www.tjmedia.com/legacy/api/topAndHot100";

/** `strType` 쿼리 — 1 가요, 2 POP, 3 JPOP, 4 발라드, 5 댄스, 6 트로트 */
export type TjChartStrType = 1 | 2 | 3 | 4 | 5 | 6;

export const TJ_CHART_CATEGORY_OPTIONS: readonly {
  id: "all" | TjChartStrType;
  label: string;
  strType?: TjChartStrType;
}[] = [
  { id: "all", label: "전체" },
  { id: 1, label: "가요", strType: 1 },
  { id: 2, label: "POP", strType: 2 },
  { id: 3, label: "JPOP", strType: 3 },
  { id: 4, label: "발라드", strType: 4 },
  { id: 5, label: "댄스", strType: 5 },
  { id: 6, label: "트로트", strType: 6 },
];

/** `resultData.items` 원소 형태 */
export interface TjTopChartSongItem {
  rank: string;
  pro: number;
  indexTitle: string;
  indexSong: string;
  word: string;
  com: string;
  icongubun: string;
  mv_yn: string;
  imgthumb_path: string;
}

export interface TjTopChartResultData {
  itemsTotalCount: number;
  items: TjTopChartSongItem[];
}

/** topAndHot100 응답 상위(일부 필드만 타입화) */
export interface TjTopAndHot100Response {
  resultCode?: string;
  resultMsg?: string;
  resultData?: TjTopChartResultData;
}

export type TopAndHot100Query = {
  chartType: string;
  searchStartDate: string;
  searchEndDate: string;
  /** 없으면 전체 TOP100 */
  strType?: TjChartStrType;
};

/** endDate = 오늘(로컬), startDate = 그로부터 2주 전 */
export function buildDefaultTjTopAndHotQuery(
  strType?: TjChartStrType,
): TopAndHot100Query {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 14);
  const base: TopAndHot100Query = {
    chartType: "TOP",
    searchStartDate: localYmd(start),
    searchEndDate: localYmd(end),
  };
  if (strType != null) {
    base.strType = strType;
  }
  return base;
}

export type TjChartSessionCache = {
  items: TjTopChartSongItem[];
  error: string | null;
  searchStartDate: string;
  searchEndDate: string;
  strType?: TjChartStrType;
};

export function getTjChartCategoryLabel(strType?: TjChartStrType): string {
  if (strType == null) return "전체";
  return (
    TJ_CHART_CATEGORY_OPTIONS.find((o) => o.strType === strType)?.label ??
    "전체"
  );
}

function tjChartCacheKey(strType?: TjChartStrType): string {
  return strType == null ? "all" : String(strType);
}

/** `yyyy-mm-dd` → `yyyy.mm.dd` (표시용) */
export function formatTjChartYmdDisplay(ymd: string): string {
  const m = YMD_CAPTURE_RE.exec(ymd.trim());
  if (!m) return ymd.trim();
  return `${m[1]}.${m[2]}.${m[3]}`;
}

export function formatTjChartPeriodSubtitle(
  searchStartDate: string,
  searchEndDate: string,
  strType?: TjChartStrType,
): string {
  const period = `${formatTjChartYmdDisplay(searchStartDate)} ~ ${formatTjChartYmdDisplay(searchEndDate)}`;
  const category = getTjChartCategoryLabel(strType);
  if (strType == null) {
    return `${period} 전체 인기차트 100위`;
  }
  return `${period} ${category} 인기차트 100위`;
}

const tjSessionCacheByKey = new Map<string, TjChartSessionCache>();
const tjSessionLoadByKey = new Map<string, Promise<void>>();

export function getTjChartSessionCache(
  strType?: TjChartStrType,
): TjChartSessionCache | null {
  return tjSessionCacheByKey.get(tjChartCacheKey(strType)) ?? null;
}

export function ensureTjChartLoaded(strType?: TjChartStrType): Promise<void> {
  const key = tjChartCacheKey(strType);
  if (tjSessionCacheByKey.has(key)) return Promise.resolve();

  const existing = tjSessionLoadByKey.get(key);
  if (existing) return existing;

  const load = (async () => {
    const query = buildDefaultTjTopAndHotQuery(strType);
    try {
      const data = await fetchTopAndHot100(query);
      tjSessionCacheByKey.set(key, {
        items: topChartItemsFromResponse(data),
        error: null,
        searchStartDate: query.searchStartDate,
        searchEndDate: query.searchEndDate,
        strType,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logDebug(`[chart] TJ 차트 로드 실패 (${key}): ${msg}`, "error");
    } finally {
      tjSessionLoadByKey.delete(key);
    }
  })();

  tjSessionLoadByKey.set(key, load);
  return load;
}

/** @deprecated `ensureTjChartLoaded()` 사용 */
export function ensureTjChartLoadedOnce(): Promise<void> {
  return ensureTjChartLoaded();
}

/** 메인 화면 등에서 차트 탭 전에 백그라운드로 전체 차트 1회 로드 */
export function prefetchTjTopChartInBackground(): void {
  void ensureTjChartLoaded();
}

function buildTopAndHotUrl(query: TopAndHot100Query): string {
  const q = new URLSearchParams({
    chartType: query.chartType,
    searchStartDate: query.searchStartDate,
    searchEndDate: query.searchEndDate,
  });
  if (query.strType != null) {
    q.set("strType", String(query.strType));
  }
  return `${TOP_AND_HOT_ENDPOINT}?${q.toString()}`;
}

export async function fetchTopAndHot100(
  query: TopAndHot100Query,
): Promise<TjTopAndHot100Response> {
  const url = buildTopAndHotUrl(query);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`TJ 차트 요청 실패 (${res.status} ${res.statusText})`);
    }
    const data = (await res.json()) as TjTopAndHot100Response;
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export function topChartItemsFromResponse(
  data: TjTopAndHot100Response,
): TjTopChartSongItem[] {
  const items = data.resultData?.items;
  return Array.isArray(items) ? items : [];
}

/** TJ 차트 한 줄 → 앱 `Song` (제목·가수·TJ 번호만 채움) */
export function songFromTjChartItem(item: TjTopChartSongItem): Song {
  return {
    id: createSongId(),
    title: item.indexTitle.trim() || "(제목 없음)",
    artist: item.indexSong.trim(),
    tjNumber: sanitizeKaraokeDigits(String(item.pro)),
    kyNumber: "",
    memo: "",
    youtubeUrl: "",
    sungDates: [],
    readiness: "none",
    genderKey: "unset",
    transposeSemitones: null,
    importSource: "tj",
  };
}
