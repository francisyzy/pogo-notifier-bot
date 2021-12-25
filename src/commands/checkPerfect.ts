import bot from "../lib/bot";
import { getPerfect } from "../utils/getMaper";
import { perfectMessageFormatter } from "../utils/messageFormatter";

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
        ctx
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
