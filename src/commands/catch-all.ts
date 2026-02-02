import bot from "../lib/bot";
import { Markup } from "telegraf";

//catchAll commands
const catchAll = () => {
  // Handle /cancel when not in a scene (e.g. sendlocation keyboard)
  bot.command("cancel", async (ctx) => {
    await ctx.reply("Exiting.", { ...Markup.removeKeyboard() });
  });

  bot.hears(/\/(.+)/, (ctx) =>
    ctx.reply("Unknown command. /help for more info", {
      ...Markup.removeKeyboard(),
    }),
  );

  bot.on("message", (ctx) =>
    ctx.reply("/help for more info", { ...Markup.removeKeyboard() }),
  );

  bot.action(/.+/, (ctx) =>
    ctx.editMessageText(
      "Buttons are not valid any more, please try again.",
    ),
  );
};

export default catchAll;
