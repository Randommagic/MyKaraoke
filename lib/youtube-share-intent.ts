import { parseYoutubeInput } from "@/lib/youtube-import";

const YOUTUBE_URL_IN_TEXT =
  /https?:\/\/(?:www\.)?(?:youtube\.com\/[^\s<>"']+|youtu\.be\/[^\s<>"']+)/gi;

function isYoutubeImportUrl(raw: string): boolean {
  return parseYoutubeInput(raw.trim()).kind !== "invalid";
}

/** 공유 텍스트·webUrl에서 YouTube 영상/재생목록 URL 하나를 추출합니다. */
export function extractYoutubeUrlFromSharedContent(
  text?: string | null,
  webUrl?: string | null,
): string | null {
  const candidates = [webUrl, text].filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0,
  );

  for (const raw of candidates) {
    const trimmed = raw.trim();
    if (isYoutubeImportUrl(trimmed)) return trimmed;

    for (const match of trimmed.matchAll(YOUTUBE_URL_IN_TEXT)) {
      const url = match[0];
      if (isYoutubeImportUrl(url)) return url;
    }
  }

  return null;
}
