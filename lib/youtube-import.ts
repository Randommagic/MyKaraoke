import { Linking, Platform } from "react-native";

/**
 * 재생목록 import 활성화 여부.
 * false = 모든 환경에서 비활성화 (v1.1에서 프록시 방식으로 재활성화 예정).
 * true로 바꾸고 fetchPlaylistItems() 호출부를 프록시 URL로 교체하면 됨.
 */
export const PLAYLIST_IMPORT_ENABLED = false;

/** 가져오기 실패 시 사용자용 메시지 */
export class YoutubeImportError extends Error {
  readonly kind: "playlist_disabled" | "general";
  constructor(
    message: string,
    kind: "playlist_disabled" | "general" = "general",
  ) {
    super(message);
    this.name = "YoutubeImportError";
    this.kind = kind;
  }
}

/** YouTube에서 가져온 한 곡(미리보기) */
export type YoutubeImportItem = {
  videoId: string;
  title: string;
  /** 표준 watch URL */
  watchUrl: string;
};

export type ParsedYoutubeRef =
  | { kind: "video"; videoId: string }
  | { kind: "playlist"; playlistId: string }
  | { kind: "invalid" };

const VIDEO_ID_RE = /^[\w-]{11}$/;

function extractVideoIdFromPath(pathname: string): string | null {
  const shorts = pathname.match(/\/shorts\/([\w-]{11})(?:\/|$)/);
  if (shorts?.[1]) return shorts[1];
  const embed = pathname.match(/\/embed\/([\w-]{11})(?:\/|$)/);
  if (embed?.[1]) return embed[1];
  const live = pathname.match(/\/live\/([\w-]{11})(?:\/|$)/);
  if (live?.[1]) return live[1];
  return null;
}

/**
 * 단일 영상 / 재생목록 URL 파싱.
 * watch?v=XXX&list=PLyyy 처럼 v=와 list=가 함께 있으면 단일 영상 우선.
 */
export function parseYoutubeInput(raw: string): ParsedYoutubeRef {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: "invalid" };
  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return { kind: "invalid" };
  }

  const host = url.hostname.replace(/^www\./i, "");

  if (host === "youtu.be") {
    const id = url.pathname.replace(/^\//, "").split("/")[0]?.split("?")[0];
    if (id && VIDEO_ID_RE.test(id)) return { kind: "video", videoId: id };
    return { kind: "invalid" };
  }

  if (host.includes("youtube.com")) {
    // v= 우선: watch?v=XXX&list=PLyyy → 단일 영상
    const v = url.searchParams.get("v");
    if (v && VIDEO_ID_RE.test(v)) return { kind: "video", videoId: v };

    const fromPath = extractVideoIdFromPath(url.pathname);
    if (fromPath && VIDEO_ID_RE.test(fromPath))
      return { kind: "video", videoId: fromPath };

    // 영상 ID 없을 때만 재생목록으로 판별
    const list = url.searchParams.get("list");
    if (list && /^[\w-]+$/.test(list) && list.length >= 10) {
      return { kind: "playlist", playlistId: list };
    }
  }

  return { kind: "invalid" };
}

/**
 * 곡에 저장된 YouTube 주소에서 **단일 영상** ID만 추출합니다.
 * 재생목록 전용 URL 등은 `null`입니다. (`watch?v=`·`youtu.be`·shorts 등)
 */
export function extractYoutubeVideoIdFromSongUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./i, "");
  if (host.includes("youtube.com")) {
    const v = url.searchParams.get("v");
    if (v && VIDEO_ID_RE.test(v)) return v;
    const fromPath = extractVideoIdFromPath(url.pathname);
    if (fromPath && VIDEO_ID_RE.test(fromPath)) return fromPath;
    return null;
  }
  if (host === "youtu.be") {
    const id = url.pathname.replace(/^\//, "").split("/")[0]?.split("?")[0];
    if (id && VIDEO_ID_RE.test(id)) return id;
  }
  return null;
}

/** `extractYoutubeVideoIdFromSongUrl` 결과로 썸네일 이미지 URL */
export function youtubeThumbnailUrlFromVideoId(
  videoId: string,
  quality: "hqdefault" | "mqdefault" = "hqdefault",
): string {
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}

export function watchUrlFromVideoId(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** 브라우저/앱에서 열 수 있도록 http(s) 보정 */
export function buildYoutubeOpenUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s.replace(/^\/+/u, "")}`;
}

/** YouTube 앱 deep link 후보 (설치 시 웹보다 우선) */
function youtubeAppUrlCandidates(videoId: string): string[] {
  const candidates = [`vnd.youtube://${videoId}`];
  if (Platform.OS === "ios") {
    candidates.push(`youtube://watch?v=${videoId}`);
  }
  if (Platform.OS === "android") {
    candidates.push(
      `intent://www.youtube.com/watch?v=${videoId}#Intent;package=com.google.android.youtube;scheme=https;end`,
    );
  }
  return candidates;
}

/**
 * YouTube 영상·링크 열기 — 앱 설치 시 YouTube 앱 우선, 없으면 https.
 * @returns 열기 시도 성공 여부
 */
export async function openYoutubeLink(raw: string): Promise<boolean> {
  const trimmed = raw.trim();
  if (!trimmed) return false;

  const videoId = extractYoutubeVideoIdFromSongUrl(trimmed);
  const webUrl = videoId
    ? watchUrlFromVideoId(videoId)
    : buildYoutubeOpenUrl(trimmed);

  const urls =
    videoId && Platform.OS !== "web"
      ? [...youtubeAppUrlCandidates(videoId), webUrl]
      : [webUrl];

  for (const url of urls) {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) continue;
      await Linking.openURL(url);
      return true;
    } catch {
      // 다음 후보 시도
    }
  }

  try {
    await Linking.openURL(webUrl);
    return true;
  } catch {
    return false;
  }
}

/** 저장용: 영상 ID만 남기고 `watch?v=` 형태로 통일. ID를 못 뽑으면 trim만 */
export function normalizeYoutubeUrlForStorage(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const id = extractYoutubeVideoIdFromSongUrl(trimmed);
  if (id) return watchUrlFromVideoId(id);
  return trimmed;
}

/** 목록에 이미 있는 YouTube 영상 ID 집합 */
export function collectYoutubeVideoIdsFromSongs(
  songs: { youtubeUrl: string }[],
): Set<string> {
  const ids = new Set<string>();
  for (const s of songs) {
    const id = extractYoutubeVideoIdFromSongUrl(s.youtubeUrl);
    if (id) ids.add(id);
  }
  return ids;
}

/** 추가 가능한 곡을 위로, 이미 추가된 곡을 아래로 (각 그룹 내 API 순서 유지) */
export function sortYoutubeImportItemsByExisting(
  items: YoutubeImportItem[],
  existingVideoIds: Set<string>,
): YoutubeImportItem[] {
  const addable: YoutubeImportItem[] = [];
  const alreadyAdded: YoutubeImportItem[] = [];
  for (const item of items) {
    if (existingVideoIds.has(item.videoId)) alreadyAdded.push(item);
    else addable.push(item);
  }
  return [...addable, ...alreadyAdded];
}

const YOUTUBE_SERVER_ERROR_MSG =
  "YouTube 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요.";

function parseYoutubeApiErrorBody(text: string): {
  reason: string;
  message: string;
} {
  try {
    const data = JSON.parse(text) as {
      error?: {
        message?: string;
        errors?: { reason?: string }[];
      };
    };
    return {
      reason: data.error?.errors?.[0]?.reason?.trim() ?? "",
      message: data.error?.message?.trim() ?? "",
    };
  } catch {
    return { reason: "", message: "" };
  }
}

function throwOembedFetchError(status: number): never {
  if (status === 401 || status === 403) {
    throw new YoutubeImportError(
      "비공개이거나 볼 수 없는 영상입니다.",
    );
  }
  if (status === 404) {
    throw new YoutubeImportError(
      "영상을 찾을 수 없습니다. 링크가 잘못되었거나 삭제되었을 수 있어요.",
    );
  }
  if (status >= 500) {
    throw new YoutubeImportError(YOUTUBE_SERVER_ERROR_MSG);
  }
  throw new YoutubeImportError(
    "영상 정보를 불러오지 못했습니다. 링크가 올바른지 확인해 주세요.",
  );
}

function throwPlaylistApiError(status: number, text: string): never {
  const { reason } = parseYoutubeApiErrorBody(text);
  const quotaReasons = new Set([
    "quotaExceeded",
    "dailyLimitExceeded",
    "userRateLimitExceeded",
    "rateLimitExceeded",
  ]);

  if (
    status === 429 ||
    status >= 500 ||
    (status === 403 && quotaReasons.has(reason))
  ) {
    throw new YoutubeImportError(YOUTUBE_SERVER_ERROR_MSG);
  }
  if (
    status === 403 &&
    (reason === "playlistForbidden" || reason === "forbidden")
  ) {
    throw new YoutubeImportError(
      "비공개 재생목록이거나 볼 수 없는 목록입니다.",
    );
  }
  if (status === 404 || reason === "playlistNotFound") {
    throw new YoutubeImportError(
      "재생목록을 찾을 수 없습니다. 링크가 잘못되었을 수 있어요.",
    );
  }
  if (status === 400 && (reason === "keyInvalid" || reason === "badRequest")) {
    throw new YoutubeImportError(
      "재생목록을 지금 불러올 수 없습니다. 설정을 확인해 주세요.",
    );
  }
  throw new YoutubeImportError(
    "재생목록을 불러오지 못했습니다. 링크가 올바른지 확인해 주세요.",
  );
}

/** 단일 영상: oEmbed */
export async function fetchYoutubeVideoOembed(
  videoId: string,
): Promise<string> {
  const watchUrl = watchUrlFromVideoId(videoId);
  const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
  const res = await fetch(oembed);
  if (!res.ok) {
    throwOembedFetchError(res.status);
  }
  const data = (await res.json()) as { title?: string };
  const title = (data.title ?? "").trim();
  return title || watchUrl;
}

async function fetchPlaylistPage(
  playlistId: string,
  pageToken?: string,
): Promise<{
  items: YoutubeImportItem[];
  nextPageToken?: string;
}> {
  const u = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
  u.searchParams.set("part", "snippet,contentDetails");
  u.searchParams.set("maxResults", "50");
  u.searchParams.set("playlistId", playlistId);
  if (pageToken) u.searchParams.set("pageToken", pageToken);

  const res = await fetch(u.toString());
  const text = await res.text();
  if (!res.ok) {
    throwPlaylistApiError(res.status, text);
  }
  let data: {
    items?: {
      snippet?: { title?: string };
      contentDetails?: { videoId?: string };
    }[];
    nextPageToken?: string;
  };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    throw new YoutubeImportError(YOUTUBE_SERVER_ERROR_MSG);
  }

  const out: YoutubeImportItem[] = [];
  for (const it of data.items ?? []) {
    const vid = it.contentDetails?.videoId?.trim();
    const title = (it.snippet?.title ?? "").trim();
    if (!vid || !VIDEO_ID_RE.test(vid)) continue;
    if (title === "Deleted video" || title === "Private video") continue;
    out.push({
      videoId: vid,
      title: title || vid,
      watchUrl: watchUrlFromVideoId(vid),
    });
  }
  return { items: out, nextPageToken: data.nextPageToken };
}

/** 재생목록: YouTube Data API v3 (v1.1에서 프록시 방식으로 재활성화 예정) */
export async function fetchPlaylistItems(
  playlistId: string,
  maxItems = 200,
): Promise<YoutubeImportItem[]> {
  const out: YoutubeImportItem[] = [];
  let pageToken: string | undefined;
  while (out.length < maxItems) {
    const { items, nextPageToken } = await fetchPlaylistPage(
      playlistId,
      pageToken,
    );
    for (const row of items) {
      if (out.some((o) => o.videoId === row.videoId)) continue;
      out.push(row);
      if (out.length >= maxItems) return out;
    }
    if (!nextPageToken) break;
    pageToken = nextPageToken;
  }
  return out;
}

/**
 * URL에 따라 영상 1개 또는 재생목록 전체(최대 200곡) 메타데이터 로드.
 */
export async function loadYoutubeImportItems(
  rawUrl: string,
): Promise<YoutubeImportItem[]> {
  const parsed = parseYoutubeInput(rawUrl);
  if (parsed.kind === "invalid") {
    throw new YoutubeImportError(
      "인식할 수 없는 YouTube 링크입니다. 영상 또는 재생목록 주소를 넣어 주세요.",
    );
  }

  try {
    if (parsed.kind === "video") {
      const title = await fetchYoutubeVideoOembed(parsed.videoId);
      return [
        {
          videoId: parsed.videoId,
          title,
          watchUrl: watchUrlFromVideoId(parsed.videoId),
        },
      ];
    }

    // 재생목록 비활성화 (PLAYLIST_IMPORT_ENABLED = false 동안 항상 차단)
    if (!PLAYLIST_IMPORT_ENABLED) {
      throw new YoutubeImportError(
        "재생목록 가져오기는 현재 지원하지 않습니다.",
        "playlist_disabled",
      );
    }

    const items = await fetchPlaylistItems(parsed.playlistId);
    if (items.length === 0) {
      throw new YoutubeImportError(
        "재생목록에서 가져올 수 있는 공개 영상이 없습니다. 비공개 영상만 있을 수 있어요.",
      );
    }
    return items;
  } catch (e) {
    if (e instanceof YoutubeImportError) throw e;
    throw new YoutubeImportError(
      "네트워크 오류가 발생했습니다. 연결을 확인한 뒤 다시 시도해 주세요.",
    );
  }
}
