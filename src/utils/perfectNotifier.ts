import { Prisma, PrismaClient } from ".prisma/client";
import { subDays } from "date-fns";
import bot from "../lib/bot";
import { getPerfect, getTrio } from "./getMaper";
import { perfectChecker } from "./perfectChecker";
import { sleep } from "./sleep";
import { perfectMessageFormatter } from "./messageFormatter";

const prisma = new PrismaClient();

/**
 * Check perfect pokemons and notifies the user if there are perfect pokemons within the area
 */
export async function notifyPerfect(): Promise<void> {
  console.log("Checking pokemons");
  const pokemons = await getPerfect();
  const pokemonMessages = await perfectChecker(pokemons);
  for (const pokemonMessage of pokemonMessages) {
    const message = await perfectMessageFormatter(pokemonMessage);
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


/**
 * Check for legendary trio pokemons and notifies the user if there are pokemons
 */
export async function notifyLegendary(): Promise<void> {
  console.log("Checking pokemons");
  const pokemons = await getTrio();
  const pokemonMessages = await perfectChecker(pokemons);
  for (const pokemonMessage of pokemonMessages) {
    const message = await perfectMessageFormatter(pokemonMessage);
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
