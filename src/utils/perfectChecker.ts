import { PrismaClient } from "@prisma/client";
import { pokemonMessage, pokemons } from "../types";
import config from "../config";
import { distanceMeters } from "./geo";

const prisma = new PrismaClient();

export async function perfectChecker(
  perfectList: pokemons,
): Promise<pokemonMessage[]> {
  let pokemonMessages: pokemonMessage[] = [];
  const subscribes = await prisma.locationSubscribe.findMany({});
  console.log(perfectList.length);
  subscribes.forEach((subscribe) => {
    perfectList.forEach((perfect) => {
      // Each subscription carries its own radius (metres, set by the user)
      const distance = distanceMeters(
        subscribe.lat,
        subscribe.long,
        perfect.lat,
        perfect.lng,
      );
      if (distance <= subscribe.radiusMeters) {
        pokemonMessages.push({
          despawnDate: new Date(
            Number(perfect.despawn.toString() + "000"),
          ),
          userTelegramId: subscribe.userTelegramId,
          locationId: subscribe.locationId,
          distanceMeters: distance,
          ...perfect,
        });
      }
    });
  });
  return pokemonMessages;
}

export async function perfectCheckerAdHoc(
  perfectList: pokemons,
  latitude: number,
  longitude: number,
): Promise<pokemonMessage[]> {
  let pokemonMessages: pokemonMessage[] = [];
  const range = config.perfectAdHocRange;
  perfectList.forEach((perfect) => {
    if (withinRange(latitude, perfect.lat, range)) {
      if (withinRange(longitude, perfect.lng, range)) {
        pokemonMessages.push({
          despawnDate: new Date(
            Number(perfect.despawn.toString() + "000"),
          ),
          userTelegramId: 0,
          locationId: "string",
          ...perfect,
        });
      }
    }
  });
  return pokemonMessages;
}

function withinRange(
  originalPoint: number,
  incomingPoint: number,
  range: number,
): boolean {
  const lowerBound = originalPoint - range;
  const upperBound = originalPoint + range;
  return incomingPoint >= lowerBound && incomingPoint <= upperBound;
}
