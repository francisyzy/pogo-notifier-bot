import { PrismaClient, GymSubscribe, Gym } from "@prisma/client";
import { raids, raidMessage } from "../types";
import { updateGyms, geoKeyFromLatLng } from "./gymAdder";

const prisma = new PrismaClient();

/**
 * Resolve a gym's geoKey, falling back to computing it from lat/long.
 * Guards against rows whose geoKey was never backfilled (NULL) so that
 * subscriptions to them still match incoming raids.
 */
function resolveGeoKey(gym: Gym): string {
  return gym.geoKey ?? geoKeyFromLatLng(gym.lat, gym.long);
}

/**
 * Display name for a raid at a gym. Prefer the stored name (which is what
 * the user set via /renameGym) over the provider's, which is often empty.
 */
function resolveGymName(gym: Gym | undefined, providerName: string): string {
  return (
    gym?.gymString ||
    providerName.trim() ||
    (gym ? resolveGeoKey(gym) : "unknown gym")
  );
}

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
  // Group subscriptions by geoKey (computed from lat/long if the row has none)
  const subscribersByGeoKey = new Map<string, typeof subscribes>();
  for (const subscribe of subscribes) {
    const key = resolveGeoKey(subscribe.gym);
    const list = subscribersByGeoKey.get(key) ?? [];
    list.push(subscribe);
    subscribersByGeoKey.set(key, list);
  }
  const subscribeGymRaids = raids.filter((raid) =>
    subscribersByGeoKey.has(geoKeyFromLatLng(raid.lat, raid.lng)),
  );
  for (const raid of subscribeGymRaids) {
    const raidGeoKey = geoKeyFromLatLng(raid.lat, raid.lng);
    const subscribers = subscribersByGeoKey.get(raidGeoKey) ?? [];
    subscribers.forEach(({ gym, ...subscriber }) => {
      const raidStart = new Date(
        Number(raid.raid_start.toString() + "000"),
      );
      const raidEnd = new Date(
        Number(raid.raid_end.toString() + "000"),
      );
      if (raidStart > new Date() || raid.pokemon_id != 0) {
        raidMessages.push({
          ...subscriber,
          name: resolveGymName(gym, raid.gym_name),
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
    ...new Set(gyms.map((gym) => resolveGeoKey(gym))),
  ];
  const gymRaids = raids.filter((raid) =>
    subscribedGeoKeys.includes(geoKeyFromLatLng(raid.lat, raid.lng)),
  );
  for (const raid of gymRaids) {
    const raidGeoKey = geoKeyFromLatLng(raid.lat, raid.lng);
    const gym = gyms.filter((g) => resolveGeoKey(g) === raidGeoKey);
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
        name: resolveGymName(gym[0], raid.gym_name),
        level: raid.level,
        start: raidStart,
        end: raidEnd,
        pokemonId: raid.pokemon_id,
      });
    }
  }

  return raidInfo;
}
