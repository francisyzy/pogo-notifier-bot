import { BotCommand } from "typegram";
/**
 * All admin commands here
 * @return {BotCommand[]} List of admin commands
 */
export function getBotCommands(): BotCommand[] {
  const BotCommand: BotCommand[] = [
    {
      command: "searchname",
      description: "Find gym by name",
    },
    {
      command: "searchlocation",
      description: "Find gym by location",
    },
    {
      command: "checkpokemon",
      description: "Check all the perfect pokemon currently spawning",
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
      description:
        "Manage the gym level you want to get notified about",
    },
    {
      command: "addlocation",
      description:
        "Get notified about perfect pokemons at the location you send",
    },
    {
      command: "stats",
      description: "See how many times you have been notified",
    },
  ];
  return BotCommand;
}
