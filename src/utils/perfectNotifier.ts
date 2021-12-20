import { Prisma, PrismaClient } from ".prisma/client";
import { subDays } from "date-fns";
import bot from "../lib/bot";
import { getPerfect } from "./getMaper";
import { perfectChecker } from "./perfectChecker";
import { sleep } from "./sleep";
import got from "got";

const prisma = new PrismaClient();

/**
 * Check pokemons and notifies the user if there are pokemons
 */
export async function notifyPerfect(): Promise<void> {
  console.log("Checking pokemons");
  const pokemons = await getPerfect();
  const pokemonMessages = await perfectChecker(pokemons);
  for (const pokemonMessage of pokemonMessages) {
    const { name: name } = await got(
      `https://pokeapi.co/api/v2/pokemon/${pokemonMessage.pokemon_id}`,
    ).json();

    const message = `Perfect pokemon ${name}(CP ${
      pokemonMessage.cp
    }) despawns at ${pokemonMessage.despawnDate.toString()}`;

    await sleep(0.5);
    try {
      //Delete not working
      prisma.locationEvent.deleteMany({
        where: { eventTime: { lt: subDays(new Date(), 1) } },
      });
      await prisma.locationEvent
        .create({
          data: {
            eventTime: pokemonMessage.despawnDate,
            locationSubscribeLocationId: pokemonMessage.locationId,
            lat: pokemonMessage.lat, //not sure why double storage of data
            long: pokemonMessage.lng,
          },
        })
        .then(async () => {
          await prisma.user.update({
            where: { telegramId: pokemonMessage.userTelegramId },
            data: {
              locationTimesNotified: {
                increment: 1,
              },
            },
          });
          await bot.telegram
            .sendMessage(pokemonMessage.userTelegramId, message)
            .then(() =>
              bot.telegram.sendLocation(
                pokemonMessage.userTelegramId,
                pokemonMessage.lat,
                pokemonMessage.lng,
              ),
            );
        })
        .catch(async (error) => {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === "P2002") {
              //User has already been notified
            }
          }
        });
    } catch (error) {
      console.error(error);
    }
  }
}
