import { Scenes, Markup, Composer } from "telegraf";
import bot from "../lib/bot";
import { InlineKeyboardButton } from "typegram";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function formatLocation(lat: number, long: number): string {
  return `📍 ${lat.toFixed(2)}, ${long.toFixed(2)}`;
}

const manageSubscribeLocation = () => {
  try {
    const locationHandler = new Composer<Scenes.WizardContext>();
    locationHandler.action(/.+/, async (ctx) => {
      const selectedLocationId = ctx.match[0];
      //exit condition
      if (selectedLocationId[0] === "e") {
        await ctx.editMessageText(`Exit manage perfect location subscription`);
        return await ctx.scene.leave();
      }

      const subscription = await prisma.locationSubscribe.findFirst({
        where: {
          locationId: selectedLocationId,
          userTelegramId: ctx.from!.id,
        },
      });

      if (subscription) {
        await prisma.locationSubscribe.delete({
          where: { locationId: selectedLocationId },
        });
        await ctx.editMessageText(
          `You removed ${formatLocation(subscription.lat, subscription.long)} from your perfect Pokemon subscriptions`,
        );
      } else {
        await ctx.editMessageText(
          `This location was <b>already</b> removed from your subscriptions!`,
          { parse_mode: "HTML" },
        );
      }

      return await ctx.scene.leave();
    });
    locationHandler.command("cancel", async (ctx) => {
      await ctx.reply(
        "Exiting perfect location management. /managePerfect to remove locations",
        { ...Markup.removeKeyboard() },
      );
      return ctx.scene.leave();
    });
    locationHandler.use((ctx) =>
      ctx.reply(
        "Please select one of the locations in the list or /cancel to exit",
      ),
    );

    const locationListWizard =
      new Scenes.WizardScene<Scenes.WizardContext>(
        "perfectLocationManage",
        async (ctx) => {
          if (
            ctx.from &&
            ctx.message &&
            ctx.message.chat.type === "private"
          ) {
            const subscriptions = await prisma.locationSubscribe.findMany({
              where: { userTelegramId: ctx.from.id },
            });
            if (subscriptions.length != 0) {
              let locationBtnList: (InlineKeyboardButton & {
                hide?: boolean | undefined;
              })[] = [];
              subscriptions.forEach((subscription) => {
                locationBtnList.push(
                  Markup.button.callback(
                    formatLocation(subscription.lat, subscription.long),
                    subscription.locationId,
                  ),
                );
              });
              locationBtnList.push(Markup.button.callback("🚫", "e"));

              await ctx.reply(
                "Select location you want to remove from your perfect Pokemon subscription(s) or 🚫 to exit",
                Markup.inlineKeyboard(locationBtnList, {
                  wrap: (_btn, _index, currentRow) => {
                    if (currentRow.length === 2) {
                      return true;
                    } else {
                      return false;
                    }
                  },
                }),
              );
              return ctx.wizard.next();
            } else {
              await ctx.reply(
                "You have yet to subscribe to any perfect Pokemon locations",
              );
              return await ctx.scene.leave();
            }
          } else {
            await ctx.reply("Please use the bot in a private chat");
            return await ctx.scene.leave();
          }
        },
        locationHandler,
      );

    const stage = new Scenes.Stage<Scenes.WizardContext>([
      locationListWizard,
    ]);
    bot.use(stage.middleware());

    bot.command("myLocations", async (ctx) => {
      const subscriptions = await prisma.locationSubscribe.findMany({
        where: { userTelegramId: ctx.from.id },
      });

      let returnMessage =
        "You are subscribed to the following perfect Pokemon locations:\n";
      for (const subscription of subscriptions) {
        returnMessage += formatLocation(subscription.lat, subscription.long) + "\n";
      }
      returnMessage +=
        "\nYou can /managePerfect to remove locations that you no longer want to follow";

      return ctx.reply(returnMessage);
    });

    bot.command("managePerfect", (ctx) => {
      return ctx.scene.enter("perfectLocationManage");
    });
  } catch (error) {
    console.error("Error in manageSubscribeLocation:", error);
  }
};

export default manageSubscribeLocation;
