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

export async function updateGyms(raids: raids): Promise<void> {
  const now = new Date();
  await Promise.all(
    raids.map((raid) => {
      const geoKey = geoKeyFromLatLng(raid.lat, raid.lng);
      return prisma.gym.upsert({
        where: { geoKey },
        update: {
          lat: raid.lat,
          long: raid.lng,
          lastRaidAt: now,
          // Only clobber gymString if the provider sent a non-empty name
          ...(raid.gym_name.trim() !== "" && { gymString: raid.gym_name }),
        },
        create: {
          geoKey,
          ...(raid.gym_name.trim() !== "" && { gymString: raid.gym_name }),
          lat: raid.lat,
          long: raid.lng,
          lastRaidAt: now,
        },
      });
    }),
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
