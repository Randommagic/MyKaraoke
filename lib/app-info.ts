import Constants from "expo-constants";

export type AppInfo = {
  name: string;
  version: string;
  /** iOS CFBundleVersion / Android versionCode (네이티브 빌드에서만) */
  buildNumber: string | null;
};

export function getAppInfo(): AppInfo {
  const expo = Constants.expoConfig;
  const buildNumber = Constants.nativeBuildVersion?.trim() || null;

  return {
    name: expo?.name?.trim() || "MyKaraoke",
    version: expo?.version?.trim() || "1.0.0",
    buildNumber,
  };
}

/** 설정 화면 등에 표시할 버전 문자열 */
export function formatAppVersionLabel(info: AppInfo): string {
  if (info.buildNumber && info.buildNumber !== info.version) {
    return `${info.version} (${info.buildNumber})`;
  }
  return info.version;
}
