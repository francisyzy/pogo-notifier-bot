import { BotCommand } from "typegram";
/**
 * All admin commands here
 * @return {BotCommand[]} List of admin commands
 */
export function getBotCommands(): BotCommand[] {
  const BotCommand: BotCommand[] = [
    {
      command: "start",
      description: "Set/Change your name",
    },
    {
      command: "account",
      description: "Get account information of user",
    },
  ];
  return BotCommand;
}
