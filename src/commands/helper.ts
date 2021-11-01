import bot from "../lib/bot";
import { PrismaClient } from "@prisma/client";
import { toEscapeHTMLMsg } from "../utils/messageHandler";
import { getBotCommands } from "../utils/botCommands";
import got from "got";
import { raids } from "../types";
import { notifyAndUpdateUsers } from "../utils/notifier";

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
          name: ctx.from.first_name,
        },
      });
    }
    if (ctx.message && ctx.message.chat.type === "private") {
      return ctx.reply("Welcome to the Pokemon Go Notifier Bot");
    } else {
      return ctx.reply("Please use the bot in a private chat");
    }
  });

  bot.command("test", async (ctx) => {
    notifyAndUpdateUsers();
  });

  bot.command("account", async (ctx) => {
    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from.id },
    });
    if (user) {
      return ctx.replyWithHTML(
        `<b>Name</b>: ${toEscapeHTMLMsg(
          user.name,
        )} \n<b>Joined at</b>: ${user.createdAt}`,
      );
    } else {
      return ctx.reply("Please /start to create an account");
    }
  });
  bot.help((ctx) => ctx.reply("Help message"));
};

export default helper;
