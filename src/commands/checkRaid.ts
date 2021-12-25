import bot from "../lib/bot";
import { getRaids } from "../utils/getMaper";
import { updateGyms } from "../utils/gymAdder";
import { gymChecker } from "../utils/gymChecker";
import { raidMessageFormatter } from "../utils/messageFormatter";

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
  } catch (error) {
    console.log(error);
  }
};

export default checkRaid;
