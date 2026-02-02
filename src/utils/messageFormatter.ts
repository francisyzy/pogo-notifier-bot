import { formatDistanceToNow, formatISO9075 } from "date-fns";
import { pokemonMessage, raidBosses, raidMessage } from "../types";
import { URLS } from "../constants";

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
  const bosses = (await fetchJson<raidBosses>(URLS.RAID_BOSSES_JSON)) as raidBosses;

  let possibleBosses = `\n\n<a href="${URLS.LEEKDUCK_BOSS}">Possible raid boss</a>: (`;
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
      `${URLS.POKEAPI_POKEMON}/${raidMessage.pokemonId}`,
    );
    bossName = toTitleCase(
      `<a href="${URLS.POKEBATTLER_RAIDS}/${
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
  const bosses = (await fetchJson<raidBosses>(URLS.RAID_BOSSES_JSON)) as raidBosses;

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
    `${URLS.POKEAPI_POKEMON}/${pokemonMessage.pokemon_id}`,
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
  const base = URLS.POKEBATTLER_RAIDS;
  let url = `${base}/${originalName.replace(/\s/g, "_")}`;
  if (raidTier === "mega" || raidTier === "6") {
    //TODO check if future forms are still correct
    url = `${base}/${originalName.slice(5) + "_MEGA"}`;
  } else if (originalName.includes("Deoxys (Att")) {
    url = `${base}/DEOXYS_ATTACK_FORM`;
  } else if (originalName.includes("Deoxys (Def")) {
    url = `${base}/DEOXYS_DEFENSE_FORM`;
  } else if (originalName.includes("Deoxys (Speed")) {
    url = `${base}/DEOXYS_SPEED_FORM`;
  } else if (originalName.includes("Deoxys (Normal")) {
    url = `${base}/DEOXYS`;
  } else if (originalName.includes("Genesect (Shock)")) {
    url = `${base}/GENESECT_SHOCK_FORM`;
  } else if (originalName.includes("Genesect (Chill)")) {
    url = `${base}/GENESECT_CHILL_FORM`;
  } else if (originalName.includes("Genesect (Burn)")) {
    url = `${base}/GENESECT_BURN_FORM`;
  } else if (originalName.includes("Genesect (Douse)")) {
    url = `${base}/GENESECT_DOUSE_FORM`;
  } else if (originalName.includes("Thundurus (Therian)")) {
    url = `${base}/THUNDURUS_THERIAN_FORM`;
  } else if (originalName.includes("Tornadus (Therian)")) {
    url = `${base}/TORNADUS_THERIAN_FORM`;
  } else if (originalName.includes("Landorus (Therian)")) {
    url = `${base}/LANDORUS_THERIAN_FORM`;
  } else if (originalName.includes("Alolan Raichu")) {
    url = `${base}/RAICHU_ALOLA_FORM`;
  } else if (originalName.includes("Alolan Exegg")) {
    url = `${base}/EXEGGUTOR_ALOLA_FORM/`;
  } else if (originalName.includes("Alolan Sandshrew")) {
    url = `${base}/SANDSHREW_ALOLA_FORM/`;
  } else if (originalName.includes("Alolan Dig")) {
    url = `${base}/DIGLETT_ALOLA_FORM/`;
  } else if (originalName.includes("Alolan Geo")) {
    url = `${base}/GEODUDE_ALOLA_FORM/`;
  } else if (originalName.includes("Alolan Grimer")) {
    url = `${base}/GRIMER_ALOLA_FORM/`;
  } else if (originalName.includes("Alolan Graveler")) {
    url = `${base}/GRAVELER_ALOLA_FORM/`;
  }

  return url;
}
