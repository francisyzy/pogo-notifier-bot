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
    {
      command: "searchname",
      description: "Find gym by name",
    },
    {
      command: "searchlocation",
      description: "Find gym by location",
    },
    {
      command: "checkraid",
      description: "Check if gyms you subscribed to has raids",
    },
    {
      command: "managegyms",
      description: "Manage gyms you subscribed to",
    },
    {
      command: "manageraidlevel",
      description: "Manage the gym level you want to get notified about",
    },
  ];
  return BotCommand;
}
