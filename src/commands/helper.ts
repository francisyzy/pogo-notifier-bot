import bot from "../lib/bot";
import { PrismaClient } from "@prisma/client";
import { toEscapeHTMLMsg } from "../utils/messageHandler";
import { getBotCommands } from "../utils/botCommands";
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
          raidLevelNotify: [1, 3, 5, 6],
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
