import { Prisma, PrismaClient } from ".prisma/client";
import { isToday, subDays } from "date-fns";
import bot from "../lib/bot";
import { getRaids } from "./getMaper";
import { gymChecker } from "./gymChecker";
import { sleep } from "./sleep";
import got from "got";
import { raidBosses } from "../types";

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

    const raidBosses = (await got(
      "https://raw.githubusercontent.com/pmgo-professor-willow/data-leekduck/gh-pages/raid-bosses.min.json",
    ).json()) as raidBosses;

    let possibleBosses = `\n\n<a href="https://www.leekduck.com/boss/">Possible raid boss</a>: (`;
    raidBosses.forEach((raidBoss) => {
      if (Number(raidBoss.tier) === raidMessage.level) {
        possibleBosses += raidBoss.originalName;
        possibleBosses += raidBoss.shinyAvailable ? "✨, " : ", ";
      }
    });
    possibleBosses = possibleBosses.slice(0, -2);
    possibleBosses += ")";

    let bossName = "";
    if (raidMessage.pokemonId !== 0) {
      const { name: name } = await got(
        `https://pokeapi.co/api/v2/pokemon/${raidMessage.pokemonId}`,
      ).json();
      bossName = name;
    }

    const message = `Level ${raidMessage.level} Raid at ${
      raidMessage.name
    } ${raidMessage.pokemonId === 0 ? "starting" : "started"} at ${
      raidMessage.start
    }${
      raidMessage.pokemonId === 0
        ? possibleBosses
        : `with pokemon ${bossName}`
    }`;

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
          if (raidMessage.pokemonId === 0) {
            const fiveMinMS = 300000;
            const offsetMillis =
              raidMessage.start.getTime() -
              new Date().getTime() -
              fiveMinMS;
            setTimeout(() => {
              bot.telegram.sendMessage(
                raidMessage.userTelegramId,
                "Raid starting in 5 mins\n\n<i>/stopNotifyingMeToday to stop being notified about raids for the rest of the day</i>",
                {
                  reply_to_message_id: originalMessage.message_id,
                  parse_mode: "HTML",
                },
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
