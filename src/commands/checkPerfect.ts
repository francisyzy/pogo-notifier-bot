import bot from "../lib/bot";
import { getPerfect } from "../utils/getMaper";
import { perfectMessageFormatter } from "../utils/messageFormatter";
import { perfectCheckerAdHoc } from "../utils/perfectChecker";
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
        await sleep(0.5);
        await ctx
          .reply(await perfectMessageFormatter(pokemonMessage))
          .then(() => {
            ctx.replyWithLocation(pokemon.lat, pokemon.lng);
          });
      }
    });
    bot.action(/CP_+/, async (ctx) => {
      await ctx.answerCbQuery("Checking perfect pokemon");
      const input = ctx.match.input.split("_");
      ctx.editMessageText("Looking for perfect pokemon nearby");
      const pokemons = await getPerfect();

      if (pokemons.length === 0) {
        return ctx.reply("No Perfect Pokemon detected at the moment");
      }
      const pokemonMessages = await perfectCheckerAdHoc(
        pokemons,
        Number(input[1]),
        Number(input[2]),
      );
      pokemonMessages.forEach(async (pokemonMessage) => {
        await sleep(0.5);
        await ctx
          .reply(await perfectMessageFormatter(pokemonMessage))
          .then(() => {
            ctx.replyWithLocation(
              pokemonMessage.lat,
              pokemonMessage.lng,
            );
          });
      });
    });
  } catch (error) {
    console.log(error);
  }
};

export default checkPerfect;
