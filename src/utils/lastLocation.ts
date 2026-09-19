import { PrismaClient } from "@prisma/client";
import { distanceMeters, formatDistance } from "./geo";

const prisma = new PrismaClient();

/** The bit of User that sortByDistance needs */
export type LastLocation = {
  lastLat: number | null;
  lastLong: number | null;
};

/**
 * Remember the last pin a user sent so lists can be sorted by distance.
 * Fire-and-forget: unknown users (no User row yet) are a no-op, and a
 * failure must never break the location handler that called it.
 */
export function rememberLastLocation(
  telegramId: number,
  lat: number,
  lng: number,
): void {
  prisma.user
    .updateMany({
      where: { telegramId },
      data: { lastLat: lat, lastLong: lng, lastLocationAt: new Date() },
    })
    .catch((error) =>
      console.error("Failed to update last location:", error),
    );
}

export function hasLastLocation(
  user: LastLocation | null | undefined,
): user is LastLocation & { lastLat: number; lastLong: number } {
  return user?.lastLat != null && user?.lastLong != null;
}

/**
 * Nearest-first copy of `items` with `distanceMeters` from the user's
 * last pin attached. When no pin is known the items come back as they
 * were (same order, no distance) so callers can render either way.
 */
export function sortByDistance<T extends { lat: number; long: number }>(
  items: T[],
  user: LastLocation | null | undefined,
): (T & { distanceMeters?: number })[] {
  if (!hasLastLocation(user)) return items;
  const { lastLat, lastLong } = user;
  return items
    .map((item) => ({
      ...item,
      distanceMeters: distanceMeters(lastLat, lastLong, item.lat, item.long),
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

/**
 * A user's subscribed gyms, nearest-first with a distance when they have
 * ever sent the bot a pin, else in insertion order without one.
 */
export async function subscribedGymsByDistance(userTelegramId: number) {
  const [user, subscriptions] = await Promise.all([
    prisma.user.findUnique({
      where: { telegramId: userTelegramId },
      select: { lastLat: true, lastLong: true },
    }),
    prisma.gymSubscribe.findMany({
      where: { userTelegramId },
      include: { gym: true },
    }),
  ]);
  return {
    sorted: hasLastLocation(user),
    gyms: sortByDistance(
      subscriptions.map((subscription) => subscription.gym),
      user,
    ),
  };
}

/** " · 350 m" when a distance is known, else "" (keeps button labels short) */
export function distanceSuffix(
  item: { distanceMeters?: number },
): string {
  return item.distanceMeters === undefined
    ? ""
    : ` · ${formatDistance(item.distanceMeters)}`;
}
