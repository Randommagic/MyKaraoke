import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { ConfirmDialog } from "@/components/design/ConfirmDialog";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** 확인 버튼만 표시 */
  alert?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
};

export type ConfirmFn = (options: ConfirmOptions) => void;

const ConfirmDialogContext = createContext<ConfirmFn | null>(null);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    setOptions(next);
  }, []);

  const dismiss = useCallback(() => {
    setOptions(null);
  }, []);

  const handleCancel = useCallback(() => {
    options?.onCancel?.();
    dismiss();
  }, [dismiss, options]);

  const handleConfirm = useCallback(() => {
    const fn = options?.onConfirm;
    dismiss();
    fn?.();
  }, [dismiss, options]);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}
      <ConfirmDialog
        visible={options != null}
        title={options?.title ?? ""}
        message={options?.message}
        confirmLabel={options?.confirmLabel}
        cancelLabel={options?.cancelLabel}
        destructive={options?.destructive}
        alert={options?.alert}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmDialogContext);
  if (!confirm) {
    throw new Error("useConfirm must be used within ConfirmDialogProvider");
  }
  return confirm;
}
