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
      const raidEnd = new Date(
        Number(raid.raid_end.toString() + "000"),
      );
      if (raidStart > new Date() || raid.pokemon_id != 0) {
        raidMessages.push({
          ...subscriber,
          name: raid.gym_name,
          level: raid.level,
          start: raidStart,
          end: raidEnd,
          pokemonId: raid.pokemon_id,
        });
      }
    });
  }

  return raidMessages;
}

export async function gymCheckerAdHoc(
  raids: raids,
  gyms: Gym[],
): Promise<raidMessage[]> {
  updateGyms(raids);
  let raidInfo: raidMessage[] = [];
  const gymName = [...new Set(gyms.map((gym) => gym.gymString))];
  const gymRaids = raids.filter((raid) =>
    gymName.includes(raid.gym_name),
  );
  for (const raid of gymRaids) {
    const gym = gyms.filter((gym) =>
      gym.gymString.includes(raid.gym_name),
    );
    const raidStart = new Date(
      Number(raid.raid_start.toString() + "000"),
    );
    const raidEnd = new Date(
      Number(raid.raid_end.toString() + "000"),
    );
    if (raidStart > new Date() || raid.pokemon_id != 0) {
      raidInfo.push({
        userTelegramId: 0,
        gymId: gym[0].id,
        name: raid.gym_name,
        level: raid.level,
        start: raidStart,
        end: raidEnd,
        pokemonId: raid.pokemon_id,
      });
    }
  }

  return raidInfo;
}
