import bot from "../lib/bot";
import got from "got";
import { raidBosses } from "../types";
import { urlFormatter } from "../utils/messageFormatter";

const checkBoss = () => {
  try {
    bot.command("currentboss", async (ctx) => {
      const editMessage = await ctx.reply(
        "Retrieving latest boss information…",
      );
      const raidBosses = (await got(
        "https://raw.githubusercontent.com/pmgo-professor-willow/data-leekduck/gh-pages/raid-bosses.min.json",
      ).json()) as raidBosses;

      let possibleBosses = `\n\n<a href="https://www.leekduck.com/boss/">Possible raid boss</a>: \n\n`;
      //Set up double array to organise raid tiers
      let results: string[][] = [];

      raidBosses.forEach((raidBoss) => {
        let url = urlFormatter(raidBoss.originalName, raidBoss.tier);
        raidBoss.tier =
          raidBoss.tier === "mega" ? "6" : raidBoss.tier;
        let bossName = `<a href="${url}">${raidBoss.originalName}</a>`;
        bossName += raidBoss.shinyAvailable ? "✨" : "";
        while (results[Number(raidBoss.tier)] === undefined) {
          results.push([]);
        }
        results[Number(raidBoss.tier)].push(bossName);
      });
      results = results.filter(String);
      possibleBosses += results.join("\n\n");
      return ctx.telegram.editMessageText(
        ctx.message.chat.id,
        editMessage.message_id,
        undefined,
        possibleBosses,
        { parse_mode: "HTML", disable_web_page_preview: true },
      );
    });
  } catch (error) {
    console.log(error);
  }
};

export default checkBoss;
