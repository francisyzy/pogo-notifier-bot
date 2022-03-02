import bot from "../lib/bot";
import got from "got";
import { raidBosses } from "../types";

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
      let results: string[][] = [];

      raidBosses.forEach((raidBoss) => {
        //change mega formatting
        let customMegaFormat = "";
        if (raidBoss.tier === "mega") {
          raidBoss.tier = "6";
          customMegaFormat = raidBoss.originalName.slice(5) + "_MEGA";
        }
        let url = `https://www.pokebattler.com/raids/${
          customMegaFormat ||
          raidBoss.originalName.replace(/\s/g, "_")
        }`;
        //Deal with custom forms
        if (raidBoss.originalName.includes("Deoxys (Att")) {
          url = `https://www.pokebattler.com/raids/DEOXYS_ATTACK_FORM`;
        } else if (raidBoss.originalName.includes("Deoxys (Def")) {
          url = `https://www.pokebattler.com/raids/DEOXYS_DEFENSE_FORM`;
        } else if (raidBoss.originalName.includes("Deoxys (Speed")) {
          url = `https://www.pokebattler.com/raids/DEOXYS_SPEED_FORM`;
        } else if (raidBoss.originalName.includes("Deoxys (Normal")) {
          url = `https://www.pokebattler.com/raids/DEOXYS`;
        } else if (
          raidBoss.originalName.includes("Genesect (Shock)")
        ) {
          url = `https://www.pokebattler.com/raids/GENESECT_SHOCK_FORM`;
        } else if (
          raidBoss.originalName.includes("Genesect (Chill)")
        ) {
          url = `https://www.pokebattler.com/raids/GENESECT_CHILL_FORM`;
        } else if (
          raidBoss.originalName.includes("Genesect (Burn)")
        ) {
          url = `https://www.pokebattler.com/raids/GENESECT_BURN_FORM`;
        } else if (
          raidBoss.originalName.includes("Genesect (Douse)")
        ) {
          url = `https://www.pokebattler.com/raids/GENESECT_DOUSE_FORM`;
        }
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
