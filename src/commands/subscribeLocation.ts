import { Scenes, Markup, Composer } from "telegraf";
import bot from "../lib/bot";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const subscribeLocation = () => {
  try {
    const locationHandler = new Composer<Scenes.WizardContext>();
    locationHandler.on("location", async (ctx) => {
      const { latitude, longitude } = ctx.message.location;

      await prisma.user.upsert({
        where: { telegramId: ctx.from.id },
        update: { name: ctx.from.first_name },
        create: {
          telegramId: ctx.from.id,
          raidLevelNotify: "1, 3, 5, 6, 11, 13",
          name: ctx.from.first_name,
        },
      });
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
      ctx.replyWithPhoto(
        "https://user-images.githubusercontent.com/24467184/147383291-61994fe2-ad11-4e0e-be8d-baf0cdec6b3d.png",
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
    bot.use(stage.middleware());

    bot.command("addLocation", (ctx) => {
      return ctx.scene.enter("subscribeLocation");
    });
    bot.action(/SP_+/, async (ctx) => {
      await ctx.answerCbQuery("Adding location");
      const input = ctx.match.input.split("_");
      ctx.editMessageText("Adding location");
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
        await prisma.locationSubscribe.create({
          data: {
            userTelegramId: ctx.from.id,
            lat: Number(input[1]),
            long: Number(input[2]),
            Radius: 0.05, //https://gis.stackexchange.com/a/8674
          },
        });
        return ctx.reply("Added a perfect pokemon notify location", {
          ...Markup.removeKeyboard(),
        });
      } else {
        return ctx.reply("Please use the bot in a private chat", {
          ...Markup.removeKeyboard(),
        });
      }
    });
  } catch (error) {
    console.log(error);
  }
};

export default subscribeLocation;
