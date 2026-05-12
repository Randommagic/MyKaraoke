export type LogLevel = "log" | "info" | "warn" | "error" | "debug";

export type LogEntry = {
  id: string;
  t: number;
  level: LogLevel;
  message: string;
};

const MAX_ENTRIES = 600;
let entries: LogEntry[] = [];
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore listener errors */
    }
  });
}

export function subscribeDebugLogs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDebugLogs(): LogEntry[] {
  return entries;
}

function formatArg(arg: unknown): string {
  if (arg === undefined) return "undefined";
  if (arg === null) return "null";
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) {
    return arg.stack ?? arg.message;
  }
  if (typeof arg === "object") {
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

export function appendDebugLog(level: LogLevel, args: unknown[]): void {
  const message = args.map(formatArg).join(" ");
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  entries = [{ id, t: Date.now(), level, message }, ...entries].slice(0, MAX_ENTRIES);
  notify();
}

/** console 외부에서 앱 로그 탭으로 직접 남길 때 사용 */
export function logDebug(message: string, level: LogLevel = "log"): void {
  appendDebugLog(level, [message]);
}

export function clearDebugLogs(): void {
  entries = [];
  notify();
}

let consoleHookInstalled = false;

export function installGlobalConsoleCapture(): void {
  if (consoleHookInstalled || typeof console === "undefined") return;
  consoleHookInstalled = true;

  const levels: LogLevel[] = ["log", "info", "warn", "error", "debug"];

  for (const level of levels) {
    const key = level as keyof Console;
    const orig = console[key];
    if (typeof orig !== "function") continue;
    const fn = orig as (...args: unknown[]) => void;
    (console as unknown as Record<string, (...args: unknown[]) => void>)[key as string] = (
      ...args: unknown[]
    ) => {
      appendDebugLog(level, args);
      fn.apply(console, args);
    };
  }
}

type GlobalHandler = (error: Error, isFatal?: boolean) => void;

let errorUtilsHookInstalled = false;

/** 처리되지 않은 JS 예외를 로그 버퍼에도 남김 */
export function installUnhandledErrorLogging(): void {
  if (errorUtilsHookInstalled) return;
  const g = global as unknown as {
    ErrorUtils?: {
      getGlobalHandler?: () => GlobalHandler;
      setGlobalHandler?: (handler: GlobalHandler) => void;
    };
  };
  const EU = g.ErrorUtils;
  if (!EU?.getGlobalHandler || !EU.setGlobalHandler) return;
  errorUtilsHookInstalled = true;
  const prev = EU.getGlobalHandler();
  EU.setGlobalHandler((error: Error, isFatal?: boolean) => {
    appendDebugLog("error", [
      `[Uncaught${isFatal ? " FATAL" : ""}] ${error.message}`,
      error.stack ?? "",
    ]);
    prev(error, isFatal);
  });
}
