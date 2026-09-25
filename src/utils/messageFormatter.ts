import { formatDistanceToNow, formatISO9075 } from "date-fns";
import { Pokedex } from 'pmgo-pokedex';
import { pokemonMessage, raidMessage } from "../types";
import { URLS, RAID_CONFIG } from "../constants";
import { fetchRaidBosses, RaidBossCache } from "./cache";
import { toEscapeHTMLMsg } from "./messageHandler";
import { formatDistance } from "./geo";
import { GAME_WEATHER, weatherIdFromName } from "./weather";
import { isShadowBoss, raidBossTier } from "./raidTier";

// Kept importable from here; they live in raidTier.ts so cache.ts can
// use them without a require cycle
export { isShadowBoss, raidBossTier };

/**
 * Fetches JSON from a URL with proper error handling
 * @param url The URL to fetch
 * @param options Optional fetch options
 * @returns Parsed JSON response
 * @throws Error if fetch fails or response is not OK
 */
async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
      );
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Network error fetching ${url}: ${error.message}`);
    }
    throw new Error(`Unknown error fetching ${url}`);
  }
}

/**
 * Whether the in-game weather at a gym boosts this boss
 * @param boss Boss with its ScrapedDuck boostedWeather list
 * @param weatherId GAME_WEATHER id at the gym; undefined when unknown
 */
export function isBossBoosted(
  boss: Pick<RaidBossCache, "boostedWeather">,
  weatherId?: number,
): boolean {
  return (
    weatherId !== undefined &&
    (boss.boostedWeather ?? []).some(
      (weather) => weatherIdFromName(weather.name) === weatherId,
    )
  );
}

/**
 * The 100% IV catch CP range that applies in the given weather, as
 * "min–max". Only one range is ever returned: boosted when the weather
 * boosts the boss, normal otherwise (or when the weather is unknown).
 * @returns "" when the cache entry has no CP data (backup source)
 */
export function bossCpRange(
  boss: Pick<RaidBossCache, "combatPower" | "boostedWeather">,
  weatherId?: number,
): string {
  if (!boss.combatPower) return "";
  const range = isBossBoosted(boss, weatherId)
    ? boss.combatPower.boosted
    : boss.combatPower.normal;
  return `${range.min}–${range.max}`;
}

/**
 * Inline boss label for HTML lists, e.g.
 * `<a href="…">Xurkitree</a>✨ <i>2171–2261 ⚡</i>`: the one 100% IV
 * CP range for the weather (never both), ⚡ when boosted. Without CP
 * data it is just the name, plus " ⚡" when boosted.
 * @param boss Cached raid boss
 * @param weatherId GAME_WEATHER id at the gym/pin; undefined when unknown
 */
export function bossInlineLabel(
  boss: Pick<
    RaidBossCache,
    "name" | "tier" | "canBeShiny" | "combatPower" | "boostedWeather"
  >,
  weatherId?: number,
): string {
  const url = urlFormatter(boss.name);
  // Boss names come from the provider
  let label = `<a href="${url}">${toEscapeHTMLMsg(boss.name)}</a>`;
  label += boss.canBeShiny ? "✨" : "";
  const boosted = isBossBoosted(boss, weatherId);
  const range = bossCpRange(boss, weatherId);
  if (range) {
    label += ` <i>${range}${boosted ? " ⚡" : ""}</i>`;
  } else if (boosted) {
    label += " ⚡";
  }
  return label;
}

/**
 * One-line boss detail for HTML messages, e.g.
 * "CP 2735–2848 ⚡ boosted (🌧 rainy) · fighting/steel" or
 * "CP 2188–2278 · fighting/steel". Parts the entry lacks are omitted.
 * @param boss Cached raid boss
 * @param weatherId GAME_WEATHER id at the gym; undefined when unknown
 * @returns "" when there is neither CP data nor types
 */
export function bossCpLine(
  boss: Pick<RaidBossCache, "combatPower" | "boostedWeather" | "types">,
  weatherId?: number,
): string {
  const parts: string[] = [];
  const range = bossCpRange(boss, weatherId);
  if (range) {
    let cp = `CP ${range}`;
    const weather =
      weatherId === undefined ? undefined : GAME_WEATHER[weatherId];
    if (weather && isBossBoosted(boss, weatherId)) {
      cp += ` ⚡ boosted (${weather.emoji} ${weather.name})`;
    }
    parts.push(cp);
  }
  const types = (boss.types ?? []).map((type) => type.name);
  if (types.length > 0) {
    // Type names come from the provider
    parts.push(toEscapeHTMLMsg(types.join("/")));
  }
  return parts.join(" · ");
}

/**
 * Detects if a raid is a shadow raid and returns the actual tier
 * Shadow raids have their level increased by RAID_CONFIG.SHADOW_RAID_LEVEL_OFFSET in upstream data
 * (e.g., shadow 1* = level 11, shadow 3* = level 13, shadow 5* = level 15)
 * @param level The raid level from upstream
 * @param bosses List of all raid bosses
 * @returns Object with actual tier and whether it's a shadow raid
 */
export function getActualRaidTier(
  level: number,
  bosses: { tier: string; name: string }[],
): { tier: number; isShadow: boolean } {
  // Shadow raids have level +offset, so check if level >= MIN_SHADOW_RAID_LEVEL
  // and if there are shadow bosses at level - offset
  if (level >= RAID_CONFIG.MIN_SHADOW_RAID_LEVEL) {
    const potentialTier = level - RAID_CONFIG.SHADOW_RAID_LEVEL_OFFSET;
    if (potentialTier > 0) {
      const shadowBossesAtTier = bosses.filter(
        (boss) =>
          raidBossTier(boss) === potentialTier && isShadowBoss(boss),
      );
      // If we find shadow bosses at the lower tier, this is a shadow raid
      if (shadowBossesAtTier.length > 0) {
        return { tier: potentialTier, isShadow: true };
      }
    }
  }
  return { tier: level, isShadow: false };
}

/**
 * Maps raid level to effective tier for notification matching.
 * Shadow raids use levels 11, 13, 15 in upstream data; this maps them to 1, 3, 5
 * so users subscribed to 1★ get both regular 1★ (level 1) and shadow 1★ (level 11).
 * @param level The raid level from upstream
 * @returns The effective tier for user preference matching
 */
export function getEffectiveTierForNotification(level: number): number {
  if (level >= RAID_CONFIG.MIN_SHADOW_RAID_LEVEL) {
    const potentialTier = level - RAID_CONFIG.SHADOW_RAID_LEVEL_OFFSET;
    if ([1, 3, 5].includes(potentialTier)) return potentialTier;
  }
  return level;
}

/**
 * Formats raid message
 * @param raidMessage original raidMessage information
 * @returns {Promise<string>} Message formatted to send to user
 * @throws Error if unable to fetch raid boss data
 */
export async function raidMessageFormatter(
  raidMessage: raidMessage,
): Promise<string> {
  let bosses;
  try {
    const result = await fetchRaidBosses();
    if (result === null) throw new Error("cache miss");
    bosses = result;
  } catch (error) {
    console.error("Failed to fetch raid bosses:", error);
    throw new Error("Unable to fetch raid boss data. Please try again later.");
  }

  // Get actual raid tier and whether it's a shadow raid
  const { tier: actualTier, isShadow } = getActualRaidTier(
    raidMessage.level,
    bosses,
  );

  const candidates: string[] = [];
  let anyBoosted = false;
  let bossName = "";
  let bossDetail = "";

  const pokedex = new Pokedex('en-US');
  bosses.forEach((raidBoss) => {
    const url = urlFormatter(raidBoss.name);
    // Typed as always returning, but yields undefined for odd names
    const raidBossDetail = pokedex.getPokemonByFuzzyName(raidBoss.name) as
      | ReturnType<Pokedex["getPokemonByFuzzyName"]>
      | undefined;
    
    // A shadow raid only hatches shadow bosses, and vice versa
    if (isShadow !== isShadowBoss(raidBoss)) {
      return;
    }
    
    //If the egg has popped, use leek duck info at the start
    if (raidMessage.pokemonId === raidBossDetail?.no) {
      bossName = `<a href="${url}">${toEscapeHTMLMsg(
        raidBoss.name,
      )}</a>`;
      bossName += raidBoss.canBeShiny ? "✨" : "";
      bossDetail = bossCpLine(raidBoss, raidMessage.weatherId);
    } else if (raidBossTier(raidBoss) === actualTier) {
      if (isBossBoosted(raidBoss, raidMessage.weatherId)) {
        anyBoosted = true;
      }
      candidates.push(bossInlineLabel(raidBoss, raidMessage.weatherId));
    }
  });

  // Egg stage: say what the weather is at this gym so the ⚡ marks make sense
  const gymWeather =
    raidMessage.weatherId === undefined
      ? undefined
      : GAME_WEATHER[raidMessage.weatherId];
  let possibleBosses = "\n\n";
  if (gymWeather) {
    possibleBosses += `${gymWeather.emoji} ${gymWeather.name} at this gym${
      anyBoosted ? " — ⚡ marks boosted bosses" : ""
    }\n`;
  }
  possibleBosses += `<a href="${URLS.LEEKDUCK_BOSS}">Possible raid boss</a>: (${candidates.join(
    ", ",
  )})`;

  //If leek duck has no info and raid has popped
  if (bossName === "" && raidMessage.pokemonId !== 0) {
    let name: string | undefined;
    try {
      const pokemonData = await fetchJson<{ name: string }>(
        `${URLS.POKEAPI_POKEMON}/${raidMessage.pokemonId}`,
      );
      name = pokemonData.name;
    } catch (error) {
      console.error(
        `Failed to fetch Pokemon data for ID ${raidMessage.pokemonId}:`,
        error,
      );
    }

    if (name === undefined) {
      // No name, so no Pokebattler page to link to
      bossName = `Pokemon #${raidMessage.pokemonId}`;
    } else {
      // PokeAPI names are lowercase and hyphenated ("zamazenta-hero").
      // Title-case only the display text: running the whole anchor
      // through toTitleCase turned it into `<a Href=...>`, which
      // Telegram rejects, dropping the link.
      const displayName = toTitleCase(name.replace(/-/g, " "));
      const prefix = isShadow
        ? "Shadow "
        : actualTier === RAID_CONFIG.MEGA_RAID_TIER
        ? "Mega "
        : "";
      bossName = `<a href="${urlFormatter(prefix + displayName)}">${toEscapeHTMLMsg(
        displayName,
      )}</a>`;
    }
  }

  const message = `${actualTier}★ Raid at <u>${
    toEscapeHTMLMsg(raidMessage.name) // user-set names may contain & or <
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
  }${bossDetail ? `\n${bossDetail}` : ""}`;
  return message;
}

/**
 * Checks how many pokemon are there in each raid level
 * @param raidMessage original raidMessage information
 * @returns {Promise<number>} number of possible bosses from information given
 * @throws Error if unable to fetch raid boss data
 */
export async function bossCount(
  raidMessage: raidMessage,
): Promise<number> {
  let bosses;
  try {
    const result = await fetchRaidBosses();
    if (result === null) throw new Error("cache miss");
    bosses = result;
  } catch (error) {
    console.error("Failed to fetch raid bosses:", error);
    throw new Error("Unable to fetch raid boss data. Please try again later.");
  }

  // Get actual raid tier and whether it's a shadow raid
  const { tier: actualTier, isShadow } = getActualRaidTier(
    raidMessage.level,
    bosses,
  );

  return bosses.filter((boss) => {
    // A shadow raid only hatches shadow bosses, and vice versa
    if (isShadow !== isShadowBoss(boss)) {
      return false;
    }
    return raidBossTier(boss) === actualTier;
  }).length;
}

/**
 * Formats perfect message
 * @param pokemonMessage original pokemonMessage information
 * @returns {Promise<string>} Message formatted to send to the user
 * @throws Error if unable to fetch Pokemon data
 */
export async function perfectMessageFormatter(
  pokemonMessage: pokemonMessage,
): Promise<string> {
  let name: string;
  try {
    const pokemonData = await fetchJson<{ name: string }>(
      `${URLS.POKEAPI_POKEMON}/${pokemonMessage.pokemon_id}`,
    );
    name = pokemonData.name;
  } catch (error) {
    console.error(
      `Failed to fetch Pokemon data for ID ${pokemonMessage.pokemon_id}:`,
      error,
    );
    // Fallback: use Pokemon ID if name fetch fails
    name = `Pokemon #${pokemonMessage.pokemon_id}`;
  }

  let message = `Perfect pokemon ${toTitleCase(name)}(CP ${
    pokemonMessage.cp
  }) despawns at ${formatISO9075(pokemonMessage.despawnDate, {
    representation: "time",
  })}(${formatDistanceToNow(pokemonMessage.despawnDate, {
    addSuffix: true,
  })})`;
  // The spawn's own `weather` is its WeatherBoostedCondition: 0 means
  // not boosted, 1..7 the boosting weather (higher level/CP).
  const boost = GAME_WEATHER[pokemonMessage.weather];
  if (boost) {
    message += `\n⚡ weather boosted (${boost.emoji} ${boost.name})`;
  }
  if (pokemonMessage.distanceMeters !== undefined) {
    message += `\n📏 ${formatDistance(
      pokemonMessage.distanceMeters,
    )} from your saved location`;
  }
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

// Regional prefixes as Pokebattler spells them in ids ("Alolan
// Sandslash" -> SANDSLASH_ALOLA_FORM, "Hisuian Typhlosion" ->
// TYPHLOSION_HISUIAN_FORM)
const POKEBATTLER_REGIONS: Record<string, string> = {
  alolan: "ALOLA",
  galarian: "GALARIAN",
  hisuian: "HISUIAN",
  paldean: "PALDEA",
};

// Parenthesised form names that differ from Pokebattler's id, keyed
// by the upper-cased species id
const POKEBATTLER_FORMS: Record<string, Record<string, string>> = {
  ZACIAN: { CROWNED: "CROWNED_SWORD" },
  ZAMAZENTA: { CROWNED: "CROWNED_SHIELD" },
};

function pokebattlerToken(text: string): string {
  return text
    .replace(/♀/g, " female")
    .replace(/♂/g, " male")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // Flabébé -> Flabebe
    .replace(/['’.:]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

/**
 * Pokebattler raid page id for a boss name as ScrapedDuck/LeekDuck
 * write it: "Xurkitree" -> XURKITREE, "Mega Charizard X" ->
 * CHARIZARD_MEGA_X, "Primal Kyogre" -> KYOGRE_PRIMAL, "Thundurus
 * (Incarnate)" -> THUNDURUS_INCARNATE_FORM, "Shadow Alolan Sandslash"
 * -> SANDSLASH_ALOLA_SHADOW_FORM. Pokebattler ids are upper case;
 * shadow ids drop the form ("Shadow Thundurus (Incarnate)" ->
 * THUNDURUS_SHADOW_FORM).
 */
export function pokebattlerId(name: string): string {
  let rest = name.trim();
  const isShadow = /^shadow\s+/i.test(rest);
  rest = rest.replace(/^shadow\s+/i, "");

  const mega = rest.match(/^mega\s+(.+?)(?:\s+([XYZ]))?$/i);
  if (mega) {
    const suffix = mega[2] ? `_${mega[2].toUpperCase()}` : "";
    return `${pokebattlerToken(mega[1])}_MEGA${suffix}`;
  }
  const primal = rest.match(/^primal\s+(.+)$/i);
  if (primal) return `${pokebattlerToken(primal[1])}_PRIMAL`;

  let region: string | undefined;
  const regional = rest.match(/^(\w+)\s+(.+)$/);
  if (regional && POKEBATTLER_REGIONS[regional[1].toLowerCase()]) {
    region = POKEBATTLER_REGIONS[regional[1].toLowerCase()];
    rest = regional[2];
  }

  let form: string | undefined;
  const withForm = rest.match(/^(.+?)\s*\((.+)\)$/);
  if (withForm) {
    rest = withForm[1];
    // "Hero of Many Battles" -> HERO, "Origin Forme" -> ORIGIN
    const formName = withForm[2]
      .replace(/\s+of\s+many\s+battles$/i, "")
      .replace(/\s+forme?$/i, "");
    form = pokebattlerToken(formName);
  }

  const species = pokebattlerToken(rest);
  if (form === "NORMAL") form = undefined; // Deoxys (Normal) -> DEOXYS
  if (form) form = POKEBATTLER_FORMS[species]?.[form] ?? form;

  if (isShadow) {
    return `${species}${region ? `_${region}` : ""}_SHADOW_FORM`;
  }
  const qualifier = [region, form].filter(Boolean).join("_");
  return qualifier ? `${species}_${qualifier}_FORM` : species;
}

/**
 * Pokebattler raid page for a boss
 * @param name Boss name as ScrapedDuck/LeekDuck write it
 * @returns URL of the boss's Pokebattler raid page
 */
export function urlFormatter(name: string): string {
  return `${URLS.POKEBATTLER_RAIDS}/${pokebattlerId(name)}`;
}
