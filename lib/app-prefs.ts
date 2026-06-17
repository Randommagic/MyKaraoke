/**
 * 앱 단순 환경설정 플래그 저장 (1회성 온보딩 상태 등).
 * web: localStorage, native: expo-file-system 파일.
 */
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

import { logDebug } from "@/lib/debug-log-buffer";

const WEB_STORAGE_KEY = "@mykaraoke/prefs/v1";
const NATIVE_FILE_NAME = "mykaraoke-prefs.json";

type AppPrefs = {
  /** 홈 스와이프 힌트 데모를 본 적 있는지 */
  hasSeenSwipeHint: boolean;
};

const DEFAULT_PREFS: AppPrefs = {
  hasSeenSwipeHint: false,
};

function getNativeUri(): string | null {
  const base = FileSystem.documentDirectory;
  if (!base) return null;
  return `${base}${NATIVE_FILE_NAME}`;
}

async function readPrefs(): Promise<AppPrefs> {
  if (Platform.OS === "web") {
    try {
      if (typeof localStorage === "undefined") return DEFAULT_PREFS;
      const raw = localStorage.getItem(WEB_STORAGE_KEY);
      if (!raw) return DEFAULT_PREFS;
      return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<AppPrefs>) };
    } catch (e) {
      logDebug(`[prefs] web 읽기 실패: ${String(e)}`, "error");
      return DEFAULT_PREFS;
    }
  }

  const uri = getNativeUri();
  if (!uri) return DEFAULT_PREFS;

  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return DEFAULT_PREFS;
    const raw = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<AppPrefs>) };
  } catch (e) {
    logDebug(
      `[prefs] read 실패: ${e instanceof Error ? e.message : String(e)}`,
      "error",
    );
    return DEFAULT_PREFS;
  }
}

async function writePrefs(next: AppPrefs): Promise<void> {
  const json = JSON.stringify(next);

  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(WEB_STORAGE_KEY, json);
    }
    return;
  }

  const uri = getNativeUri();
  if (!uri) throw new Error("documentDirectory를 사용할 수 없습니다.");

  await FileSystem.writeAsStringAsync(uri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export async function loadHasSeenSwipeHint(): Promise<boolean> {
  const prefs = await readPrefs();
  return prefs.hasSeenSwipeHint === true;
}

export async function setSwipeHintSeen(): Promise<void> {
  const prefs = await readPrefs();
  if (prefs.hasSeenSwipeHint) return;
  await writePrefs({ ...prefs, hasSeenSwipeHint: true });
  logDebug("[prefs] 스와이프 힌트 본 것으로 저장", "info");
}

export async function resetSwipeHintSeen(): Promise<void> {
  const prefs = await readPrefs();
  await writePrefs({ ...prefs, hasSeenSwipeHint: false });
  logDebug("[prefs] 스와이프 힌트 초기화", "info");
}
