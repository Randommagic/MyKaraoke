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

/** 단일 영상 / 재생목록 URL 파싱 (`list=`가 있으면 재생목록 우선) */
export function parseYoutubeInput(raw: string): ParsedYoutubeRef {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: "invalid" };
  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return { kind: "invalid" };
  }

  const list = url.searchParams.get("list");
  if (list && /^[\w-]+$/.test(list) && list.length >= 10) {
    return { kind: "playlist", playlistId: list };
  }

  const host = url.hostname.replace(/^www\./i, "");
  if (host === "youtu.be") {
    const id = url.pathname.replace(/^\//, "").split("/")[0]?.split("?")[0];
    if (id && VIDEO_ID_RE.test(id)) return { kind: "video", videoId: id };
    return { kind: "invalid" };
  }

  if (host.includes("youtube.com")) {
    const v = url.searchParams.get("v");
    if (v && VIDEO_ID_RE.test(v)) return { kind: "video", videoId: v };
    const fromPath = extractVideoIdFromPath(url.pathname);
    if (fromPath && VIDEO_ID_RE.test(fromPath))
      return { kind: "video", videoId: fromPath };
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

function watchUrlFromVideoId(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** 단일 영상: oEmbed */
export async function fetchYoutubeVideoOembed(
  videoId: string,
): Promise<string> {
  const watchUrl = watchUrlFromVideoId(videoId);
  const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
  const res = await fetch(oembed);
  if (!res.ok) {
    throw new Error(
      `영상 정보를 불러오지 못했습니다 (${res.status}). 링크를 확인해 주세요.`,
    );
  }
  const data = (await res.json()) as { title?: string };
  const title = (data.title ?? "").trim();
  return title || watchUrl;
}

async function fetchPlaylistPage(
  playlistId: string,
  apiKey: string,
  pageToken?: string,
): Promise<{
  items: YoutubeImportItem[];
  nextPageToken?: string;
}> {
  const u = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
  u.searchParams.set("part", "snippet,contentDetails");
  u.searchParams.set("maxResults", "50");
  u.searchParams.set("playlistId", playlistId);
  u.searchParams.set("key", apiKey);
  if (pageToken) u.searchParams.set("pageToken", pageToken);

  const res = await fetch(u.toString());
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `재생목록을 불러오지 못했습니다 (${res.status}). 링크를 확인해 주세요.`,
    );
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
    throw new Error("재생목록 응답을 해석하지 못했습니다.");
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

/** 재생목록: YouTube Data API v3 */
export async function fetchPlaylistItems(
  playlistId: string,
  apiKey: string,
  maxItems = 200,
): Promise<YoutubeImportItem[]> {
  const out: YoutubeImportItem[] = [];
  let pageToken: string | undefined;
  while (out.length < maxItems) {
    const { items, nextPageToken } = await fetchPlaylistPage(
      playlistId,
      apiKey,
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

function getYoutubeDataApiKey(): string | null {
  const fromEnv =
    typeof process !== "undefined" &&
    process.env.EXPO_PUBLIC_YOUTUBE_API_KEY?.trim();
  return fromEnv || null;
}

/**
 * URL에 따라 영상 1개 또는 재생목록 전체(최대 200곡) 메타데이터 로드.
 */
export async function loadYoutubeImportItems(
  rawUrl: string,
): Promise<YoutubeImportItem[]> {
  const parsed = parseYoutubeInput(rawUrl);
  if (parsed.kind === "invalid") {
    throw new Error(
      "인식할 수 없는 YouTube 링크입니다. 영상 또는 재생목록 주소를 넣어 주세요.",
    );
  }
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

  const apiKey = getYoutubeDataApiKey();
  if (!apiKey) {
    throw new Error("재생목록을 지금 불러올 수 없습니다.");
  }

  const items = await fetchPlaylistItems(parsed.playlistId, apiKey);
  if (items.length === 0) {
    throw new Error("재생목록에서 가져올 수 있는 공개 영상이 없습니다.");
  }
  return items;
}
