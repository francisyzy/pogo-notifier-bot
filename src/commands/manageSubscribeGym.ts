import { Scenes, Markup, Composer } from "telegraf";
import bot from "../lib/bot";
import { InlineKeyboardButton } from "typegram";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const manageGyms = () => {
  try {
    const gymHandler = new Composer<Scenes.WizardContext>();
    gymHandler.action(/.+/, async (ctx) => {
      const selectedGymId = ctx.match[0];
      //exit condition
      if (selectedGymId[0] === "e") {
        await ctx.editMessageText(`Exit manage gym subscription`);
      }

      await prisma.gymSubscribe
        .delete({
          where: {
            userTelegramId_gymId: {
              gymId: selectedGymId,
              userTelegramId: ctx.from!.id,
            },
          },
          include: { gym: true },
        })
        .then(async (gymSubscribe) => {
          await ctx.editMessageText(
            `You removed ${gymSubscribe.gym.gymString} from your subscriptions`,
          );
        })
        .catch(async (error) => {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === "P2002") {
              await ctx.editMessageText(
                `Are <b>already</b> not subscribed to this gym!`,
                { parse_mode: "HTML" },
              );
            }
          }
        });

      return await ctx.scene.leave();
    });
    gymHandler.command(
      "/cancel",
      (ctx) => (
        ctx.reply(
          "Exiting gym management. /managegyms to remove gyms",
          {
            ...Markup.removeKeyboard(),
          },
        ),
        ctx.scene.leave()
      ),
    );
    gymHandler.use((ctx) =>
      ctx.reply(
        "Please select one of the gyms in the list or /cancel to exit",
      ),
    );

    const gymListWizard =
      new Scenes.WizardScene<Scenes.WizardContext>(
        "gymListManage",
        async (ctx) => {
          if (
            ctx.from &&
            ctx.message &&
            ctx.message.chat.type === "private"
          ) {
            const subscriptions = await prisma.gymSubscribe.findMany({
              where: { userTelegramId: ctx.from.id },
              include: { gym: true },
            });
            if (subscriptions.length != 0) {
              //TODO add mapper to sort the gyms by the location thats closest to the user's current location
              let gymBtnList: (InlineKeyboardButton & {
                hide?: boolean | undefined;
              })[] = [];
              subscriptions.forEach((subscription) => {
                gymBtnList.push(
                  Markup.button.callback(
                    subscription.gym.gymString,
                    subscription.gymId,
                  ),
                );
              });
              gymBtnList.push(Markup.button.callback("🚫", "e"));

              await ctx.reply(
                "Select gym you want to remove from your subscription(s) or 🚫 to exit",
                Markup.inlineKeyboard(gymBtnList, {
                  //set up custom keyboard wraps for two columns
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
                "You have yet to subscribe to any gyms",
              );
              return await ctx.scene.leave();
            }
          } else {
            await ctx.reply("Please use the bot in a private chat");
            return await ctx.scene.leave();
          }
        },
        gymHandler,
      );

    const stage = new Scenes.Stage<Scenes.WizardContext>([
      gymListWizard,
    ]);
    bot.use(stage.middleware());

    bot.command("mygyms", async (ctx) => {
      const subscriptions = await prisma.gymSubscribe.findMany({
        where: { userTelegramId: ctx.from.id },
        include: { gym: true },
      });

      let returnMessage =
        "You are subscribed to the following gyms:\n";
      for (const subscription of subscriptions) {
        returnMessage += subscription.gym.gymString + "\n";
      }
      returnMessage +=
        "\nYou can /managegyms to remove the gyms that you no longer want to follow";

      return ctx.reply(returnMessage);
    });

    bot.command("managegyms", (ctx) => {
      return ctx.scene.enter("gymListManage");
    });
  } catch (error) {
    console.log(error);
  }
};

export default manageGyms;
