import { PrismaClient } from "@prisma/client";
import { raids } from "../types";
import { GYM_CONFIG } from "../constants";

const prisma = new PrismaClient();

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function geoKeyFromLatLng(lat: number, lng: number): string {
  return `${roundTo(lat, 4)}|${roundTo(lng, 4)}`;
}

// Upserts per $transaction batch. Busy raid days list ~2000 raids and
// firing them all at once exhausts SQLite's single writer (P1008).
const UPSERT_CHUNK_SIZE = 50;

// Callers fire-and-forget this from several places at once (notifier,
// gymChecker, /checkRaid); serialise them so runs never contend for the
// SQLite write lock, and never reject so an unawaited call can't take
// the process down.
let updateGymsQueue: Promise<void> = Promise.resolve();

export function updateGyms(raids: raids): Promise<void> {
  updateGymsQueue = updateGymsQueue.then(() =>
    upsertGyms(raids).catch((err) => {
      console.error("updateGyms failed:", err);
    }),
  );
  return updateGymsQueue;
}

async function upsertGyms(raids: raids): Promise<void> {
  const started = Date.now();
  const now = new Date();
  // The feed repeats a gym once per raid, so collapse to one entry per
  // geoKey. Keep an entry that carries a provider name over one that
  // doesn't, so a non-empty name still wins like it did per-upsert.
  const byGeoKey = new Map<string, raids[number]>();
  for (const raid of raids) {
    const geoKey = geoKeyFromLatLng(raid.lat, raid.lng);
    const seen = byGeoKey.get(geoKey);
    if (
      !seen ||
      (seen.gym_name.trim() === "" && raid.gym_name.trim() !== "")
    ) {
      byGeoKey.set(geoKey, raid);
    }
  }
  const entries = [...byGeoKey.entries()];
  for (let i = 0; i < entries.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = entries.slice(i, i + UPSERT_CHUNK_SIZE);
    await prisma.$transaction(
      chunk.map(([geoKey, raid]) =>
        prisma.gym.upsert({
          where: { geoKey },
          update: {
            lat: raid.lat,
            long: raid.lng,
            lastRaidAt: now,
            // Only clobber gymString if the provider sent a non-empty name
            ...(raid.gym_name.trim() !== "" && {
              gymString: raid.gym_name,
            }),
          },
          create: {
            geoKey,
            ...(raid.gym_name.trim() !== "" && {
              gymString: raid.gym_name,
            }),
            lat: raid.lat,
            long: raid.lng,
            lastRaidAt: now,
          },
        }),
      ),
    );
  }
  console.log(
    `updateGyms: ${entries.length} unique gyms from ${raids.length} raids in ${Date.now() - started}ms`,
  );
}

/**
 * Remove gyms that haven't had a raid in STALE_DAYS and have no subscriptions.
 * Gyms with active subscriptions are kept so users don't lose their notifications.
 */
export async function removeStaleGyms(): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - GYM_CONFIG.STALE_GYM_DAYS);

  const staleGyms = await prisma.gym.findMany({
    where: {
      OR: [
        { lastRaidAt: { lt: cutoff } },
        { lastRaidAt: null },
      ],
      GymSubscribe: { none: {} },
    },
    select: { id: true },
  });

  if (staleGyms.length > 0) {
    await prisma.gym.deleteMany({
      where: { id: { in: staleGyms.map((g) => g.id) } },
    });
    console.log(
      `Removed ${staleGyms.length} stale gyms (no raid in ${GYM_CONFIG.STALE_GYM_DAYS} days, no subscriptions)`,
    );
  }

  return staleGyms.length;
}
