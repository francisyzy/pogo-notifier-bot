import { PrismaClient } from "@prisma/client";
import { raids } from "../types";

const prisma = new PrismaClient();

const STALE_DAYS = 7;

export async function updateGyms(raids: raids): Promise<void> {
  const now = new Date();
  await Promise.all(
    raids.map((raid) =>
      prisma.gym.upsert({
        where: { gymString: raid.gym_name },
        update: {
          lat: raid.lat,
          long: raid.lng,
          lastRaidAt: now,
        },
        create: {
          gymString: raid.gym_name,
          lat: raid.lat,
          long: raid.lng,
          lastRaidAt: now,
        },
      }),
    ),
  );
}

/**
 * Remove gyms that haven't had a raid in STALE_DAYS and have no subscriptions.
 * Gyms with active subscriptions are kept so users don't lose their notifications.
 */
export async function removeStaleGyms(): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STALE_DAYS);

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
    console.log(`Removed ${staleGyms.length} stale gyms (no raid in ${STALE_DAYS} days, no subscriptions)`);
  }

  return staleGyms.length;
}
