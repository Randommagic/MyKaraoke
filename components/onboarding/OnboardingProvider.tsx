import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { OnboardingSlidesModal } from "@/components/onboarding/OnboardingSlidesModal";
import {
  loadHasCompletedOnboarding,
  setOnboardingCompleted,
} from "@/lib/onboarding-storage";

type OnboardingContextValue = {
  showOnboarding: () => void;
  onboardingVisible: boolean;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return ctx;
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const completed = await loadHasCompletedOnboarding();
        if (!cancelled && !completed) {
          setVisible(true);
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const showOnboarding = useCallback(() => {
    setVisible(true);
  }, []);

  const handleFinish = useCallback(() => {
    setVisible(false);
    void setOnboardingCompleted();
  }, []);

  const value = useMemo(
    () => ({
      showOnboarding,
      onboardingVisible: visible,
    }),
    [showOnboarding, visible],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {hydrated ? (
        <OnboardingSlidesModal visible={visible} onFinish={handleFinish} />
      ) : null}
    </OnboardingContext.Provider>
  );
}
