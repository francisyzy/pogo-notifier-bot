import { PrismaClient } from "@prisma/client";

import bot from "../lib/bot";
import { getRaids } from "../utils/getMaper";
import { updateGyms } from "../utils/gymAdder";

const prisma = new PrismaClient();

const checkRaid = () => {
  try {
    bot.command("checkraid", async (ctx) => {
      const raids = await getRaids();
      updateGyms(raids);
      const subscribes = await prisma.gymSubscribe.findMany({
        include: { gym: true },
      });
      const subscribesGymName = subscribes.map(
        (subscribe) => subscribe.gym.gymString,
      );
      const subscribeGymRaids = raids.filter((raid) =>
        subscribesGymName.includes(raid.gym_name),
      );

      if (subscribeGymRaids.length === 0) {
        ctx.reply("No raids at your subscriptions");
      }
      subscribeGymRaids.forEach((raid) => {
        const raidStart = new Date(
          Number(raid.raid_start.toString() + "000"),
        );
        if (raidStart > new Date() || raid.pokemon_id != 0) {
          const returnString = `Level ${raid.level} Raid at <u>${
            raid.gym_name
          }</u> ${
            raid.pokemon_id === 0 ? "starting" : "started"
          } at ${raidStart}`;
          ctx.replyWithHTML(returnString);
        }
      });
    });
  } catch (error) {
    console.log(error);
  }
};

export default checkRaid;
