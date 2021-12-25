import { PrismaClient, GymSubscribe, Gym } from ".prisma/client";
import { raids, raidMessage } from "../types";
import { updateGyms } from "./gymAdder";

const prisma = new PrismaClient();

export async function gymChecker(
  raids: raids,
  userTelegramId?: number,
): Promise<raidMessage[]> {
  updateGyms(raids);
  let raidMessages: raidMessage[] = [];
  let subscribes: (GymSubscribe & {
    gym: Gym;
  })[];
  if (userTelegramId) {
    subscribes = await prisma.gymSubscribe.findMany({
      include: { gym: true },
      where: { userTelegramId: userTelegramId },
    });
  } else {
    subscribes = await prisma.gymSubscribe.findMany({
      include: { gym: true },
    });
  }
  const subscribesGymName = [
    ...new Set(
      subscribes.map((subscribe) => subscribe.gym.gymString),
    ),
  ];
  const subscribeGymRaids = raids.filter((raid) =>
    subscribesGymName.includes(raid.gym_name),
  );
  for (const raid of subscribeGymRaids) {
    const subscribers = await prisma.gymSubscribe.findMany({
      where: { gym: { gymString: raid.gym_name } },
    });
    subscribers.forEach((subscriber) => {
      const raidStart = new Date(
        Number(raid.raid_start.toString() + "000"),
      );
      if (raidStart > new Date() || raid.pokemon_id != 0) {
        raidMessages.push({
          ...subscriber,
          name: raid.gym_name,
          level: raid.level,
          start: raidStart,
          pokemonId: raid.pokemon_id,
        });
      }
    });
  }

  return raidMessages;
}
