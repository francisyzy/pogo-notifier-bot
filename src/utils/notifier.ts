import { Prisma, PrismaClient } from ".prisma/client";
import { subDays } from "date-fns";
import bot from "../lib/bot";
import { getRaids } from "./getMaper";
import { gymChecker } from "./gymChecker";
import { sleep } from "./sleep";

const prisma = new PrismaClient();

/**
 * Check raids and notifies the user if there are raids
 */
export async function notifyAndUpdateUsers(): Promise<void> {
  console.log("Checking raids");
  const raids = await getRaids();
  const raidMessages = await gymChecker(raids);
  for (const raidMessage of raidMessages) {
    const message = `Level ${raidMessage.level} Raid at ${
      raidMessage.name
    } ${raidMessage.pokemonId === 0 ? "starting" : "started"} at ${
      raidMessage.start
    }`;

    await sleep(0.5);
    try {
      prisma.gymEvent.deleteMany({
        where: { eventTime: { lt: subDays(new Date(), 1) } },
      });
      await prisma.gymEvent
        .create({
          data: {
            eventTime: raidMessage.start,
            gymSubscribeGymId: raidMessage.gymId,
            gymSubscribeUserTelegramId: raidMessage.userTelegramId,
          },
        })
        .then(async () => {
          const originalMessage = await bot.telegram.sendMessage(
            raidMessage.userTelegramId,
            message,
          );
          if (raidMessage.pokemonId === 0) {
            const fiveMinMS = 300000;
            const offsetMillis =
              raidMessage.start.getTime() -
              new Date().getTime() +
              fiveMinMS;
            setTimeout(() => {
              bot.telegram.sendMessage(
                raidMessage.userTelegramId,
                "Raid starting in 5 mins",
                { reply_to_message_id: originalMessage.message_id },
              );
            }, offsetMillis);
          }
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
