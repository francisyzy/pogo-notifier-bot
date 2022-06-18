import { BotCommand } from "typegram";
/**
 * All admin commands here
 * @return {BotCommand[]} List of admin commands
 */
export function getBotCommands(): BotCommand[] {
  const rawBotCommands = [
    {
      command: "sendlocation",
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
      command: "currentboss",
      description: "Get current raid boss list",
    },
    {
      command: "events",
      description: "Get events channel link",
    },
  ];
  let botCommands: BotCommand[] = [];
  rawBotCommands.forEach((botCommand) => {
    botCommands.push({
      command: botCommand.command.toLowerCase(),
      description: botCommand.description.substring(0, 256),
    });
  });
  return botCommands;
}
