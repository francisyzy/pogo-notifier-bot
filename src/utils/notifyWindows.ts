import { NotifyWindow, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * All notification windows are expressed in this timezone, regardless of
 * where the server runs. The bot is Singapore-only.
 */
export const NOTIFY_TIMEZONE = "Asia/Singapore";

export type NotifyMode = "ALLOW" | "BLOCK";
/** Kind of notification being sent; a window with notifyKind "ALL" matches both */
export type NotifyKind = "RAID" | "PERFECT";

export const ALL_WEEKDAYS = "1,2,3,4,5,6,7";
export const WEEKDAYS_MON_FRI = "1,2,3,4,5";
export const WEEKENDS = "6,7";
export const DAY_START = "00:00";
export const DAY_END = "23:59";

const WEEKDAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Parse a 24h "HH:MM" clock time into minutes after midnight.
 * Accepts "9:00", "09:00", "0900", "9". Returns null if invalid.
 */
export function parseClockTime(input: string): number | null {
  const match = input.trim().match(/^(\d{1,2}):?(\d{2})?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Minutes after midnight -> "HH:MM" */
export function formatClockTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Parse a time range typed by the user, e.g. "12:00-13:00", "18:00 - 23:59", "22:00 to 06:00".
 * Returns "HH:MM" strings ready to store, or null if invalid.
 */
export function parseClockRange(
  input: string,
): { startTime: string; endTime: string } | null {
  const parts = input.trim().split(/\s*(?:-|–|to)\s*/i);
  if (parts.length !== 2) return null;
  const start = parseClockTime(parts[0]);
  const end = parseClockTime(parts[1]);
  if (start === null || end === null) return null;
  return { startTime: formatClockTime(start), endTime: formatClockTime(end) };
}

/** Parse "1,2,3" into a set of ISO weekday numbers (1=Mon … 7=Sun) */
export function parseWeekdays(weekdays: string): Set<number> {
  return new Set(
    weekdays
      .split(",")
      .map((d) => Number(d.trim()))
      .filter((d) => d >= 1 && d <= 7),
  );
}

/** Get the ISO weekday (1=Mon … 7=Sun) and minutes after midnight of `at` in Singapore time */
export function localWeekdayAndMinutes(at: Date): {
  weekday: number;
  minutes: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: NOTIFY_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday")) + 1;
  // Some ICU versions render midnight as "24"
  const hour = Number(get("hour")) % 24;
  return { weekday, minutes: hour * 60 + Number(get("minute")) };
}

/**
 * Is `at` inside this window? Handles windows that wrap past midnight
 * (endTime <= startTime, e.g. 22:00–06:00): the wrapped part counts towards
 * the weekday the window *started* on, so "Fri 22:00–06:00" covers Saturday 03:00.
 */
export function isInsideWindow(window: NotifyWindow, at: Date): boolean {
  const { weekday, minutes } = localWeekdayAndMinutes(at);
  const start = parseClockTime(window.startTime);
  const end = parseClockTime(window.endTime);
  if (start === null || end === null) return false;
  const days = parseWeekdays(window.weekdays);

  if (start < end) {
    return days.has(weekday) && minutes >= start && minutes < end;
  }
  // Wraps past midnight: [start, 24:00) today or [00:00, end) the day after a listed day
  if (minutes >= start) return days.has(weekday);
  const previousDay = weekday === 1 ? 7 : weekday - 1;
  return minutes < end && days.has(previousDay);
}

/**
 * Decide whether a notification may be sent.
 *
 * 1. Only windows for this `kind` (or "ALL") are considered.
 * 2. If the user has windows scoped to this gym, only those are used; otherwise the
 *    user's global windows (gymId null) are used.
 * 3. With any ALLOW windows present: send only if inside an ALLOW window and not inside a BLOCK window.
 *    With only BLOCK windows: send unless inside a BLOCK window.
 * 4. No applicable windows: always send.
 */
export function isNotifyAllowed(
  windows: NotifyWindow[],
  opts: { kind: NotifyKind; gymId?: string | null; at?: Date },
): boolean {
  const at = opts.at ?? new Date();
  const forKind = windows.filter(
    (w) => w.notifyKind === "ALL" || w.notifyKind === opts.kind,
  );
  const gymSpecific = opts.gymId
    ? forKind.filter((w) => w.gymId === opts.gymId)
    : [];
  const applicable =
    gymSpecific.length > 0 ? gymSpecific : forKind.filter((w) => w.gymId === null);
  if (applicable.length === 0) return true;

  const inside = applicable.filter((w) => isInsideWindow(w, at));
  if (inside.some((w) => w.mode === "BLOCK")) return false;
  const hasAllow = applicable.some((w) => w.mode === "ALLOW");
  return !hasAllow || inside.some((w) => w.mode === "ALLOW");
}

/** "Mon–Fri", "Sat, Sun", "Every day" */
export function describeWeekdays(weekdays: string): string {
  const days = [...parseWeekdays(weekdays)].sort((a, b) => a - b);
  if (days.length === 7) return "Every day";
  if (days.join(",") === WEEKDAYS_MON_FRI) return "Mon–Fri";
  if (days.join(",") === WEEKENDS) return "Sat–Sun";
  return days.map((d) => WEEKDAY_NAMES[d]).join(", ");
}

/** One-line human summary of a window, e.g. "🔕 Block · Mon–Fri · 09:00–12:00 · all gyms" */
export function describeWindow(
  window: NotifyWindow & { gym?: { gymString: string | null; geoKey: string | null; id: string } | null },
): string {
  const icon = window.mode === "ALLOW" ? "🔔 Allow" : "🔕 Block";
  const time =
    window.startTime === DAY_START && window.endTime === DAY_END
      ? "all day"
      : `${window.startTime}–${window.endTime}`;
  let scope: string;
  if (window.gym) {
    scope = window.gym.gymString ?? window.gym.geoKey ?? window.gym.id;
  } else if (window.notifyKind === "RAID") {
    scope = "all raids";
  } else if (window.notifyKind === "PERFECT") {
    scope = "perfect Pokémon";
  } else {
    scope = "everything";
  }
  return `${icon} · ${describeWeekdays(window.weekdays)} · ${time} · ${scope}`;
}

/**
 * Fetch the notification windows of several users in one query,
 * grouped by user id. Users with no windows are simply absent from the map.
 */
export async function loadNotifyWindows(
  userTelegramIds: number[],
): Promise<Map<number, NotifyWindow[]>> {
  const byUser = new Map<number, NotifyWindow[]>();
  if (userTelegramIds.length === 0) return byUser;
  const windows = await prisma.notifyWindow.findMany({
    where: { userTelegramId: { in: userTelegramIds } },
  });
  for (const window of windows) {
    const list = byUser.get(window.userTelegramId) ?? [];
    list.push(window);
    byUser.set(window.userTelegramId, list);
  }
  return byUser;
}
