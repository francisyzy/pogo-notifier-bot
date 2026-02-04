import bot from "../lib/bot";
import { getBotCommands } from "../utils/botCommands";

/**
 * Script to update bot commands in Telegram
 * Run this script to update the bot's command list without requiring users to run /start
 */
async function updateCommands() {
  try {
    const commands = getBotCommands();
    await bot.telegram.setMyCommands(commands);
    console.log("Bot commands updated successfully!");
    console.log("Commands:", commands.map((c) => `/${c.command}`).join(", "));
    process.exit(0);
  } catch (error) {
    console.error("Error updating bot commands:", error);
    process.exit(1);
  }
}

updateCommands();
