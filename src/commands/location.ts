import bot from "../lib/bot";
import { Markup } from "telegraf";
import { InlineKeyboardButton } from "typegram";

//location commands
const location = () => {
  bot.command("sendlocation", (ctx) => {
    ctx.reply(
      "Press the button to send your location to: \nSubscribe to a nearby gym\nCheck nearby gym for raids\nSubscribe to perfect pokemon\nCheck nearby for perfect pokemon",
      {
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
      },
    );
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
        "Subscribe to perfect pokemon",
        `SP_${latitude}_${longitude}`,
      ),
      Markup.button.callback(
        "Check nearby for perfect pokemon",
        `CP_${latitude}_${longitude}`,
      ),
      Markup.button.callback("🚫", `e`),
    ];

    return ctx.reply(
      "Select the feature you want to use with this location",
      Markup.inlineKeyboard(featureList, {
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
  });
  bot.action("e", (ctx) =>
    ctx.editMessageText("Exit location handler"),
  );
};

export default location;
