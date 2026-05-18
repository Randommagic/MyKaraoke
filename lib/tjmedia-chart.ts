import { sanitizeKaraokeDigits } from "@/lib/song-form-helpers";
import { createSongId, type Song } from "@/lib/songs-storage";

const TOP_AND_HOT_ENDPOINT = "https://www.tjmedia.com/legacy/api/topAndHot100";

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
};

function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** endDate = 오늘(로컬), startDate = 그로부터 2주 전 */
export function buildDefaultTjTopAndHotQuery(): TopAndHot100Query {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 14);
  return {
    chartType: "TOP",
    searchStartDate: formatLocalYmd(start),
    searchEndDate: formatLocalYmd(end),
  };
}

export type TjChartSessionCache = {
  items: TjTopChartSongItem[];
  error: string | null;
  searchStartDate: string;
  searchEndDate: string;
};

/** `yyyy-mm-dd` → `yyyy.mm.dd` (표시용) */
export function formatTjChartYmdDisplay(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return ymd.trim();
  return `${m[1]}.${m[2]}.${m[3]}`;
}

export function formatTjChartPeriodSubtitle(
  searchStartDate: string,
  searchEndDate: string,
): string {
  return `${formatTjChartYmdDisplay(searchStartDate)} ~ ${formatTjChartYmdDisplay(searchEndDate)} 사이의 인기차트 100위`;
}

let tjSessionCache: TjChartSessionCache | null = null;
let tjSessionLoad: Promise<void> | null = null;

/** 앱 프로세스 동안 TJ 인기차트 네트워크는 최대 1회 */
export function getTjChartSessionCache(): TjChartSessionCache | null {
  return tjSessionCache;
}

export function ensureTjChartLoadedOnce(): Promise<void> {
  if (tjSessionCache !== null) return Promise.resolve();
  if (tjSessionLoad) return tjSessionLoad;
  tjSessionLoad = (async () => {
    const query = buildDefaultTjTopAndHotQuery();
    try {
      const data = await fetchTopAndHot100(query);
      tjSessionCache = {
        items: topChartItemsFromResponse(data),
        error: null,
        searchStartDate: query.searchStartDate,
        searchEndDate: query.searchEndDate,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      tjSessionCache = {
        items: [],
        error: msg,
        searchStartDate: query.searchStartDate,
        searchEndDate: query.searchEndDate,
      };
    } finally {
      tjSessionLoad = null;
    }
  })();
  return tjSessionLoad;
}

/** 메인 화면 등에서 차트 탭 전에 백그라운드로 1회 로드 시작 */
export function prefetchTjTopChartInBackground(): void {
  void ensureTjChartLoadedOnce();
}

function buildTopAndHotUrl(query: TopAndHot100Query): string {
  const q = new URLSearchParams({
    chartType: query.chartType,
    searchStartDate: query.searchStartDate,
    searchEndDate: query.searchEndDate,
  });
  return `${TOP_AND_HOT_ENDPOINT}?${q.toString()}`;
}

export async function fetchTopAndHot100(
  query: TopAndHot100Query,
): Promise<TjTopAndHot100Response> {
  const url = buildTopAndHotUrl(query);
  const res = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`TJ 차트 요청 실패 (${res.status} ${res.statusText})`);
  }
  const data = (await res.json()) as TjTopAndHot100Response;
  return data;
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
    transposeSemitones: 0,
    importSource: "tj",
  };
}
