import bot from "../lib/bot";
import { getRaids } from "../utils/getMaper";
import { updateGyms } from "../utils/gymAdder";
import { gymChecker, gymCheckerAdHoc } from "../utils/gymChecker";
import { gymSearcher } from "../utils/gymSearcher";
import {
  bossCount,
  raidMessageFormatter,
} from "../utils/messageFormatter";
import { Markup } from "telegraf";
import { InlineKeyboardButton, Message } from "typegram";
import config from "../config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const checkRaid = () => {
  try {
    bot.command("checkraid", async (ctx) => {
      const editMessage = await ctx.reply("Checking raids…");
      const raids = await getRaids();
      updateGyms(raids);
      const raidMessages = await gymChecker(raids, ctx.from.id);
      //Exit condition early to end command
      if (raidMessages.length === 0) {
        return ctx.telegram.editMessageText(
          ctx.message.chat.id,
          editMessage.message_id,
          undefined,
          "You have no raids at your subscriptions",
        );
      } else {
        await ctx.telegram.editMessageText(
          ctx.message.chat.id,
          editMessage.message_id,
          undefined,
          `You have ${raidMessages.length} raids at your subscriptions:`,
        );
      }
      for (const raidMessage of raidMessages) {
        await ctx.replyWithHTML(await raidMessageFormatter(raidMessage), {
          link_preview_options: { is_disabled: true },
        });
      }
      return;
    });
    bot.hears(/\/checkraid_(.+)/, async (ctx) => {
      //telegram command - is not clickable whereas _ is clickable
      const gymId = ctx.match[1].replaceAll("_", "-");
      const gym = await prisma.gym.findUnique({
        where: { id: gymId },
      });
      if (gym) {
        const raids = await getRaids();
        const raidMessages = await gymCheckerAdHoc(raids, [gym]);
        //Exit condition early to end command
        if (raidMessages.length === 0) {
          return ctx.replyWithHTML(
            `There is no raid happening at <u>${gym.gymString}</u>\n<i>If you think this is an error, check back in a few minutes to get updated information</i>`,
            {
              ...Markup.removeKeyboard(),
            },
          );
        } else {
          let remindBtn: (InlineKeyboardButton & {
            hide?: boolean | undefined;
          })[] = [];
          //If raid has not started, add remind button
          if (raidMessages[0].pokemonId === 0) {
            //Gets the number of bosses possible (for reminder message)
            const numberOfBoss = await bossCount(raidMessages[0]);
            remindBtn.push(
              //100 char limit on callback
              Markup.button.callback(
                "Remind me about this raid",
                `RR_${raidMessages[0].start.getTime()}_${
                  raidMessages[0].gymId
                }_${numberOfBoss}`,
              ),
            );
          }
          ctx.replyWithHTML(
            await raidMessageFormatter(raidMessages[0]),
            {
              link_preview_options: { is_disabled: true },
              ...Markup.removeKeyboard(),
              ...Markup.inlineKeyboard(remindBtn),
            },
          );
        }
      } else {
        return ctx.reply("Gym not found", {
          ...Markup.removeKeyboard(),
        });
      }
      return;
    });

    bot.command("checkraid_", async (ctx) => {
      const gym = await prisma.gym.findFirst({
        select: { id: true },
      });
      if (gym && "id" in gym) {
        const gymWithId = gym as { id: string };
        return ctx.reply(
          `You need to include a id, eg: /checkraid_${gymWithId.id.replaceAll(
            "-",
            "_",
          )}`,
        );
      }
      return;
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
      //Exit condition early to end command
      if (raidMessages.length === 0) {
        return ctx.reply("You have no raids nearby", {
          ...Markup.removeKeyboard(),
        });
      }
      for (const raidMessage of raidMessages) {
        let remindBtn: (InlineKeyboardButton & {
          hide?: boolean | undefined;
        })[] = [];
        //If raid has not started, add remind button
        if (raidMessage.pokemonId === 0) {
          //Gets the number of bosses possible (for reminder message)
          const numberOfBoss = await bossCount(raidMessage);
          remindBtn.push(
            //100 char limit on callback
            Markup.button.callback(
              "Remind me about this raid",
              `RR_${raidMessage.start.getTime()}_${
                raidMessage.gymId
              }_${numberOfBoss}`,
            ),
          );
        }
        await ctx.replyWithHTML(await raidMessageFormatter(raidMessage), {
          link_preview_options: { is_disabled: true },
          ...Markup.removeKeyboard(),
          ...Markup.inlineKeyboard(remindBtn),
        });
      }
      return;
    });

    bot.action(/RR_+/, async (ctx) => {
      await ctx.answerCbQuery("Setting up reminder");
      const raidStartTime = Number(ctx.match.input.split("_")[1]);
      //telegram command - is not clickable whereas _ is clickable
      const gymId = ctx.match.input
        .split("_")[2]
        .replaceAll("-", "_");
      const numberOfBoss = Number(ctx.match.input.split("_")[3]);
      const user = await prisma.user.findUnique({
        where: { telegramId: ctx.from!.id },
      });
      const raidAlertMinutes =
        user?.raidAlertMinutes || config.raidAlertMinutes;

      let message = "";
      const offsetMs =
        raidStartTime -
        new Date().getTime() -
        raidAlertMinutes * 60000;
      //* 60000, 1min = 60000ms
      if (offsetMs > 0) {
        setTimeout(() => {
          bot.telegram.sendMessage(
            ctx.from!.id,
            `Raid starting in ${raidAlertMinutes} mins${
              numberOfBoss === 1
                ? ""
                : "\n\n/checkraid_" +
                  gymId +
                  " to check which raid boss spawned, after the egg popped"
            }`,
            {
              ...(ctx.callbackQuery.message?.message_id != null && {
                reply_parameters: {
                  message_id: ctx.callbackQuery.message.message_id,
                },
              }),
              parse_mode: "HTML",
            },
          );
        }, offsetMs);
        message = `Will remind you about this raid when the raid is going to start in ${raidAlertMinutes} minutes`;
      } else if (
        raidStartTime - new Date().getTime() <
        raidAlertMinutes * 60000
      ) {
        message = `Raid starts within ${raidAlertMinutes} minutes, you cannot set reminder${
          numberOfBoss === 1
            ? ""
            : "\n\n/checkraid_" +
              gymId +
              " to check which raid boss spawned, after the egg pops"
        }`;
      } else {
        message = `Raid has started, you cannot set reminder${
          numberOfBoss === 1
            ? ""
            : "\n\n/checkraid_" +
              gymId +
              " to check which raid boss spawned"
        }`;
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
