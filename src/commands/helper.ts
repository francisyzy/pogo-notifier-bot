import bot from "../lib/bot";
import { PrismaClient } from "@prisma/client";
import { toEscapeHTMLMsg } from "../utils/messageHandler";
import { getBotCommands } from "../utils/botCommands";
import { LINKS } from "../constants";

const prisma = new PrismaClient();
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
      "Will stop notifying you about raids today!\n\n<i>/undoStopNotifyingMeToday</i>",
    );
  });
  bot.command("undoStopNotifyingMeToday", async (ctx) => {
    await prisma.user.update({
      where: { telegramId: ctx.from.id },
      data: { stopNotifyingMeToday: null },
    });
    return ctx.replyWithHTML(
      "Will notify you about raids today!\n\n<i>/stopNotifyingMeToday</i>",
    );
  });

  bot.command("stats", async (ctx) => {
    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from.id },
    });
    if (user) {
      return ctx.replyWithHTML(
        `<b>Name</b>: ${toEscapeHTMLMsg(
          user.name,
        )} \n<b>Joined at</b>: ${
          user.createdAt
        }\n<b>Number of Raids notified about</b>: ${
          user.gymTimesNotified
        }\n<b>Number of Perfect pokemon notified about</b>: ${
          user.locationTimesNotified
        }`,
      );
    } else {
      return ctx.reply("Please /start to create an account");
    }
  });

  bot.help(async (ctx) => {
    const commands = getBotCommands();
    let returnString =
      "Use the following commands to configure the bot to notify you about Perfect Pokemon spawns or Raids. /events to get access to upcoming events channel\n\n";
    commands.forEach((command) => {
      // Display camelCase for certain commands in help menu
      let displayCommand = command.command;
      if (command.command === "sendlocation") {
        displayCommand = "sendLocation";
      } else if (command.command === "manageraidalertminutes") {
        displayCommand = "manageRaidAlertMinutes";
      }
      returnString += "/" + displayCommand + "\n";
      // Remove the "(use /command)" part from description if present
      const cleanDescription = command.description.replace(/\s*\(use \/[^)]+\)\s*/g, "");
      returnString += "<i>" + cleanDescription + "</i>\n\n";
    });
    returnString += `<i>For bug reports, please create an issue at <a href="${LINKS.ISSUES}">Github</a></i>`;
    return ctx.replyWithHTML(returnString);
  });
  bot.command("perfect", (ctx) => {
    return ctx.replyWithHTML(
      "/checkPerfect to get the list of perfect Pokemons currently spawned\n\n<u>Use this commands to add notification</u>\n/addLocation to send your location to get notified when a perfect Pokemon spawns\n\n<u>Options</u>\n/managePerfect to remove a perfect location",
    );
  });
  bot.command("raids", (ctx) => {
    return ctx.replyWithHTML(
      "/checkRaid to check for all raids at your gyms\n\n<u>Use these commands to add notification when the gym has any raids.</u>\n/gymLocation to send your location to look for nearby Gyms\n\n/gymName to search for Gyms using Gym Names\n\n<u>Options</u>\n/manageGyms to remove gym notifications\n\n/manageRaidLevel to select which ★ level to get notified about\n\n/manageRaidAlertMinutes to set how many minutes before raids you want to be notified",
    );
  });
  bot.command("events", (ctx) => {
    return ctx.reply(
      `Subscribe to this Telegram Channel to get notified about events 15 minutes before they start!\n${LINKS.EVENTS_CHANNEL}`,
    );
  });
};

export default helper;
