import { Scenes, session, Markup, Composer } from "telegraf";
import bot from "../lib/bot";
import { Message, InlineKeyboardButton } from "typegram";
import { PrismaClient, Prisma } from "@prisma/client";
import { gymSearcherBtn } from "../utils/gymSearcher";

const prisma = new PrismaClient();

const subscribe = () => {
  try {
    const locationHandler = new Composer<Scenes.WizardContext>();
    locationHandler.on("location", async (ctx) => {
      await ctx.reply("Searching for gyms near you!", {
        ...Markup.removeKeyboard(),
      });

      const { latitude, longitude } = ctx.message.location;

      const gymBtnList = await gymSearcherBtn(latitude, longitude);
      if (gymBtnList.length !== 0) {
        await ctx.reply(
          "Select gym you want to subscribe",
          Markup.inlineKeyboard(gymBtnList, {
            //set up custom keyboard wraps for two columns
            wrap: (btn, index, currentRow) => {
              if (currentRow.length === 2) {
                return true;
              } else {
                return false;
              }
            },
          }),
        );
      } else {
        await ctx.reply("No Gyms found near you?");
        return await ctx.scene.leave();
      }
      return ctx.wizard.next();
    });
    locationHandler.command(
      "/cancel",
      (ctx) => (
        ctx.reply("Exiting location gym search", {
          ...Markup.removeKeyboard(),
        }),
        ctx.scene.leave()
      ),
    );
    locationHandler.use((ctx) =>
      ctx.replyWithPhoto(
        "https://user-images.githubusercontent.com/24467184/147383291-61994fe2-ad11-4e0e-be8d-baf0cdec6b3d.png",
        {
          caption:
            "Please send your location by clicking the button on the keyboard or /cancel to exit location search",
        },
      ),
    );
    const searchHandler = new Composer<Scenes.WizardContext>();
    searchHandler.command(
      "/cancel",
      (ctx) => (
        ctx.reply("Exiting gym search", {
          ...Markup.removeKeyboard(),
        }),
        ctx.scene.leave()
      ),
    );
    searchHandler.command("/subscribebyname", (ctx) =>
      ctx.reply(
        "You can enter the gym name to search for it. /cancel to exit",
      ),
    );
    searchHandler.on("message", async (ctx) => {
      await ctx.reply("Searching for gyms!", {
        ...Markup.removeKeyboard(),
      });

      const message = ctx.message as Message.TextMessage;

      const gyms = await prisma.gym.findMany({
        where: {
          gymString: { contains: message.text, mode: "insensitive" },
        },
      });
      if (gyms.length != 0) {
        let gymBtnList: (InlineKeyboardButton & {
          hide?: boolean | undefined;
        })[] = [];
        gyms.forEach((gym) => {
          gymBtnList.push(
            Markup.button.callback(gym.gymString, gym.id),
          );
        });

        await ctx.reply(
          "Select gym you want to subscribe",
          Markup.inlineKeyboard(gymBtnList, {
            //set up custom keyboard wraps for two columns
            wrap: (btn, index, currentRow) => {
              if (currentRow.length === 2) {
                return true;
              } else {
                return false;
              }
            },
          }),
        );
      } else {
        await ctx.reply("No Gyms found");
        return await ctx.scene.leave();
      }
      return ctx.wizard.next();
    });

    const gymHandler = new Composer<Scenes.WizardContext>();
    gymHandler.action(/.+/, async (ctx) => {
      const selectedGymId = ctx.match[0];

      await prisma.gymSubscribe
        .create({
          data: {
            gymId: selectedGymId,
            userTelegramId: ctx.from!.id,
          },
          include: { gym: true },
        })
        .then(async (gymSubscribe) => {
          await ctx.editMessageText(
            `You have subscribed to ${gymSubscribe.gym.gymString}`,
          );
        })
        .catch(async (error) => {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === "P2002") {
              await ctx.editMessageText(
                `You have <b>already</b> subscribed to this gym!`,
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
        ctx.reply("Exiting gym search", {
          ...Markup.removeKeyboard(),
        }),
        ctx.scene.leave()
      ),
    );
    gymHandler.use((ctx) =>
      ctx.reply(
        "Please select one of the gyms in the list or /cancel to exit",
      ),
    );

    const locationSearchWizard =
      new Scenes.WizardScene<Scenes.WizardContext>(
        "gymSearchLocation",
        async (ctx) => {
          if (ctx.message && ctx.message.chat.type === "private") {
            await ctx.reply(
              "Press the button to send your location to find gyms near you. /cancel to exit",
              {
                reply_markup: {
                  keyboard: [
                    [
                      {
                        text: "Send your current location to search for nearby gyms",
                        request_location: true,
                      },
                    ],
                  ],
                  one_time_keyboard: true,
                },
              },
            );
            return ctx.wizard.next();
          } else {
            await ctx.reply("Please use the bot in a private chat");
            return await ctx.scene.leave();
          }
        },
        locationHandler,
        gymHandler,
      );
    const nameSearchWizard =
      new Scenes.WizardScene<Scenes.WizardContext>(
        "gymNameSearchLocation",
        async (ctx) => {
          if (ctx.message && ctx.message.chat.type === "private") {
            await ctx.reply(
              "You can enter the gym name to search for it. /cancel to exit",
            );
            return ctx.wizard.next();
          } else {
            await ctx.reply("Please use the bot in a private chat");
            return await ctx.scene.leave();
          }
        },
        searchHandler,
        gymHandler,
      );
    const locationWizard =
      new Scenes.WizardScene<Scenes.WizardContext>(
        "gymSearchLocation2",
        async (ctx) => {
          const state = ctx.scene.state as {
            lat: number;
            long: number;
          };
          const gymBtnList = await gymSearcherBtn(
            state.lat,
            state.long,
          );
          if (gymBtnList.length !== 0) {
            await ctx.reply(
              "Select gym you want to subscribe",
              Markup.inlineKeyboard(gymBtnList, {
                //set up custom keyboard wraps for two columns
                wrap: (btn, index, currentRow) => {
                  if (currentRow.length === 2) {
                    return true;
                  } else {
                    return false;
                  }
                },
                ...Markup.removeKeyboard(),
              }),
            );
          } else {
            await ctx.reply("No Gyms found near you?", {
              ...Markup.removeKeyboard(),
            });
            return await ctx.scene.leave();
          }
          return ctx.wizard.next();
        },
        gymHandler,
      );

    const stage = new Scenes.Stage<Scenes.WizardContext>([
      locationSearchWizard,
      nameSearchWizard,
      locationWizard,
    ]);
    bot.use(session());
    bot.use(stage.middleware());

    bot.command("subscribebylocation", (ctx) => {
      return ctx.scene.enter("gymSearchLocation");
    });
    bot.command("subscribebyname", (ctx) => {
      return ctx.scene.enter("gymNameSearchLocation");
    });
    bot.action(/SG_+/, (ctx) => {
      const input = ctx.match.input.split("_");
      ctx.editMessageText("Searching for gyms");
      //https://stackoverflow.com/a/66858541
      return ctx.scene.enter("gymSearchLocation2", {
        lat: Number(input[1]),
        long: Number(input[2]),
      });
    });
  } catch (error) {
    console.log(error);
  }
};

export default subscribe;
