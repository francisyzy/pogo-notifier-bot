import { Prisma, PrismaClient } from "@prisma/client";
import { subDays } from "date-fns";
import bot from "../lib/bot";
import { getPerfect, getTrio } from "./getMaper";
import { perfectChecker } from "./perfectChecker";
import { sleep } from "./sleep";
import { perfectMessageFormatter } from "./messageFormatter";
import { isNotifyAllowed, loadNotifyWindows } from "./notifyWindows";
import { createLogger } from "./logger";

const log = createLogger("perfect");

const prisma = new PrismaClient();

/**
 * Check perfect pokemons and notifies the user if there are perfect pokemons within the area
 */
export async function notifyPerfect(): Promise<void> {
  log.debug("Checking 100% IV spawns");
  const pokemons = await getPerfect();
  const pokemonMessages = await perfectChecker(pokemons);
  const windowsByUser = await loadNotifyWindows([
    ...new Set(pokemonMessages.map((m) => m.userTelegramId)),
  ]);
  for (const pokemonMessage of pokemonMessages) {
    if (
      !isNotifyAllowed(windowsByUser.get(pokemonMessage.userTelegramId) ?? [], {
        kind: "PERFECT",
      })
    ) {
      continue;
    }
    const message = await perfectMessageFormatter(pokemonMessage);
    await sleep(0.5);
    try {
      // PrismaPromise is lazy: without await this never ran
      await prisma.locationEvent.deleteMany({
        where: { eventTime: { lt: subDays(new Date(), 1) } },
      });
      await prisma.locationEvent
        .create({
          data: {
            eventTime: pokemonMessage.despawnDate,
            locationSubscribeLocationId: pokemonMessage.locationId,
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
      log.error("Failed to notify a spawn:", error);
    }
  }
}


/**
 * Check for legendary trio pokemons and notifies the user if there are pokemons
 */
export async function notifyLegendary(): Promise<void> {
  log.debug("Checking legendary spawns");
  const pokemons = await getTrio();
  const pokemonMessages = await perfectChecker(pokemons);
  const windowsByUser = await loadNotifyWindows([
    ...new Set(pokemonMessages.map((m) => m.userTelegramId)),
  ]);
  for (const pokemonMessage of pokemonMessages) {
    if (
      !isNotifyAllowed(windowsByUser.get(pokemonMessage.userTelegramId) ?? [], {
        kind: "PERFECT",
      })
    ) {
      continue;
    }
    const message = await perfectMessageFormatter(pokemonMessage);
    await sleep(0.5);
    try {
      // PrismaPromise is lazy: without await this never ran
      await prisma.locationEvent.deleteMany({
        where: { eventTime: { lt: subDays(new Date(), 1) } },
      });
      await prisma.locationEvent
        .create({
          data: {
            eventTime: pokemonMessage.despawnDate,
            locationSubscribeLocationId: pokemonMessage.locationId,
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
      log.error("Failed to notify a spawn:", error);
    }
  }
}
