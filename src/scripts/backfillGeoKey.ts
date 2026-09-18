import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Backfills geoKey for all existing Gym records that have NULL geoKey.
 * geoKey = lat/lng rounded to 4 decimal places, joined by "|".
 *
 * If another gym already owns that geoKey (e.g. the bot created a fresh row
 * for the same location because the old one had no geoKey), the NULL row is
 * merged into it: subscriptions and events are re-pointed to the existing
 * gym and the orphan row is deleted, so subscribers keep their notifications.
 *
 * Idempotent — safe to run multiple times. Only touches NULL rows.
 */
function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function geoKeyFromLatLng(lat: number, lng: number): string {
  return `${roundTo(lat, 4)}|${roundTo(lng, 4)}`;
}

async function main() {
  console.log("Starting geoKey backfill...");

  // Find all gyms with null geoKey
  const gymsWithoutGeoKey = await prisma.gym.findMany({
    where: { geoKey: null },
    select: { id: true, lat: true, long: true, gymString: true },
  });

  if (gymsWithoutGeoKey.length === 0) {
    console.log("All gyms already have geoKey. Nothing to do.");
    return;
  }

  console.log(`Found ${gymsWithoutGeoKey.length} gym(s) without geoKey. Backfilling...`);

  let updated = 0;
  let merged = 0;

  for (const gym of gymsWithoutGeoKey) {
    const geoKey = geoKeyFromLatLng(gym.lat, gym.long);

    // Check if another gym already has this geoKey (duplicate location)
    const existing = await prisma.gym.findUnique({ where: { geoKey } });
    if (existing && existing.id !== gym.id) {
      await mergeGymInto(gym.id, existing.id);
      console.log(
        `MERGED gym "${gym.gymString ?? gym.id}" (${gym.lat},${gym.long}) ` +
        `into "${existing.gymString ?? existing.id}" (${geoKey})`,
      );
      merged++;
      continue;
    }

    await prisma.gym.update({
      where: { id: gym.id },
      data: { geoKey },
    });
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Merged into existing gym: ${merged}`);
}

/**
 * Move all subscriptions and events from `fromGymId` to `toGymId`, then
 * delete `fromGymId`. Rows that would collide with an existing subscription
 * or event on the target gym are dropped (the target already has them).
 */
async function mergeGymInto(fromGymId: string, toGymId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const subs = await tx.gymSubscribe.findMany({ where: { gymId: fromGymId } });
    for (const sub of subs) {
      const alreadySubscribed = await tx.gymSubscribe.findUnique({
        where: {
          userTelegramId_gymId: {
            userTelegramId: sub.userTelegramId,
            gymId: toGymId,
          },
        },
      });
      if (alreadySubscribed) {
        // Target already has this subscription; cascade deletes the old events
        await tx.gymSubscribe.delete({
          where: {
            userTelegramId_gymId: {
              userTelegramId: sub.userTelegramId,
              gymId: fromGymId,
            },
          },
        });
        continue;
      }

      await tx.gymSubscribe.create({
        data: { userTelegramId: sub.userTelegramId, gymId: toGymId },
      });

      const events = await tx.gymEvent.findMany({
        where: {
          gymSubscribeUserTelegramId: sub.userTelegramId,
          gymSubscribeGymId: fromGymId,
        },
      });
      await tx.gymEvent.createMany({
        data: events.map((e) => ({
          eventTime: e.eventTime,
          gymSubscribeUserTelegramId: sub.userTelegramId,
          gymSubscribeGymId: toGymId,
        })),
      });

      // Cascade removes the old events
      await tx.gymSubscribe.delete({
        where: {
          userTelegramId_gymId: {
            userTelegramId: sub.userTelegramId,
            gymId: fromGymId,
          },
        },
      });
    }

    await tx.gym.delete({ where: { id: fromGymId } });
  });
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
