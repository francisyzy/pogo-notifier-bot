import { Scenes, Markup, Composer } from "telegraf";
import bot from "../lib/bot";
import { Message, InlineKeyboardButton } from "typegram";
import { PrismaClient } from "@prisma/client";
import {
  distanceSuffix,
  subscribedGymsByDistance,
} from "../utils/lastLocation";

const prisma = new PrismaClient();

const MAX_GYM_NAME_LENGTH = 64;
export const RENAME_GYM_ACTION_PREFIX = "RENAME_";

type RenameGymState = { gymId?: string };

/**
 * Drop a map pin for the gym so the user can see which one it is
 * (coordinates in a button label can't be copied or opened in a map).
 */
async function sendGymPin(ctx: Scenes.WizardContext, gymId: string) {
  const gym = await prisma.gym.findUnique({ where: { id: gymId } });
  if (!gym) return false;
  await ctx.reply(
    gym.gymString
      ? `Renaming ${gym.gymString}, this is where it is:`
      : "This gym has no name yet, this is where it is:",
  );
  await ctx.replyWithLocation(gym.lat, gym.long);
  return true;
}

/**
 * Inline button that jumps straight into the rename wizard for a gym.
 * Shown after subscribing to a gym that has no name.
 */
export function renameGymBtn(gymId: string) {
  return Markup.button.callback(
    "✏️ Name this gym",
    RENAME_GYM_ACTION_PREFIX + gymId,
  );
}

const renameGym = () => {
  try {
    const askForName = (ctx: Scenes.WizardContext) =>
      ctx.reply(
        `Enter the new name for the gym (max ${MAX_GYM_NAME_LENGTH} characters) or /cancel to exit`,
      );

    // Step: pick which subscribed gym to rename
    const pickGymHandler = new Composer<Scenes.WizardContext>();
    pickGymHandler.action(/.+/, async (ctx) => {
      const selectedGymId = ctx.match[0];
      //exit condition
      if (selectedGymId === "e") {
        await ctx.answerCbQuery();
        await ctx.editMessageText("Exit gym rename");
        return ctx.scene.leave();
      }
      await ctx.answerCbQuery("Gym selected");
      (ctx.scene.state as RenameGymState).gymId = selectedGymId;
      await ctx.editMessageText("Gym selected");
      if (!(await sendGymPin(ctx, selectedGymId))) {
        await ctx.reply(
          "Gym not found. It may have been removed, try again with /renameGym",
        );
        return ctx.scene.leave();
      }
      await askForName(ctx);
      return ctx.wizard.next();
    });
    pickGymHandler.command("cancel", async (ctx) => {
      await ctx.reply("Exiting gym rename", {
        ...Markup.removeKeyboard(),
      });
      return ctx.scene.leave();
    });
    pickGymHandler.use((ctx) =>
      ctx.reply(
        "Please select one of the gyms in the list or /cancel to exit",
      ),
    );

    // Step: enter the new name
    const enterNameHandler = new Composer<Scenes.WizardContext>();
    enterNameHandler.command("cancel", async (ctx) => {
      await ctx.reply("Exiting gym rename", {
        ...Markup.removeKeyboard(),
      });
      return ctx.scene.leave();
    });
    enterNameHandler.on("text", async (ctx) => {
      const message = ctx.message as Message.TextMessage;
      const gymId = (ctx.scene.state as RenameGymState).gymId;
      if (!gymId) {
        await ctx.reply("No gym selected. Use /renameGym to start again");
        return ctx.scene.leave();
      }

      const newName = message.text.replace(/\s+/g, " ").trim();
      if (!newName) {
        await ctx.reply("Name cannot be empty. Please enter a name, or /cancel");
        return;
      }
      if (newName.length > MAX_GYM_NAME_LENGTH) {
        await ctx.reply(
          `Name is too long (${newName.length} characters). Please keep it under ${MAX_GYM_NAME_LENGTH} characters, or /cancel`,
        );
        return;
      }

      try {
        const gym = await prisma.gym.update({
          where: { id: gymId },
          data: { gymString: newName },
        });
        await ctx.reply(`Gym renamed to ${gym.gymString}`, {
          ...Markup.removeKeyboard(),
        });
      } catch {
        await ctx.reply(
          "Gym not found. It may have been removed, try again with /renameGym",
        );
      }
      return ctx.scene.leave();
    });
    enterNameHandler.use((ctx) =>
      ctx.reply("Please send the gym name as a text message or /cancel to exit"),
    );

    const renameGymWizard = new Scenes.WizardScene<Scenes.WizardContext>(
      "renameGym",
      async (ctx) => {
        if (!ctx.from || ctx.chat?.type !== "private") {
          await ctx.reply("Please use the bot in a private chat");
          return ctx.scene.leave();
        }

        // Entered from the "Name this gym" button: gym already chosen
        const presetGymId = (ctx.scene.state as RenameGymState).gymId;
        if (presetGymId) {
          if (!(await sendGymPin(ctx, presetGymId))) {
            await ctx.reply(
              "Gym not found. It may have been removed, try again with /renameGym",
            );
            return ctx.scene.leave();
          }
          await askForName(ctx);
          return ctx.wizard.selectStep(2);
        }

        const { gyms } = await subscribedGymsByDistance(ctx.from.id);
        if (gyms.length === 0) {
          await ctx.reply(
            "You have yet to subscribe to any gyms. Use /gymLocation or /gymName to find gyms first",
          );
          return ctx.scene.leave();
        }

        let gymBtnList: (InlineKeyboardButton & {
          hide?: boolean | undefined;
        })[] = [];
        gyms.forEach((gym) => {
          gymBtnList.push(
            Markup.button.callback(
              // No "(unnamed)" prefix: long labels get truncated in the button
              (gym.gymString ?? gym.geoKey ?? gym.id) + distanceSuffix(gym),
              gym.id,
            ),
          );
        });
        gymBtnList.push(Markup.button.callback("🚫", "e"));

        await ctx.reply(
          "Select the gym you want to rename or 🚫 to exit",
          Markup.inlineKeyboard(gymBtnList, {
            //set up custom keyboard wraps for two columns
            wrap: (_btn, _index, currentRow) => {
              if (currentRow.length === 2) {
                return true;
              } else {
                return false;
              }
            },
          }),
        );
        return ctx.wizard.next();
      },
      pickGymHandler,
      enterNameHandler,
    );

    const stage = new Scenes.Stage<Scenes.WizardContext>([renameGymWizard]);
    bot.use(stage.middleware());

    bot.command(["renameGym", "renamegym", "namegym"], (ctx) => {
      return ctx.scene.enter("renameGym");
    });
    bot.action(new RegExp(`^${RENAME_GYM_ACTION_PREFIX}(.+)$`), (ctx) => {
      ctx.answerCbQuery("Renaming gym");
      return ctx.scene.enter("renameGym", { gymId: ctx.match[1] });
    });
  } catch (error) {
    console.error("Error in renameGym:", error);
  }
};

export default renameGym;
