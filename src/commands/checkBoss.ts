import bot from "../lib/bot";
import { Scenes } from "telegraf";
import { raidBosses } from "../types";
import { urlFormatter } from "../utils/messageFormatter";
import { URLS } from "../constants";

const checkBoss = () => {
  try {
    const currentBossHandler = async (ctx: Scenes.WizardContext) => {
      const editMessage = await ctx.reply(
        "Retrieving latest boss information…",
      );
      const raidBossesData = (await fetch(
        URLS.RAID_BOSSES_JSON,
      ).then((r) => r.json())) as raidBosses;

      let possibleBosses = `\n\n<a href="https://www.leekduck.com/boss/">Possible raid boss</a>: \n\n`;
      let results: string[][] = [];

      raidBossesData.forEach((raidBoss) => {
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
      if (!ctx.chat) {
        return;
      }
      return ctx.telegram.editMessageText(
        ctx.chat.id,
        editMessage.message_id,
        undefined,
        possibleBosses,
        { parse_mode: "HTML", link_preview_options: { is_disabled: true } },
      );
    };

    // Register handler for both lowercase and camelCase
    bot.command("currentboss", currentBossHandler);
    bot.command("currentBoss", currentBossHandler);
  } catch (error) {
    console.log(error);
  }
};

export default checkBoss;
