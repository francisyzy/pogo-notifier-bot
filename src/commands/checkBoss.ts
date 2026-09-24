import bot from "../lib/bot";
import { Scenes } from "telegraf";
import { PrismaClient } from "@prisma/client";
import { raidBosses } from "../types";
import {
  isShadowBoss,
  raidBossTier,
  bossInlineLabel,
} from "../utils/messageFormatter";
import { URLS, RAID_CONFIG } from "../constants";
import { getRaidFeed } from "../utils/getMaper";
import {
  GAME_WEATHER,
  buildWeatherCells,
  weatherAt,
} from "../utils/weather";
import { hasLastLocation } from "../utils/lastLocation";

const prisma = new PrismaClient();

/**
 * In-game weather at the user's last-sent pin, from the raid feed's
 * weather cells. Undefined when the user has never sent a pin, the
 * feed is down, or the pin is outside the covered cells: the command
 * then just shows normal CP ranges.
 */
async function weatherAtLastPin(
  telegramId: number,
): Promise<{ hasPin: boolean; weatherId?: number }> {
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { lastLat: true, lastLong: true },
    });
    if (!hasLastLocation(user)) return { hasPin: false };
    const { weathers } = await getRaidFeed();
    const cells = buildWeatherCells(weathers);
    return {
      hasPin: true,
      weatherId: weatherAt(cells, user.lastLat, user.lastLong),
    };
  } catch (error) {
    console.error("Failed to resolve weather at last pin:", error);
    return { hasPin: false };
  }
}

function tierHeading(tier: number): string {
  return tier === RAID_CONFIG.MEGA_RAID_TIER ? "Mega raids" : `${tier}★ raids`;
}

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

      const { hasPin, weatherId } = ctx.from
        ? await weatherAtLastPin(ctx.from.id)
        : { hasPin: false, weatherId: undefined };
      const weather =
        weatherId === undefined ? undefined : GAME_WEATHER[weatherId];

      let header = `<a href="${URLS.LEEKDUCK_BOSS}">Current raid bosses</a> with 100% IV catch CP\n`;
      if (weather) {
        header += `Weather at your last pin: ${weather.emoji} ${weather.name} — boosted CP ranges marked ⚡`;
      } else if (hasPin) {
        header += "Weather at your last pin unknown — showing normal CP ranges";
      } else {
        header += "Send /sendLocation to see weather-boosted CP ranges";
      }
      
      // Structure: results[tier][isShadow] = array of boss names
      const results: Record<number, { regular: string[]; shadow: string[] }> = {};

      raidBossesData.forEach((raidBoss) => {
        const tier = raidBossTier(raidBoss);
        // One range only: the one that applies in the weather at the pin
        const bossName = bossInlineLabel(raidBoss, weatherId);
        
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

      // One message per tier so the 4096-char limit is never hit
      const sortedTiers = Object.keys(results)
        .map(Number)
        .sort((a, b) => a - b);
      const messages = sortedTiers.map((tier) => {
        const tierData = results[tier];
        const parts = [`<b>${tierHeading(tier)}</b>`];
        if (tierData.regular.length > 0) {
          parts.push(tierData.regular.join(", "));
        }
        if (tierData.shadow.length > 0) {
          parts.push(tierData.shadow.join(", "));
        }
        return parts.join("\n\n");
      });
      if (messages.length === 0) {
        messages.push("No raid bosses listed right now.");
      }

      if (!ctx.chat) {
        return;
      }
      const options = {
        parse_mode: "HTML" as const,
        link_preview_options: { is_disabled: true },
      };
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        editMessage.message_id,
        undefined,
        `${header}\n\n${messages[0]}`,
        options,
      );
      for (const message of messages.slice(1)) {
        await ctx.reply(message, options);
      }
    };

    // Register handler for both lowercase and camelCase
    bot.command("currentboss", currentBossHandler);
    bot.command("currentBoss", currentBossHandler);
  } catch (error) {
    console.error("Error in checkBoss:", error);
  }
};

export default checkBoss;
