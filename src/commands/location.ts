import bot from "../lib/bot";
import { Markup, Scenes } from "telegraf";
import { InlineKeyboardButton } from "typegram";
import { IMAGES } from "../constants";

//location commands
const location = () => {
  const sendLocationHandler = async (ctx: Scenes.WizardContext) => {
    await ctx.replyWithPhoto(IMAGES.LOCATION_TUTORIAL, {
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
  };
  
  // Register handler for both lowercase and camelCase
  bot.command("sendlocation", sendLocationHandler);
  bot.command("sendLocation", sendLocationHandler);
  
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
      Markup.button.callback("🚫 exit", "loc_e"),
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
  bot.action("loc_e", (ctx) => {
    ctx.answerCbQuery("Exit");
    ctx.editMessageText("Exit location handler");
  });
};

export default location;
