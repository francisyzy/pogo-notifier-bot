import { format } from "util";
import { describeError, isTransientError } from "./http";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function thresholdFromEnv(): number {
  const level = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
  return LEVELS[level] ?? LEVELS.info;
}

// Read on first use, after config.ts has run dotenv
let threshold: number | undefined;

// Singapore has no DST, so a fixed +8h shift is exact and avoids an
// Intl formatter on every line
const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;

/** "2026-09-30 06:13:00.021", wall-clock SGT */
export function sgtTimestamp(date = new Date()): string {
  return new Date(date.getTime() + SGT_OFFSET_MS)
    .toISOString()
    .replace("T", " ")
    .slice(0, 23);
}

function write(level: LogLevel, scope: string, args: unknown[]): void {
  // Network/upstream failures are routine (SGPokeMap Cloudflare pages,
  // timeouts); a stack trace per occurrence buried real errors, so they
  // print as one WARN line
  const errors = args.filter((a) => a instanceof Error);
  if (errors.length > 0 && errors.every(isTransientError)) {
    if (level === "error") level = "warn";
    args = args.map((a) => (a instanceof Error ? describeError(a) : a));
  }
  threshold ??= thresholdFromEnv();
  if (LEVELS[level] < threshold) return;
  const line = `${sgtTimestamp()} ${level
    .toUpperCase()
    .padEnd(5)} [${scope}] ${format(...args)}`;
  // warn/error to stderr so pm2 keeps filing them in the error log
  if (LEVELS[level] >= LEVELS.warn) process.stderr.write(line + "\n");
  else process.stdout.write(line + "\n");
}

export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

/**
 * Logger for one module; every line carries an SGT timestamp, the
 * level and `[scope]`. `LOG_LEVEL` (debug/info/warn/error, default
 * info) sets the minimum level printed.
 */
export function createLogger(scope: string): Logger {
  return {
    debug: (...args) => write("debug", scope, args),
    info: (...args) => write("info", scope, args),
    warn: (...args) => write("warn", scope, args),
    error: (...args) => write("error", scope, args),
  };
}
