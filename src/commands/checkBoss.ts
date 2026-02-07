import bot from "../lib/bot";
import { Scenes } from "telegraf";
import { raidBosses } from "../types";
import { urlFormatter, isShadowBoss } from "../utils/messageFormatter";
import { URLS } from "../constants";

const checkBoss = () => {
  try {
    const currentBossHandler = async (ctx: Scenes.WizardContext) => {
      const editMessage = await ctx.reply(
        "Retrieving latest boss information…",
      );
      
      let raidBossesData: raidBosses;
      try {
        const response = await fetch(URLS.RAID_BOSSES_JSON);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch raid bosses: ${response.status} ${response.statusText}`,
          );
        }
        raidBossesData = (await response.json()) as raidBosses;
      } catch (error) {
        console.error("Error fetching raid bosses:", error);
        if (!ctx.chat) {
          return;
        }
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          editMessage.message_id,
          undefined,
          `❌ Unable to retrieve raid boss information.\n\n<a href="${URLS.LEEKDUCK_BOSS}">View current raid bosses on LeekDuck</a>`,
          { parse_mode: "HTML", link_preview_options: { is_disabled: true } },
        );
        return;
      }

      let possibleBosses = `\n\n<a href="https://www.leekduck.com/boss/">Possible raid boss</a>: \n\n`;
      
      // Structure: results[tier][isShadow] = array of boss names
      const results: Record<number, { regular: string[]; shadow: string[] }> = {};

      raidBossesData.forEach((raidBoss) => {
        let url = urlFormatter(raidBoss.originalName, raidBoss.tier);
        const tier = raidBoss.tier === "mega" ? 6 : Number(raidBoss.tier);
        let bossName = `<a href="${url}">${raidBoss.originalName}</a>`;
        bossName += raidBoss.shinyAvailable ? "✨" : "";
        
        const isShadow = isShadowBoss(raidBoss);
        
        if (!results[tier]) {
          results[tier] = { regular: [], shadow: [] };
        }
        
        if (isShadow) {
          results[tier].shadow.push(bossName);
        } else {
          results[tier].regular.push(bossName);
        }
      });

      // Build the output string, grouping by tier and shadow status
      const outputParts: string[] = [];
      const sortedTiers = Object.keys(results)
        .map(Number)
        .sort((a, b) => a - b);
      
      for (const tier of sortedTiers) {
        const tierData = results[tier];
        
        // Add regular bosses for this tier
        if (tierData.regular.length > 0) {
          outputParts.push(tierData.regular.join(", "));
        }
        
        // Add shadow bosses for this tier
        if (tierData.shadow.length > 0) {
          outputParts.push(tierData.shadow.join(", "));
        }
      }
      
      possibleBosses += outputParts.join("\n\n");
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
    console.error("Error in checkBoss:", error);
  }
};

export default checkBoss;
