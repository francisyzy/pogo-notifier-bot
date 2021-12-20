import bot from "../lib/bot";

//catchAll commands
const catchAll = () => {
  bot.hears(/\/(.+)/, (ctx) =>
    ctx.reply("Unknown command. /help for more info"),
  );

  bot.on("message", (ctx) => ctx.reply("/help for more info"));

  bot.action(/.+/, async (ctx) => {
    await ctx.editMessageText(
      "Buttons not valid anymore, please try again.",
    );
  });
};

export default catchAll;
