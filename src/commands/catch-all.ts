import bot from "../lib/bot";

//catchAll commands
const catchAll = () => {
  bot.hears(/\/(.+)/, (ctx) =>
    ctx.reply("Unknown command. /help for more info"),
  );

  bot.on("message", (ctx) => ctx.reply("/help for more info"));
};

export default catchAll;
