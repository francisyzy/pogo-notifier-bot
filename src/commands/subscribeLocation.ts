import { Scenes, session, Markup, Composer } from "telegraf";
import bot from "../lib/bot";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const subscribeLocation = () => {
  try {
    const locationHandler = new Composer<Scenes.WizardContext>();
    locationHandler.on("location", async (ctx) => {
      const { latitude, longitude } = ctx.message.location;

      await prisma.locationSubscribe.create({
        data: {
          userTelegramId: ctx.from.id,
          lat: latitude,
          long: longitude,
          Radius: 0.05, //https://gis.stackexchange.com/a/8674
        },
      });
      await ctx.reply("Added a perfect pokemon notify location", {
        ...Markup.removeKeyboard(),
      });

      return await ctx.scene.leave();
    });
    locationHandler.command(
      "/cancel",
      (ctx) => (
        ctx.reply("Exiting set perfect pokemon location notify", {
          ...Markup.removeKeyboard(),
        }),
        ctx.scene.leave()
      ),
    );
    locationHandler.use((ctx) =>
      //TODO update this photo
      ctx.replyWithPhoto(
        "https://user-images.githubusercontent.com/24467184/135873047-1f1636ad-d99c-466e-8044-4f3e72b4b4b7.JPG",
        {
          caption:
            "Please send your location by clicking the button on the keyboard",
        },
      ),
    );

    const locationSearchWizard =
      new Scenes.WizardScene<Scenes.WizardContext>(
        "subscribeLocation",
        async (ctx) => {
          if (ctx.message && ctx.message.chat.type === "private") {
            await ctx.reply(
              "Press the button to send your location to get notified about perfect pokemon near you. /cancel to exit",
              {
                reply_markup: {
                  keyboard: [
                    [
                      {
                        text: "Send your current location or a location to get notifications if perfect spawns there",
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
      );

    const stage = new Scenes.Stage<Scenes.WizardContext>([
      locationSearchWizard,
    ]);
    bot.use(session());
    bot.use(stage.middleware());

    bot.command("addlocation", (ctx) => {
      return ctx.scene.enter("subscribeLocation");
    });
  } catch (error) {
    console.log(error);
  }
};

export default subscribeLocation;
