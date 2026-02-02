import bot from "../lib/bot";
import { Markup } from "telegraf";
import { InlineKeyboardButton } from "typegram";

const LOCATION_TUTORIAL_IMAGE =
  "https://user-images.githubusercontent.com/24467184/147383291-61994fe2-ad11-4e0e-be8d-baf0cdec6b3d.png";

//location commands
const location = () => {
  bot.command("sendlocation", async (ctx) => {
    await ctx.replyWithPhoto(LOCATION_TUTORIAL_IMAGE, {
      caption:
        "Press the button below to send your location. You can use it to:\n" +
        "• Subscribe to a nearby gym\n" +
        "• Check nearby gym for raids\n" +
        "• Subscribe to perfect pokemon at this location\n" +
        "• Check nearby for perfect pokemon\n\n" +
        "/cancel to exit",
      reply_markup: {
        keyboard: [
          [
            {
              text: "Send your current location",
              request_location: true,
            },
          ],
        ],
        one_time_keyboard: true,
      },
    });
  });
  bot.on("location", (ctx) => {
    const { latitude, longitude } = ctx.message.location;
    let featureList: (InlineKeyboardButton & {
      hide?: boolean | undefined;
    })[] = [
      Markup.button.callback(
        "Subscribe to a nearby gym",
        `SG_${latitude}_${longitude}`,
      ),
      Markup.button.callback(
        "Check nearby gym for raids",
        `CG_${latitude}_${longitude}`,
      ),
      Markup.button.callback(
        "Subscribe to perfect pokemon at this location",
        `SP_${latitude}_${longitude}`,
      ),
      Markup.button.callback(
        "Check nearby for perfect pokemon",
        `CP_${latitude}_${longitude}`,
      ),
      Markup.button.callback("🚫 exit", `e`),
    ];

    return ctx.reply(
      "Select the feature you want to use with this location",
      Markup.inlineKeyboard(featureList, {
        //set up custom keyboard wraps for two columns
        wrap: (_btn, _index, _currentRow) => {
          return true;
        },
      }),
    );
  });
  bot.action("e", (ctx) => {
    ctx.answerCbQuery("Exit");
    ctx.editMessageText("Exit location handler");
  });
};

export default location;
