import bot from "../lib/bot";
import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import { toEscapeHTMLMsg } from "../utils/messageHandler";
import config from "../config";
import { getBotCommands, getBotCommandsForDisplay } from "../utils/botCommands";
import { LINKS } from "../constants";
import {
  formatDistanceToNow,
  formatISO9075,
  subDays,
  subHours,
} from "date-fns";

const prisma = new PrismaClient();

// "2026-09-19 14:03 (about 2 hours ago)" in the bot's (Singapore) clock
const formatWhen = (date: Date) => {
  const stamp = formatISO9075(date).slice(0, 16); // drop the seconds
  return `${stamp} (${formatDistanceToNow(date, { addSuffix: true })})`;
};

// Owner-only pulse of how the bot is being used, without opening the DB
const botUsageStats = async () => {
  const now = new Date();
  const activeSince = (since: Date) =>
    prisma.user.count({ where: { lastActivity: { gte: since } } });
  const [
    users,
    active24h,
    active7d,
    active30d,
    gymSubscriptions,
    locationSubscriptions,
    gyms,
    quietHourUsers,
  ] = await Promise.all([
    prisma.user.count(),
    activeSince(subHours(now, 24)),
    activeSince(subDays(now, 7)),
    activeSince(subDays(now, 30)),
    prisma.gymSubscribe.count(),
    prisma.locationSubscribe.count(),
    prisma.gym.count(),
    prisma.notifyWindow
      .findMany({
        distinct: ["userTelegramId"],
        select: { userTelegramId: true },
      })
      .then((rows) => rows.length),
  ]);
  return (
    `<b>Bot usage</b>\n` +
    `Users: ${users}\n` +
    `Active in last 24 h / 7 d / 30 d: ${active24h} / ${active7d} / ${active30d}\n` +
    `Gym subscriptions: ${gymSubscriptions}\n` +
    `Perfect location subscriptions: ${locationSubscriptions}\n` +
    `Gyms in DB: ${gyms}\n` +
    `Users with quiet hours: ${quietHourUsers}`
  );
};
//General helper commands
const helper = () => {
  //All bots start with /start
  bot.start(async (ctx) => {
    bot.telegram.setMyCommands(getBotCommands());
    if (ctx.from) {
      await prisma.user.upsert({
        where: { telegramId: ctx.from.id },
        update: { name: ctx.from.first_name },
        create: {
          telegramId: ctx.from.id,
          raidLevelNotify: "1, 3, 5, 6, 11, 13",
          name: ctx.from.first_name,
        },
      });
    }
    if (ctx.message && ctx.message.chat.type === "private") {
      return ctx.reply(
        "Welcome to the Pokemon Go Notifier Butler. This bot will notify you about raids at your gyms or perfect pokemon near you\n\nUse the menu to find out more about the commands\n\n/help for more info",
      );
    } else {
      return ctx.reply("Please use the bot in a private chat");
    }
  });

  bot.command("stopNotifyingMeToday", async (ctx) => {
    await prisma.user.update({
      where: { telegramId: ctx.from.id },
      data: { stopNotifyingMeToday: new Date() },
    });
    return ctx.replyWithHTML(
      "Will stop notifying you about raids for the rest of today. Perfect/legendary spawn alerts are unaffected; use /quietHours for those.\n\n<i>/undoStopNotifyingMeToday</i>",
    );
  });
  bot.command("undoStopNotifyingMeToday", async (ctx) => {
    await prisma.user.update({
      where: { telegramId: ctx.from.id },
      data: { stopNotifyingMeToday: null },
    });
    return ctx.replyWithHTML(
      "Will notify you about raids again today. (This only affects raids; spawn alerts follow /quietHours.)\n\n<i>/stopNotifyingMeToday</i>",
    );
  });

  bot.command("stats", async (ctx) => {
    const telegramId = ctx.from.id;
    const user = await prisma.user.findUnique({
      where: { telegramId },
    });
    if (!user) {
      return ctx.reply("Please /start to create an account");
    }
    const [gymsSubscribed, locationsSubscribed] = await Promise.all([
      prisma.gymSubscribe.count({
        where: { userTelegramId: telegramId },
      }),
      prisma.locationSubscribe.count({
        where: { userTelegramId: telegramId },
      }),
    ]);
    let message =
      `<b>Name</b>: ${toEscapeHTMLMsg(user.name)}\n` +
      `<b>Joined</b>: ${formatWhen(user.createdAt)}\n` +
      `<b>Last active</b>: ${formatWhen(user.lastActivity)}\n` +
      `<b>Gyms subscribed</b>: ${gymsSubscribed}\n` +
      `<b>Perfect locations</b>: ${locationsSubscribed}\n` +
      `<b>Number of Raids notified about</b>: ${user.gymTimesNotified}\n` +
      `<b>Number of Perfect pokemon notified about</b>: ${user.locationTimesNotified}`;
    if (telegramId === config.OWNER_ID) {
      message += "\n\n" + (await botUsageStats());
    }
    return ctx.replyWithHTML(message);
  });

  bot.help(async (ctx) => {
    const commands = getBotCommandsForDisplay();
    let returnString =
      "Use the following commands to configure the bot to notify you about Perfect Pokemon spawns or Raids. /events to get access to upcoming events channel\n\n";
    commands.forEach((command) => {
      returnString += "/" + command.command + "\n";
      returnString += "<i>" + command.description + "</i>\n\n";
    });
    returnString += `<i>For bug reports, please create an issue at <a href="${LINKS.ISSUES}">Github</a></i>`;
    return ctx.replyWithHTML(returnString);
  });
  bot.command("perfect", (ctx) => {
    return ctx.replyWithHTML(
      "/checkPerfect to get the list of perfect Pokemons currently spawned\n\n<u>Use this commands to add notification</u>\n/addLocation to send your location and pick a radius to get notified when a perfect Pokemon spawns nearby\n\n<u>Options</u>\n/myLocations to see your perfect locations on a map\n/managePerfect to change the radius of or remove a perfect location\n\n/quietHours to set the days and hours you want to be notified",
    );
  });
  bot.command("raids", (ctx) => {
    return ctx.replyWithHTML(
      "/checkRaid to check for all raids at your gyms\n\n<u>Use these commands to add notification when the gym has any raids.</u>\n/gymLocation to send your location to look for nearby Gyms\n\n/gymName to search for Gyms using Gym Names\n\n<u>Options</u>\n/manageGyms to remove gym notifications\n\n/renameGym to name a gym that has no name (or fix a wrong one)\n\n/manageRaidLevel to select which ★ level to get notified about\n\n/manageRaidAlertMinutes to set how many minutes before raids you want to be notified\n\n/stopNotifyingMeToday to mute raid alerts (only) for the rest of today\n\n/quietHours to set the days and hours you want to be notified, per gym if you like",
    );
  });
  bot.command("events", (ctx) => {
    return ctx.reply(
      `Subscribe to this Telegram Channel to get notified about events 15 minutes before they start!\n${LINKS.EVENTS_CHANNEL}`,
    );
  });

  bot.command("pull", async (ctx) => {
    if (ctx.from.id !== config.OWNER_ID) {
      return ctx.reply("Unauthorized");
    }
    if (process.env.NODE_ENV === "production") {
      try {
        execSync("git pull && npm run build && pm2 reload all", { stdio: "inherit" });
        return ctx.reply("Pulled, built, and reloaded.");
      } catch {
        return ctx.reply("Pull/build/reload failed. Check server logs.");
      }
    } else {
      return ctx.reply("Not on prod");
    }
  });
};

export default helper;
