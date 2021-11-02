import { PrismaClient } from ".prisma/client";
import { raids } from "../types";

const prisma = new PrismaClient();

export async function updateGyms(raids: raids): Promise<void> {
  raids.forEach(async (raid) => {
    await prisma.gym.upsert({
      where: { gymString: raid.gym_name },
      update: {
        lat: raid.lat,
        long: raid.lng,
      },
      create: {
        gymString: raid.gym_name,
        lat: raid.lat,
        long: raid.lng,
      },
    });
  });
}
