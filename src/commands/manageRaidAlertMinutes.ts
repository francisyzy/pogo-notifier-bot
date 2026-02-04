import { Scenes, Markup, Composer } from "telegraf";
import bot from "../lib/bot";
import { InlineKeyboardButton } from "typegram";
import { PrismaClient } from "@prisma/client";
import config from "../config";
import { RAID_ALERT_MINUTE_OPTIONS } from "../constants";

const prisma = new PrismaClient();

const manageRaidAlertMinutes = () => {
  try {
    const alertMinutesHandler = new Composer<Scenes.WizardContext>();
    alertMinutesHandler.action(/.+/, async (ctx) => {
      const action = ctx.match[0];
      //exit condition
      if (action === "e") {
        await ctx.editMessageText(`Exit manage raid alert minutes`);
        return await ctx.scene.leave();
      }

      const selectedMinutes = parseInt(action, 10);
      if (
        isNaN(selectedMinutes) ||
        !Number.isInteger(selectedMinutes) ||
        selectedMinutes < 1 ||
        selectedMinutes > 60
      ) {
        await ctx.editMessageText(
          `Invalid selection. Please select one of the options in the list or /cancel to exit.`,
        );
        return;
      }

      await prisma.user
        .update({
          where: { telegramId: ctx.from!.id },
          data: {
            raidAlertMinutes: selectedMinutes,
          },
        })
        .then(async () => {
          await ctx.editMessageText(
            `✅ Raid alert minutes set to ${selectedMinutes} minutes.\n\nYou will be notified ${selectedMinutes} minutes before raids start.\n\n/manageRaidAlertMinutes to update your preferences`,
          );
        })
        .catch(async (error) => {
          console.error("Error updating raidAlertMinutes:", error);
          await ctx.editMessageText(
            `❌ Error updating settings. If this persists, please contact support. /cancel to exit.`,
          );
        });

      return await ctx.scene.leave();
    });
    alertMinutesHandler.command("cancel", async (ctx) => {
      await ctx.reply("Exit raid alert minutes management", {
        ...Markup.removeKeyboard(),
      });
      return ctx.scene.leave();
    });
    alertMinutesHandler.use((ctx) =>
      ctx.reply(
        "Please select one of the options in the list or /cancel to exit",
      ),
    );

    const alertMinutesWizard =
      new Scenes.WizardScene<Scenes.WizardContext>(
        "raidAlertMinutesManage",
        async (ctx) => {
          if (
            ctx.from &&
            ctx.message &&
            ctx.message.chat.type === "private"
          ) {
            const user = await prisma.user.findUnique({
              where: { telegramId: ctx.from.id },
            });

            const currentMinutes =
              user?.raidAlertMinutes || config.raidAlertMinutes;

            let alertMinutesList: (InlineKeyboardButton & {
              hide?: boolean | undefined;
            })[] = [];

            RAID_ALERT_MINUTE_OPTIONS.forEach((minutes) => {
              const isSelected = currentMinutes === minutes;
              const label = isSelected ? `${minutes} min ✓` : `${minutes} min`;
              alertMinutesList.push(
                Markup.button.callback(label, minutes.toString()),
              );
            });

            alertMinutesList.push(Markup.button.callback("🚫 exit", "e"));

            await ctx.reply(
              `Current setting: <b>${currentMinutes} minutes</b>\n\nSelect how many minutes before a raid starts you want to be notified:\n\n<i>Example: If set to 5 minutes, you'll get a reminder 5 minutes before the raid starts.</i>`,
              {
                parse_mode: "HTML",
                ...Markup.inlineKeyboard(alertMinutesList, {
                  wrap: (_btn, _index, _currentRow) => {
                    // 3 buttons per row
                    return _currentRow.length >= 3;
                  },
                }),
              },
            );
            return ctx.wizard.next();
          } else {
            await ctx.reply("Please use the bot in a private chat");
            return await ctx.scene.leave();
          }
        },
        alertMinutesHandler,
      );

    const stage = new Scenes.Stage<Scenes.WizardContext>([
      alertMinutesWizard,
    ]);
    bot.use(stage.middleware());

    const manageRaidAlertMinutesHandler = (ctx: Scenes.WizardContext) => {
      return ctx.scene.enter("raidAlertMinutesManage");
    };
    
    // Register handler for both lowercase and camelCase
    bot.command("manageraidalertminutes", manageRaidAlertMinutesHandler);
    bot.command("manageRaidAlertMinutes", manageRaidAlertMinutesHandler);
  } catch (error) {
    console.error("Error in manageRaidAlertMinutes:", error);
  }
};

export default manageRaidAlertMinutes;
