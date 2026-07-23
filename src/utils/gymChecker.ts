import { PrismaClient, GymSubscribe, Gym } from "@prisma/client";
import { raids, raidMessage } from "../types";
import { updateGyms, geoKeyFromLatLng } from "./gymAdder";

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
  const subscribedGeoKeys = [
    ...new Set(subscribes.map((subscribe) => subscribe.gym.geoKey).filter(Boolean)),
  ] as string[];
  const subscribeGymRaids = raids.filter((raid) =>
    subscribedGeoKeys.includes(geoKeyFromLatLng(raid.lat, raid.lng)),
  );
  for (const raid of subscribeGymRaids) {
    const raidGeoKey = geoKeyFromLatLng(raid.lat, raid.lng);
    const subscribers = await prisma.gymSubscribe.findMany({
      where: { gym: { geoKey: raidGeoKey } },
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
  const subscribedGeoKeys = [
    ...new Set(gyms.map((gym) => gym.geoKey).filter(Boolean)),
  ] as string[];
  const gymRaids = raids.filter((raid) =>
    subscribedGeoKeys.includes(geoKeyFromLatLng(raid.lat, raid.lng)),
  );
  for (const raid of gymRaids) {
    const raidGeoKey = geoKeyFromLatLng(raid.lat, raid.lng);
    const gym = gyms.filter((g) => g.geoKey === raidGeoKey);
    const raidStart = new Date(
      Number(raid.raid_start.toString() + "000"),
    );
    const raidEnd = new Date(
      Number(raid.raid_end.toString() + "000"),
    );
    if (raidStart > new Date() || raid.pokemon_id != 0) {
      raidInfo.push({
        userTelegramId: 0,
        gymId: gym[0]?.id ?? "",
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
