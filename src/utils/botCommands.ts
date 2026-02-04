import { BotCommand } from "typegram";

interface RawBotCommand {
  command: string;
  description: string;
}

/**
 * Raw bot commands with camelCase names for display
 */
const rawBotCommands: RawBotCommand[] = [
  {
    command: "sendLocation",
    description:
      "Send your current location to check for nearby perfect pokemon or raids",
  },
  {
    command: "raids",
    description: "Get raids submenu",
  },
  {
    command: "perfect",
    description: "Get perfect Pokemon submenu",
  },
  {
    command: "stats",
    description: "See how many times you have been notified",
  },
  {
    command: "manageRaidAlertMinutes",
    description: "Set how many minutes before raids you want to be notified",
  },
  {
    command: "currentBoss",
    description: "Get current raid boss list",
  },
  {
    command: "events",
    description: "Get events channel link",
  },
];

/**
 * Get bot commands for Telegram's setMyCommands API (lowercase required)
 * @return {BotCommand[]} List of bot commands with lowercase command names
 */
export function getBotCommands(): BotCommand[] {
  const botCommands: BotCommand[] = [];
  rawBotCommands.forEach((botCommand) => {
    botCommands.push({
      command: botCommand.command.toLowerCase(),
      description: botCommand.description.substring(0, 256),
    });
  });
  return botCommands;
}

/**
 * Get bot commands for display purposes (camelCase)
 * @return {RawBotCommand[]} List of bot commands with original camelCase names
 */
export function getBotCommandsForDisplay(): RawBotCommand[] {
  return rawBotCommands;
}
