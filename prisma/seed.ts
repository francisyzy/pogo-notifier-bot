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
    gymString: string;
    lat: number;
    long: number;
  }>;
  for (const gym of gymData) {
    const geoKey = geoKeyFromLatLng(gym.lat, gym.long);
    await prisma.gym.upsert({
      where: { geoKey },
      update: { gymString: gym.gymString, lat: gym.lat, long: gym.long },
      create: {
        geoKey,
        gymString: gym.gymString,
        lat: gym.lat,
        long: gym.long,
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
