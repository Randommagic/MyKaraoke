import * as Clipboard from "expo-clipboard";

import { logDebug } from "@/lib/debug-log-buffer";
import {
  loadSongs,
  parseSongsFromUnknown,
  saveSongs,
  type Song,
} from "@/lib/songs-storage";

export const SONGS_BACKUP_VERSION = 1;

export type SongsBackupPayload = {
  version: typeof SONGS_BACKUP_VERSION;
  exportedAt: string;
  songs: Song[];
};

export class SongsBackupError extends Error {
  constructor(
    message: string,
    readonly code:
      | "empty_clipboard"
      | "invalid_base64"
      | "invalid_json"
      | "invalid_format"
      | "no_songs",
  ) {
    super(message);
    this.name = "SongsBackupError";
  }
}

function utf8StringToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return globalThis.btoa(binary);
}

function base64ToUtf8String(base64: string): string {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function encodeSongsBackupToBase64(songs: Song[]): string {
  const payload: SongsBackupPayload = {
    version: SONGS_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    songs,
  };
  return utf8StringToBase64(JSON.stringify(payload));
}

function extractSongRowsFromParsedJson(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const songs = (parsed as { songs?: unknown }).songs;
    if (Array.isArray(songs)) return songs;
  }
  throw new SongsBackupError(
    "백업 형식을 인식할 수 없습니다.",
    "invalid_format",
  );
}

export function decodeSongsFromBase64(encoded: string): Song[] {
  const trimmed = encoded.trim();
  if (!trimmed) {
    throw new SongsBackupError(
      "클립보드가 비어 있습니다.",
      "empty_clipboard",
    );
  }

  let jsonText: string;
  try {
    jsonText = base64ToUtf8String(trimmed);
  } catch {
    throw new SongsBackupError(
      "Base64 데이터가 올바르지 않습니다.",
      "invalid_base64",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText) as unknown;
  } catch {
    throw new SongsBackupError(
      "복원할 JSON을 읽을 수 없습니다.",
      "invalid_json",
    );
  }

  const rows = extractSongRowsFromParsedJson(parsed);
  const songs = parseSongsFromUnknown(rows);
  if (songs.length === 0) {
    throw new SongsBackupError(
      "불러올 수 있는 곡이 없습니다.",
      "no_songs",
    );
  }
  return songs;
}

export async function copySongsBackupToClipboard(): Promise<{
  songCount: number;
  encodedLength: number;
}> {
  const songs = await loadSongs();
  const encoded = encodeSongsBackupToBase64(songs);
  await Clipboard.setStringAsync(encoded);
  logDebug(
    `[backup]보내기: ${songs.length}곡, base64 ${encoded.length}자`,
    "info",
  );
  return { songCount: songs.length, encodedLength: encoded.length };
}

export async function importSongsFromClipboardBase64(): Promise<{
  songCount: number;
  previousCount: number;
}> {
  const encoded = await Clipboard.getStringAsync();
  const songs = decodeSongsFromBase64(encoded);
  const previous = await loadSongs();
  await saveSongs(songs);
  logDebug(
    `[backup]불러오기: ${songs.length}곡 (이전 ${previous.length}곡 교체)`,
    "info",
  );
  return { songCount: songs.length, previousCount: previous.length };
}

export function songsBackupErrorMessage(error: unknown): string {
  if (error instanceof SongsBackupError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "불러오기에 실패했습니다.";
}
