import { formatDistanceToNow, formatISO9075 } from "date-fns";
import { pokemonMessage, raidBosses, raidMessage } from "../types";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  return response.json() as Promise<T>;
}

/**
 * Formats raid message
 * @param raidMessage original raidMessage information
 * @returns {Promise<string>} Message formatted to send to user
 */
export async function raidMessageFormatter(
  raidMessage: raidMessage,
): Promise<string> {
  const bosses = (await fetchJson<raidBosses>(
    "https://raw.githubusercontent.com/pmgo-professor-willow/data-leekduck/gh-pages/raid-bosses.min.json",
  )) as raidBosses;

  let possibleBosses = `\n\n<a href="https://www.leekduck.com/boss/">Possible raid boss</a>: (`;
  let bossName = "";

  bosses.forEach((raidBoss) => {
    const url = urlFormatter(raidBoss.originalName, raidBoss.tier);
    //If the egg has popped, use leek duck info at the start
    if (raidMessage.pokemonId === raidBoss.no) {
      bossName = `<a href="${url}">${raidBoss.originalName}</a>`;
      bossName += raidBoss.shinyAvailable ? "✨" : "";
    } else if (
      Number(raidBoss.tier === "mega" ? "6" : raidBoss.tier) ===
      raidMessage.level
    ) {
      possibleBosses += `<a href="${url}">${raidBoss.originalName}</a>`;
      possibleBosses += raidBoss.shinyAvailable ? "✨, " : ", ";
    }
  });
  possibleBosses = possibleBosses.slice(0, -2);
  possibleBosses += ")";

  //If leek duck has no info and raid has popped
  if (bossName === "" && raidMessage.pokemonId !== 0) {
    const { name: name } = await fetchJson<{ name: string }>(
      `https://pokeapi.co/api/v2/pokemon/${raidMessage.pokemonId}`,
    );
    bossName = toTitleCase(
      `<a href="https://www.pokebattler.com/raids/${
        raidMessage.level === 6
          ? name + "_MEGA"
          : name.replace(/\s/g, "_")
      }${name}</a>`,
    );
  }

  const message = `${raidMessage.level}★ Raid at <u>${
    raidMessage.name
  }</u> ${
    raidMessage.pokemonId === 0 ? "starting" : "started"
  } at ${formatISO9075(raidMessage.start, {
    representation: "time",
  })} (${formatDistanceToNow(raidMessage.start, {
    addSuffix: true,
  })})${
    raidMessage.pokemonId === 0
      ? ""
      : ` and will end at ${formatISO9075(raidMessage.end, {
          representation: "time",
        })}(${formatDistanceToNow(raidMessage.end, {
          addSuffix: true,
        })})`
  }${
    raidMessage.pokemonId === 0
      ? possibleBosses
      : ` with boss ${bossName}`
  }`;
  return message;
}

/**
 * Checks how many pokemon are there in each raid level
 * @param raidMessage original raidMessage information
 * @returns {Promise<number>} number of possible bosses from information given
 */
export async function bossCount(
  raidMessage: raidMessage,
): Promise<number> {
  const bosses = (await fetchJson<raidBosses>(
    "https://raw.githubusercontent.com/pmgo-professor-willow/data-leekduck/gh-pages/raid-bosses.min.json",
  )) as raidBosses;

  return bosses.filter(
    (boss) => Number(boss.tier) === raidMessage.level,
  ).length;
}

/**
 * Formats perfect message
 * @param pokemonMessage original pokemonMessage information
 * @returns {Promise<string>} Message formatted to send to the user
 */
export async function perfectMessageFormatter(
  pokemonMessage: pokemonMessage,
): Promise<string> {
  const { name: name } = await fetchJson<{ name: string }>(
    `https://pokeapi.co/api/v2/pokemon/${pokemonMessage.pokemon_id}`,
  );

  const message = `Perfect pokemon ${toTitleCase(name)}(CP ${
    pokemonMessage.cp
  }) despawns at ${formatISO9075(pokemonMessage.despawnDate, {
    representation: "time",
  })}(${formatDistanceToNow(pokemonMessage.despawnDate, {
    addSuffix: true,
  })})`;
  return message;
}

/**
 * Caps the first char of all words
 * @param str input string
 * @returns Title Case Strings
 */
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

export function urlFormatter(
  originalName: string,
  raidTier: string,
): string {
  let url = `https://www.pokebattler.com/raids/${originalName.replace(
    /\s/g,
    "_",
  )}`;
  if (raidTier === "mega" || raidTier === "6") {
    //TODO check if future forms are still correct
    url = `https://www.pokebattler.com/raids/${
      originalName.slice(5) + "_MEGA"
    }`;
  } else if (originalName.includes("Deoxys (Att")) {
    url = `https://www.pokebattler.com/raids/DEOXYS_ATTACK_FORM`;
  } else if (originalName.includes("Deoxys (Def")) {
    url = `https://www.pokebattler.com/raids/DEOXYS_DEFENSE_FORM`;
  } else if (originalName.includes("Deoxys (Speed")) {
    url = `https://www.pokebattler.com/raids/DEOXYS_SPEED_FORM`;
  } else if (originalName.includes("Deoxys (Normal")) {
    url = `https://www.pokebattler.com/raids/DEOXYS`;
  } else if (originalName.includes("Genesect (Shock)")) {
    url = `https://www.pokebattler.com/raids/GENESECT_SHOCK_FORM`;
  } else if (originalName.includes("Genesect (Chill)")) {
    url = `https://www.pokebattler.com/raids/GENESECT_CHILL_FORM`;
  } else if (originalName.includes("Genesect (Burn)")) {
    url = `https://www.pokebattler.com/raids/GENESECT_BURN_FORM`;
  } else if (originalName.includes("Genesect (Douse)")) {
    url = `https://www.pokebattler.com/raids/GENESECT_DOUSE_FORM`;
  } else if (originalName.includes("Thundurus (Therian)")) {
    url = `https://www.pokebattler.com/raids/THUNDURUS_THERIAN_FORM`;
  } else if (originalName.includes("Tornadus (Therian)")) {
    url = `https://www.pokebattler.com/raids/TORNADUS_THERIAN_FORM`;
  } else if (originalName.includes("Landorus (Therian)")) {
    url = `https://www.pokebattler.com/raids/LANDORUS_THERIAN_FORM`;
  } else if (originalName.includes("Alolan Raichu")) {
    url = `https://www.pokebattler.com/raids/RAICHU_ALOLA_FORM`;
  } else if (originalName.includes("Alolan Exegg")) {
    url = `https://www.pokebattler.com/raids/EXEGGUTOR_ALOLA_FORM/`;
  } else if (originalName.includes("Alolan Sandshrew")) {
    url = `https://www.pokebattler.com/raids/SANDSHREW_ALOLA_FORM/`;
  } else if (originalName.includes("Alolan Dig")) {
    url = `https://www.pokebattler.com/raids/DIGLETT_ALOLA_FORM/`;
  } else if (originalName.includes("Alolan Geo")) {
    url = `https://www.pokebattler.com/raids/GEODUDE_ALOLA_FORM/`;
  } else if (originalName.includes("Alolan Grimer")) {
    url = `https://www.pokebattler.com/raids/GRIMER_ALOLA_FORM/`;
  } else if (originalName.includes("Alolan Graveler")) {
    url = `https://www.pokebattler.com/raids/GRAVELER_ALOLA_FORM/`;
  }

  return url;
}
