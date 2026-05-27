import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

import { logDebug } from "@/lib/debug-log-buffer";

const WEB_STORAGE_KEY = "@mykaraoke/onboarding/v1";
const NATIVE_FILE_NAME = "mykaraoke-onboarding.json";

type OnboardingState = {
  completed: boolean;
};

function getNativeUri(): string | null {
  const base = FileSystem.documentDirectory;
  if (!base) return null;
  return `${base}${NATIVE_FILE_NAME}`;
}

async function readState(): Promise<OnboardingState | null> {
  if (Platform.OS === "web") {
    try {
      if (typeof localStorage === "undefined") return null;
      const raw = localStorage.getItem(WEB_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as OnboardingState;
    } catch (e) {
      logDebug(
        `[onboarding] web localStorage 읽기 실패: ${String(e)}`,
        "error",
      );
      return null;
    }
  }

  const uri = getNativeUri();
  if (!uri) return null;

  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return JSON.parse(raw) as OnboardingState;
  } catch (e) {
    logDebug(
      `[onboarding] read 실패: ${e instanceof Error ? e.message : String(e)}`,
      "error",
    );
    return null;
  }
}

async function writeState(state: OnboardingState): Promise<void> {
  const json = JSON.stringify(state);

  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(WEB_STORAGE_KEY, json);
    }
    logDebug("[onboarding] web 저장 OK", "info");
    return;
  }

  const uri = getNativeUri();
  if (!uri) {
    throw new Error("documentDirectory를 사용할 수 없습니다.");
  }

  await FileSystem.writeAsStringAsync(uri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  logDebug("[onboarding] native 저장 OK", "info");
}

export async function loadHasCompletedOnboarding(): Promise<boolean> {
  const state = await readState();
  return state?.completed === true;
}

export async function setOnboardingCompleted(): Promise<void> {
  await writeState({ completed: true });
}
