import bot from "../lib/bot";
import { getRaids } from "../utils/getMaper";
import { updateGyms } from "../utils/gymAdder";
import { gymChecker, gymCheckerAdHoc } from "../utils/gymChecker";
import { gymSearcher } from "../utils/gymSearcher";
import { raidMessageFormatter } from "../utils/messageFormatter";
import { Markup } from "telegraf";
import { InlineKeyboardButton, Message } from "typegram";
import config from "../config";

const checkRaid = () => {
  try {
    bot.command("checkraid", async (ctx) => {
      const raids = await getRaids();
      updateGyms(raids);
      const raidMessages = await gymChecker(raids, ctx.from.id);
      if (raidMessages.length === 0) {
        return ctx.reply("You have no raids at your subscriptions");
      }
      for (const raidMessage of raidMessages) {
        ctx.replyWithHTML(await raidMessageFormatter(raidMessage), {
          disable_web_page_preview: true,
        });
      }
    });
    bot.action(/CG_+/, async (ctx) => {
      await ctx.answerCbQuery("Checking raids");
      const input = ctx.match.input.split("_");
      ctx.editMessageText("Looking for raids nearby");
      const gyms = await gymSearcher(
        Number(input[1]),
        Number(input[2]),
      );
      const raids = await getRaids();
      const raidMessages = await gymCheckerAdHoc(raids, gyms);
      if (raidMessages.length === 0) {
        return ctx.reply("You have no raids nearby", {
          ...Markup.removeKeyboard(),
        });
      }
      for (const raidMessage of raidMessages) {
        let remindBtn: (InlineKeyboardButton & {
          hide?: boolean | undefined;
        })[] = [];
        if (raidMessage.pokemonId === 0) {
          remindBtn.push(
            Markup.button.callback(
              "Remind me about this raid",
              `RR_${raidMessage.start.getTime()}`,
            ),
          );
        }
        ctx.replyWithHTML(await raidMessageFormatter(raidMessage), {
          disable_web_page_preview: true,
          ...Markup.removeKeyboard(),
          ...Markup.inlineKeyboard(remindBtn),
        });
      }
    });
    bot.action(/RR_+/, async (ctx) => {
      await ctx.answerCbQuery("Setting up reminder");
      const raidStartTime = Number(ctx.match.input.split("_")[1]);

      let message = "";
      const offsetMs =
        raidStartTime -
        new Date().getTime() -
        config.raidAlertMinutes * 60000;
      //* 60000, 1min = 60000ms
      if (offsetMs > 0) {
        setTimeout(() => {
          bot.telegram.sendMessage(
            ctx.from!.id,
            `Raid starting in ${config.raidAlertMinutes} mins`,
            {
              reply_to_message_id:
                ctx.callbackQuery.message?.message_id,
              parse_mode: "HTML",
            },
          );
        }, offsetMs);
        message =
          "Will remind you about this raid when the raid is going to start in 5 minutes";
      } else if (
        raidStartTime - new Date().getTime() <
        config.raidAlertMinutes * 60000
      ) {
        message = `Raid starts < ${config.raidAlertMinutes} minutes, you cannot set reminder`;
      } else {
        message = "Raid has started, you cannot set reminder";
      }
      if (ctx.callbackQuery.message) {
        return ctx.editMessageText(
          (ctx.callbackQuery.message as Message.TextMessage).text +
            "\n\n" +
            message,
        );
      } else {
        return ctx.reply(message);
      }
    });
  } catch (error) {
    console.log(error);
  }
};

export default checkRaid;
