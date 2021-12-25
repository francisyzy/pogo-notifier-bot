import got from "got";
import { pokemonMessage, raidBosses, raidMessage } from "../types";

/**
 * Formats raid message
 */
export async function raidMessageFormatter(
  raidMessage: raidMessage,
): Promise<string> {
  const raidBosses = (await got(
    "https://raw.githubusercontent.com/pmgo-professor-willow/data-leekduck/gh-pages/raid-bosses.min.json",
  ).json()) as raidBosses;

  let possibleBosses = `\n\n<a href="https://www.leekduck.com/boss/">Possible raid boss</a>: (`;
  let bossName = "";

  raidBosses.forEach((raidBoss) => {
    //change mega formatting
    let customMegaFormat = "";
    if (raidBoss.tier === "mega") {
      raidBoss.tier = "6";
      customMegaFormat = raidBoss.originalName.slice(5) + "_MEGA";
    }
    //TODO check if future forms are still correct
    //If the egg has popped, use leek duck info at the start
    if (raidMessage.pokemonId === raidBoss.no) {
      bossName = `<a href="https://www.pokebattler.com/raids/${
        customMegaFormat || raidBoss.originalName.replace(/\s/g, "_")
      }">${raidBoss.originalName}</a>`;
      bossName += raidBoss.shinyAvailable ? "✨" : "";
    } else if (Number(raidBoss.tier) === raidMessage.level) {
      possibleBosses += `<a href="https://www.pokebattler.com/raids/${
        raidMessage.level === 6
          ? customMegaFormat
          : raidBoss.originalName.replace(/\s/g, "_")
      }">${raidBoss.originalName}</a>`;
      possibleBosses += raidBoss.shinyAvailable ? "✨, " : ", ";
    }
  });
  possibleBosses = possibleBosses.slice(0, -2);
  possibleBosses += ")";

  //If leed duck has no info and raid has popped
  if (bossName === "" && raidMessage.level !== 0) {
    const { name: name } = await got(
      `https://pokeapi.co/api/v2/pokemon/${raidMessage.pokemonId}`,
    ).json();
    bossName = toTitleCase(name);
  }

  const message = `${raidMessage.level}★ Raid at <u>${
    raidMessage.name
  }</u> ${raidMessage.pokemonId === 0 ? "starting" : "started"} at ${
    raidMessage.start
  }${
    raidMessage.pokemonId === 0
      ? possibleBosses
      : ` with boss ${bossName}`
  }`;
  return message;
}

/**
 * Formats perfect message
 */
export async function perfectMessageFormatter(
  pokemonMessage: pokemonMessage,
): Promise<string> {
  const { name: name } = await got(
    `https://pokeapi.co/api/v2/pokemon/${pokemonMessage.pokemon_id}`,
  ).json();

  const message = `Perfect pokemon ${toTitleCase(name)}(CP ${
    pokemonMessage.cp
  }) despawns at ${pokemonMessage.despawnDate.toString()}`;
  return message;
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}
