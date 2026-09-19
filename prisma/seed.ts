import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
const prisma = new PrismaClient();

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function geoKeyFromLatLng(lat: number, lng: number): string {
  return `${roundTo(lat, 4)}|${roundTo(lng, 4)}`;
}

async function main() {
  const data = readFileSync("./prisma/gym_data.json", "utf8");
  const gymData = JSON.parse(data) as Array<{
    gymString: string | null;
    lat: number;
    long: number;
  }>;
  // Seeded gyms count as "seen now" so removeStaleGyms gives them the
  // usual grace period instead of deleting them on the first 4am run
  const now = new Date();
  for (const gym of gymData) {
    const geoKey = geoKeyFromLatLng(gym.lat, gym.long);
    // Don't clobber an existing name with null from the seed file
    const name = gym.gymString ? { gymString: gym.gymString } : {};
    await prisma.gym.upsert({
      where: { geoKey },
      update: { ...name, lat: gym.lat, long: gym.long },
      create: {
        geoKey,
        ...name,
        lat: gym.lat,
        long: gym.long,
        lastRaidAt: now,
      },
    });
  }
  console.log(`Seeded ${gymData.length} gyms`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
