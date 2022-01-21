import { Prisma, PrismaClient } from ".prisma/client";
import { isToday, subDays } from "date-fns";
import bot from "../lib/bot";
import { getRaids } from "./getMaper";
import { gymChecker } from "./gymChecker";
import { sleep } from "./sleep";
import { bossCount, raidMessageFormatter } from "./messageFormatter";
import config from "../config";

const prisma = new PrismaClient();

/**
 * Check raids and notifies the user if there are raids
 */
export async function notifyAndUpdateUsers(): Promise<void> {
  console.log("Checking raids");
  const raids = await getRaids();
  const raidMessages = await gymChecker(raids);
  for (const raidMessage of raidMessages) {
    const user = await prisma.user.findUnique({
      where: { telegramId: raidMessage.userTelegramId },
    });
    if (user?.raidLevelNotify.indexOf(raidMessage.level) === -1) {
      console.log(user.name + " Skipped Raid " + raidMessage.level);
      continue;
    } else if (
      user?.stopNotifyingMeToday &&
      isToday(user.stopNotifyingMeToday)
    ) {
      console.log(user.name + " Skipped Raid stop notify");
      continue;
    }

    const message = await raidMessageFormatter(raidMessage);

    await sleep(0.5);
    try {
      //Delete not working
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
          await prisma.user.update({
            where: { telegramId: raidMessage.userTelegramId },
            data: {
              gymTimesNotified: {
                increment: 1,
              },
            },
          });
          const originalMessage = await bot.telegram.sendMessage(
            raidMessage.userTelegramId,
            message,
            { parse_mode: "HTML", disable_web_page_preview: true },
          );
          //If raid has not started, send reminder
          if (raidMessage.pokemonId === 0) {
            //Gets the number of bosses possible (for reminder message)
            const numberOfBoss = await bossCount(raidMessage);
            //telegram command - is not clickable whereas _ is clickable
            const gymId = raidMessage.gymId.replaceAll("-", "_");
            const offsetMs =
              raidMessage.start.getTime() -
              new Date().getTime() -
              config.raidAlertMinutes * 60000;
            //* 60000, 1min = 60000ms
            setTimeout(() => {
              bot.telegram.sendMessage(
                raidMessage.userTelegramId,
                `Raid starting in ${config.raidAlertMinutes} mins${
                  numberOfBoss === 1
                    ? ""
                    : "\n\n/checkraid_" +
                      gymId +
                      " to check which raid boss spawned, after the egg popped"
                }\n\n<i>/stopNotifyingMeToday to stop being notified about raids for the rest of the day</i>`,
                {
                  reply_to_message_id: originalMessage.message_id,
                  parse_mode: "HTML",
                },
              );
            }, offsetMs);
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
