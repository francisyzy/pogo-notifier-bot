import bot from "../lib/bot";
import { getPerfect } from "../utils/getMaper";
import { perfectMessageFormatter } from "../utils/messageFormatter";
import { sleep } from "../utils/sleep";

const checkPerfect = () => {
  try {
    bot.command("checkpokemon", async (ctx) => {
      const pokemons = await getPerfect();

      if (pokemons.length === 0) {
        return ctx.reply("No Perfect Pokemon detected at the moment");
      }

      for await (const pokemon of pokemons) {
        const pokemonMessage = {
          despawnDate: new Date(
            Number(pokemon.despawn.toString() + "000"),
          ),
          userTelegramId: 0,
          locationId: "id",
          ...pokemon,
        };
        //Make sure the messages are sent in order
        await sleep(0.5)
        await ctx
          .reply(await perfectMessageFormatter(pokemonMessage))
          .then(() => {
            ctx.replyWithLocation(pokemon.lat, pokemon.lng);
          });
      }
    });
  } catch (error) {
    console.log(error);
  }
};

export default checkPerfect;
