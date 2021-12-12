import { Scenes, session, Markup, Composer } from "telegraf";
import bot from "../lib/bot";
import { InlineKeyboardButton } from "typegram";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const manageRaidLevels = () => {
  try {
    const raidLevelHandler = new Composer<Scenes.WizardContext>();
    raidLevelHandler.action(/.+/, async (ctx) => {
      const action = ctx.match[0].split("");
      //exit condition
      if (action[0] === "e") {
        await ctx.editMessageText(`Exit manage raid level`);
      }
      const raidLevel = Number(action[0]);

      const oldUser = await prisma.user.findUnique({
        where: { telegramId: ctx.from!.id },
      });
      let newRaidLevel = oldUser?.raidLevelNotify;
      if (action[1] === "a") { //add raid level to sub
        newRaidLevel?.push(raidLevel);
        newRaidLevel?.sort();
      } else if (action[1] === "r") { // remove raid level
        newRaidLevel = oldUser?.raidLevelNotify.filter(function (
          value,
          index,
          arr,
        ) {
          return value != raidLevel;
        });
      }

      await prisma.user
        .update({
          where: { telegramId: ctx.from!.id },
          data: { raidLevelNotify: newRaidLevel },
        })
        .then(async () => {
          if (action[1] === "a") {
            await ctx.editMessageText(
              `You added level ${raidLevel} to be notified about. /manageraidlevel to update your preferences`,
            );
          } else if (action[1] === "r") {
            await ctx.editMessageText(
              `You removed level ${raidLevel} to be notified about. /manageraidlevel to update your preferences`,
            );
          }
        })
        .catch(async (error) => {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === "P2002") {
              await ctx.editMessageText(
                `Are <b>already</b> not subscribed to this gym!`,
                { parse_mode: "HTML" },
              );
            }
          }
        });

      return await ctx.scene.leave();
    });
    raidLevelHandler.command(
      "/cancel",
      (ctx) => (
        ctx.reply("Exit raid level management", {
          ...Markup.removeKeyboard(),
        }),
        ctx.scene.leave()
      ),
    );
    raidLevelHandler.use((ctx) =>
      ctx.reply(
        "Please select one of the raid level in the list or /cancel to exit",
      ),
    );

    const raidLevelWizard =
      new Scenes.WizardScene<Scenes.WizardContext>(
        "raidLevelManage",
        async (ctx) => {
          if (
            ctx.from &&
            ctx.message &&
            ctx.message.chat.type === "private"
          ) {
            let raidLevelList: (InlineKeyboardButton & {
              hide?: boolean | undefined;
            })[] = [];
            const user = await prisma.user.findUnique({
              where: { telegramId: ctx.from.id },
            });

            //lol wank hard coding
            for (let i = 0; i < 4; i++) {
              let raidLevel = 0;
              if (i === 0) {
                raidLevel = 1;
              } else if (i === 1) {
                raidLevel = 3;
              } else if (i === 2) {
                raidLevel = 5;
              } else if (i === 3) {
                raidLevel = 6;
              }

              //make sure user is not null. but they shouldnt be
              if (
                user &&
                user.raidLevelNotify.indexOf(raidLevel) !== -1
              ) {
                raidLevelList.push(
                  Markup.button.callback(
                    raidLevel + "➖",
                    raidLevel + "r",
                  ),
                );
              } else {
                raidLevelList.push(
                  Markup.button.callback(
                    raidLevel + "➕",
                    raidLevel + "a",
                  ),
                );
              }
            }
            raidLevelList.push(Markup.button.callback("🚫", "e"));

            await ctx.reply(
              "➖ to remove notification of that raid level\n➕ to get notification of that raid level\n🚫 to exit",
              Markup.inlineKeyboard(raidLevelList),
            );
            return ctx.wizard.next();
          } else {
            await ctx.reply("Please use the bot in a private chat");
            return await ctx.scene.leave();
          }
        },
        raidLevelHandler,
      );

    const stage = new Scenes.Stage<Scenes.WizardContext>([
      raidLevelWizard,
    ]);
    bot.use(session());
    bot.use(stage.middleware());

    bot.command("manageraidlevel", (ctx) => {
      return ctx.scene.enter("raidLevelManage");
    });
  } catch (error) {
    console.log(error);
  }
};

export default manageRaidLevels;
