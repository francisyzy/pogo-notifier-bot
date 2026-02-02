import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
const prisma = new PrismaClient();

async function main() {
  const data = readFileSync("./prisma/gym_data.json", "utf8");
  const gymData = JSON.parse(data) as Array<{
    gymString: string;
    lat: number;
    long: number;
  }>;
  for (const gym of gymData) {
    await prisma.gym.upsert({
      where: { gymString: gym.gymString },
      update: { lat: gym.lat, long: gym.long },
      create: {
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
