import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
const prisma = new PrismaClient();

async function main() {
  const data = readFileSync("./prisma/gym_data.json", "utf8");
  const gymData = JSON.parse(data);
  await prisma.gym.createMany({ data: gymData });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
