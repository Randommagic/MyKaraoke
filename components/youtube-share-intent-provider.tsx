import { useRouter } from "expo-router";
import {
  ShareIntentProvider,
  useShareIntentContext,
} from "expo-share-intent";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";

import { logDebug } from "@/lib/debug-log-buffer";
import { extractYoutubeUrlFromSharedContent } from "@/lib/youtube-share-intent";

type YoutubeShareContextValue = {
  /** YouTube 앱 공유로 받은 URL (홈에서 소비) */
  pendingUrl: string | null;
  consumePendingUrl: () => void;
};

const YoutubeShareContext = createContext<YoutubeShareContextValue>({
  pendingUrl: null,
  consumePendingUrl: () => {},
});

function YoutubeShareIntentListener({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const { hasShareIntent, shareIntent, resetShareIntent } =
    useShareIntentContext();

  useEffect(() => {
    if (Platform.OS !== "android") return;
    if (!hasShareIntent || !shareIntent) return;

    const url = extractYoutubeUrlFromSharedContent(
      shareIntent.text,
      shareIntent.webUrl,
    );

    resetShareIntent();

    if (!url) {
      logDebug("[share] YouTube URL을 찾지 못함", "warn");
      return;
    }

    logDebug(`[share] YouTube URL 수신: ${url}`, "info");
    setPendingUrl(url);
    router.replace("/(tabs)");
  }, [hasShareIntent, resetShareIntent, router, shareIntent]);

  const consumePendingUrl = useCallback(() => setPendingUrl(null), []);

  const value = useMemo(
    () => ({ pendingUrl, consumePendingUrl }),
    [consumePendingUrl, pendingUrl],
  );

  return (
    <YoutubeShareContext.Provider value={value}>
      {children}
    </YoutubeShareContext.Provider>
  );
}

export function YoutubeShareIntentProvider({ children }: { children: ReactNode }) {
  return (
    <ShareIntentProvider options={{ resetOnBackground: true }}>
      <YoutubeShareIntentListener>{children}</YoutubeShareIntentListener>
    </ShareIntentProvider>
  );
}

export function usePendingYoutubeShareUrl(): YoutubeShareContextValue {
  return useContext(YoutubeShareContext);
}
