import { BotCommand } from "typegram";
/**
 * All admin commands here
 * @return {BotCommand[]} List of admin commands
 */
export function getBotCommands(): BotCommand[] {
  // NOTE: Command names MUST be lowercase. Telegram's setMyCommands API requires
  // lowercase command names. However, handlers can be registered for both
  // lowercase and camelCase versions to make commands case-insensitive for users.
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
      command: "manageraidalertminutes",
      description: "Set how many minutes before raids you want to be notified",
    },
    // TODO: Re-enable when raid-bosses.min.json upstream is fixed
    // {
    //   command: "currentboss",
    //   description: "Get current raid boss list",
    // },
    {
      command: "events",
      description: "Get events channel link",
    },
  ];
  let botCommands: BotCommand[] = [];
  rawBotCommands.forEach((botCommand) => {
    botCommands.push({
      command: botCommand.command,
      description: botCommand.description.substring(0, 256),
    });
  });
  return botCommands;
}
