import bot from "../lib/bot";
import { getRaids } from "../utils/getMaper";
import { updateGyms } from "../utils/gymAdder";
import { gymChecker, gymCheckerAdHoc } from "../utils/gymChecker";
import { gymSearcher } from "../utils/gymSearcher";
import { raidMessageFormatter } from "../utils/messageFormatter";
import { Markup } from "telegraf";

const checkRaid = () => {
  try {
    bot.command("checkraid", async (ctx) => {
      const raids = await getRaids();
      updateGyms(raids);
      const raidMessages = await gymChecker(raids, ctx.from.id);
      if (raidMessages.length === 0) {
        return ctx.reply("You have no raids at your subscriptions");
      }
      for (const raidMessage of raidMessages) {
        ctx.replyWithHTML(await raidMessageFormatter(raidMessage), {
          disable_web_page_preview: true,
        });
      }
    });
    bot.action(/CG_+/, async (ctx) => {
      const input = ctx.match.input.split("_");
      ctx.editMessageText("Looking for raids nearby");
      const gyms = await gymSearcher(
        Number(input[1]),
        Number(input[2]),
      );
      const raids = await getRaids();
      const raidMessages = await gymCheckerAdHoc(raids, gyms);
      if (raidMessages.length === 0) {
        return ctx.reply("You have no raids at your subscriptions", {
          ...Markup.removeKeyboard(),
        });
      }
      for (const raidMessage of raidMessages) {
        ctx.replyWithHTML(await raidMessageFormatter(raidMessage), {
          disable_web_page_preview: true,
          ...Markup.removeKeyboard(),
        });
      }
    });
  } catch (error) {
    console.log(error);
  }
};

export default checkRaid;
