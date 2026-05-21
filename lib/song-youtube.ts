import { Linking } from "react-native";

import {
  normalizeYoutubeUrlForStorage,
  openYoutubeLink,
} from "@/lib/youtube-import";
import type { Song, SongImportSource } from "@/lib/songs-storage";

export function hasPersistedYoutubeLink(url: string): boolean {
  const normalized = normalizeYoutubeUrlForStorage(url);
  return normalized.length > 0 || url.trim().length > 0;
}

/** YouTube 가져오기로 저장된 영상 링크가 있는지 */
export function songHasYoutubeVideoLink(
  song: Pick<Song, "importSource" | "youtubeUrl">,
): boolean {
  return (
    song.importSource === "youtube" && hasPersistedYoutubeLink(song.youtubeUrl)
  );
}

/** 상세 화면에서 노래방 검색(YouTube 검색 결과)으로 열기 */
export function songUsesYoutubeKaraokeSearch(
  song: Pick<Song, "importSource" | "youtubeUrl">,
): boolean {
  return !songHasYoutubeVideoLink(song);
}

/** `importSource !== "youtube"` 이면 저장 링크 제거 */
export function sanitizeSongYoutubeUrl<T extends Pick<Song, "importSource" | "youtubeUrl">>(
  song: T,
): T {
  if (song.importSource === "youtube") return song;
  if (!song.youtubeUrl.trim()) return song;
  return { ...song, youtubeUrl: "" };
}

/** YouTube 가져오기 곡 + 저장된 링크 → 편집 화면에서 unlink만 가능 */
export function isYoutubeImportLinkLocked(
  importSource: SongImportSource,
  persistedUrl: string,
  youtubeUnlinked: boolean,
): boolean {
  return (
    importSource === "youtube" &&
    !youtubeUnlinked &&
    hasPersistedYoutubeLink(persistedUrl)
  );
}

/** 상세 YouTube 버튼 표시 · 영상/검색 공통 (노래방 미포함) */
export function buildYoutubeButtonLabel(artist: string, title: string): string {
  const t = title.trim() || "(제목 없음)";
  const a = artist.trim();
  if (a) return `${a} - ${t}`;
  return t;
}

/** YouTube 검색에만 쓰는 쿼리 — "(가수 - )곡이름 노래방" */
export function buildYoutubeKaraokeSearchQuery(
  artist: string,
  title: string,
): string {
  const label = buildYoutubeButtonLabel(artist, title);
  return `${label} 노래방`;
}

export function buildYoutubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

export async function openYoutubeKaraokeSearch(
  artist: string,
  title: string,
): Promise<boolean> {
  const url = buildYoutubeSearchUrl(
    buildYoutubeKaraokeSearchQuery(artist, title),
  );
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** 상세: 영상 링크 또는 노래방 검색 */
export async function openSongYoutube(
  song: Pick<Song, "importSource" | "youtubeUrl" | "artist" | "title">,
): Promise<boolean> {
  if (songHasYoutubeVideoLink(song)) {
    return openYoutubeLink(song.youtubeUrl);
  }
  return openYoutubeKaraokeSearch(song.artist, song.title);
}
