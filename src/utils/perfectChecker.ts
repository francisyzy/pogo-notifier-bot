import { PrismaClient } from ".prisma/client";
import { pokemonMessage, pokemons } from "../types";

const prisma = new PrismaClient();

export async function perfectChecker(
  perfectList: pokemons,
): Promise<pokemonMessage[]> {
  let pokemonMessages: pokemonMessage[] = [];
  const subscribes = await prisma.locationSubscribe.findMany({});
  const range = 0.001; //https://gis.stackexchange.com/a/8674
  console.log(perfectList.length);
  subscribes.forEach((subscribe) => {
    perfectList.forEach((perfect) => {
      if (withinRange(subscribe.lat, perfect.lat, range)) {
        if (withinRange(subscribe.long, perfect.lng, range)) {
          pokemonMessages.push({
            despawnDate: new Date(
              Number(perfect.despawn.toString() + "000"),
            ),
            userTelegramId: subscribe.userTelegramId,
            locationId: subscribe.locationId,
            ...perfect,
          });
        }
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
  const range = 0.001; //https://gis.stackexchange.com/a/8674
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
