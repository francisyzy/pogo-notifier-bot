import { Scenes, Markup, Composer } from "telegraf";
import bot from "../lib/bot";
import { Message } from "typegram";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const enterGymIdHandler = new Composer<Scenes.WizardContext>();
enterGymIdHandler.command("cancel", async (ctx) => {
  await ctx.reply("Cancelled.", { ...Markup.removeKeyboard() });
  return ctx.scene.leave();
});
enterGymIdHandler.on("text", async (ctx) => {
  const message = ctx.message as Message.TextMessage;
  (ctx.scene.state as Record<string, unknown>).gymId = message.text.trim();
  await ctx.reply("Please enter the new name for the gym:");
  return ctx.wizard.next();
});
enterGymIdHandler.use((ctx) =>
  ctx.reply("Please enter the gym ID (from the /gymLocation button data), or /cancel to exit."),
);

const enterNameHandler = new Composer<Scenes.WizardContext>();
enterNameHandler.command("cancel", async (ctx) => {
  await ctx.reply("Cancelled.", { ...Markup.removeKeyboard() });
  return ctx.scene.leave();
});
enterNameHandler.on("text", async (ctx) => {
  const message = ctx.message as Message.TextMessage;
  const gymId = (ctx.scene.state as Record<string, unknown>).gymId as string;
  const newName = message.text.trim();
  if (!newName) {
    await ctx.reply("Name cannot be empty. Please enter a name, or /cancel.");
    return;
  }
  try {
    const gym = await prisma.gym.update({
      where: { id: gymId },
      data: { gymString: newName },
    });
    await ctx.reply(`Gym renamed to "${gym.gymString}" (geoKey: ${gym.geoKey ?? "none"})`);
  } catch {
    await ctx.reply("Gym not found. Check the gym ID and try again using /namegym.");
  }
  return ctx.scene.leave();
});
enterNameHandler.use((ctx) =>
  ctx.reply("Please enter the gym name as a text message, or /cancel to exit."),
);

const nameGymScene = new Scenes.WizardScene<Scenes.WizardContext>(
  "nameGym",
  enterGymIdHandler,
  enterNameHandler,
);

const stage = new Scenes.Stage<Scenes.WizardContext>([nameGymScene]);
bot.use(stage.middleware());

bot.command("namegym", (ctx) => ctx.scene.enter("nameGym"));
