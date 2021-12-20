import bot from "../lib/bot";
import { getPerfect } from "../utils/getMaper";
import got from "got";

const checkPerfect = () => {
  try {
    bot.command("checkpokemon", async (ctx) => {
      const pokemons = await getPerfect();

      if (pokemons.length === 0) {
        return ctx.reply("No Perfect Pokemon detected at the moment");
      }

      for await (const pokemon of pokemons) {
        const { name: name } = await got(
          `https://pokeapi.co/api/v2/pokemon/${pokemon.pokemon_id}`,
        ).json();
        ctx.reply(
          `Perfect pokemon ${name}(CP ${
            pokemon.cp
          }) despawns at ${new Date(
            Number(pokemon.despawn.toString() + "000"),
          )}`,
        );
        ctx.replyWithLocation(pokemon.lat, pokemon.lng);
      }
    });
  } catch (error) {
    console.log(error);
  }
};

export default checkPerfect;
