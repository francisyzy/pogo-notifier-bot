import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";

const prisma = new PrismaClient();
const OUT = "./prisma/gym_data.json";

/**
 * Refresh prisma/gym_data.json (the /seed source) from the live database.
 *
 *   npm run exportGyms
 *
 * Gyms without a name are kept (gymString: null) so a fresh install can
 * still find them by location. Sorted by geoKey for stable diffs.
 */
async function exportGymData() {
  const gyms = await prisma.gym.findMany({
    select: { gymString: true, lat: true, long: true },
    orderBy: [{ lat: "asc" }, { long: "asc" }],
  });
  const rows = gyms.map((gym) => ({
    gymString: gym.gymString?.trim() || null,
    lat: gym.lat,
    long: gym.long,
  }));
  writeFileSync(OUT, JSON.stringify(rows, null, 2) + "\n");
  const named = rows.filter((r) => r.gymString).length;
  console.log(
    `Exported ${rows.length} gyms (${named} named, ${rows.length - named} unnamed) to ${OUT}`,
  );
}

exportGymData()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
