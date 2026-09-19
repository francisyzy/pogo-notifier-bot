import { PrismaClient, GymSubscribe, Gym } from "@prisma/client";
import { raids, raidMessage, weathers } from "../types";
import { updateGyms, geoKeyFromLatLng } from "./gymAdder";
import {
  buildWeatherCells,
  weatherAt,
  WeatherCells,
} from "./weather";

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
 * Display name for a raid at a gym. The provider's name is the source of
 * truth; the stored name is only a user-supplied stand-in (/renameGym)
 * for when the provider sends none.
 */
function resolveGymName(gym: Gym | undefined, providerName: string): string {
  return (
    providerName.trim() ||
    gym?.gymString ||
    (gym ? resolveGeoKey(gym) : "unknown gym")
  );
}

/**
 * Location, feed cell and in-game weather of a raid, for the message.
 * `cells` comes from the raid feed's `weathers`; without it (callers
 * that only have raids) the weather is simply unknown.
 */
function raidPlace(
  raid: raids[number],
  cells?: WeatherCells,
): Pick<raidMessage, "lat" | "long" | "cellId" | "weatherId"> {
  const cellId = raid.cell_id ? String(raid.cell_id) : null;
  return {
    lat: raid.lat,
    long: raid.lng,
    cellId,
    weatherId: cells
      ? weatherAt(cells, raid.lat, raid.lng, cellId)
      : undefined,
  };
}

export async function gymChecker(
  raids: raids,
  userTelegramId?: number,
  weathers?: weathers,
): Promise<raidMessage[]> {
  updateGyms(raids);
  const cells = weathers && buildWeatherCells(weathers);
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
          ...raidPlace(raid, cells),
        });
      }
    });
  }

  return raidMessages;
}

export async function gymCheckerAdHoc(
  raids: raids,
  gyms: Gym[],
  weathers?: weathers,
): Promise<raidMessage[]> {
  updateGyms(raids);
  const cells = weathers && buildWeatherCells(weathers);
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
        ...raidPlace(raid, cells),
      });
    }
  }

  return raidInfo;
}
