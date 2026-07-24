import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Backfills geoKey for all existing Gym records that have NULL geoKey.
 * geoKey = lat/lng rounded to 4 decimal places, joined by "|".
 * Idempotent — safe to run multiple times. Only updates NULL rows.
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
  let skipped = 0;

  for (const gym of gymsWithoutGeoKey) {
    const geoKey = geoKeyFromLatLng(gym.lat, gym.long);

    // Check if another gym already has this geoKey (duplicate location)
    const existing = await prisma.gym.findUnique({ where: { geoKey } });
    if (existing && existing.id !== gym.id) {
      console.warn(
        `SKIP gym "${gym.gymString ?? gym.id}" (${gym.lat},${gym.long}): ` +
        `geoKey ${geoKey} already taken by gym "${existing.gymString ?? existing.id}". ` +
        `These gyms share the same location. Manual merge may be needed.`,
      );
      skipped++;
      continue;
    }

    await prisma.gym.update({
      where: { id: gym.id },
      data: { geoKey },
    });
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Skipped (duplicates): ${skipped}`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
